// Punto de entrada: menú, cómo jugar, resultado y ajustes. Registra el resto de pantallas.
import { ECONOMY, COSMETICS, COSMETIC_KINDS, SEASON, WELCOME_GIFT } from './core/config.js';
import { COLLECTIBLE, RARITIES } from './core/collection.js';
import { achievementList } from './core/achievements.js';
import { levelOf, xpIntoLevel } from './core/progression.js';
import { refreshMissions, missionDef } from './core/missions.js';
import { passTier } from './core/pass.js';
import { avatarHtml, showAvatarPicker } from './ui/avatar.js';
import { act, app, getCloudUser, getProfile, hasPremiumPass, mailSlot, savePrefs, register, go, onTap, topBar, resources, countUp, toast } from './ui/store.js';
import { icon } from './ui/icons.js';
import { startBattle } from './ui/battle.js';
import { showCollection, showDeckBuilder, resetDeckDraft } from './ui/collection.js';
import { showReveal, showShop } from './ui/shop.js';
import { showMissions } from './ui/missions.js';
import { showOnline } from './ui/online.js';
import { showMail } from './ui/mail.js';
import { startApp, showAuth, showSupport, accountPanel, accountAction, escapeHtml } from './ui/account.js';
import { updateMusic } from './ui/sound.js';

if ('serviceWorker' in navigator && location.hostname !== 'localhost') navigator.serviceWorker.register('sw.js').catch(() => {});

// Un fallo inesperado se avisa una vez en vez de dejar al jugador ante una pantalla que no responde.
let lastCrash = 0;
function onCrash(err) {
  console.error(err);
  if (Date.now() - lastCrash < 10000) return;
  lastCrash = Date.now();
  toast('Algo ha fallado. Si se repite, reinicia el juego.');
}
addEventListener('error', (ev) => onCrash(ev.error ?? ev.message));
addEventListener('unhandledrejection', (ev) => onCrash(ev.reason));

// ---------- Menú ----------
// La misión de hoy que queda más cerca, para tener siempre un motivo para la siguiente partida.
function nextGoal(p) {
  const left = refreshMissions(p).missions.daily.filter((m) => !m.claimed);
  if (!left.length) return '<span class="sub">Misiones de hoy completadas</span>';
  const ratio = (m) => m.progress / missionDef(m.id).goal;
  const m = left.reduce((a, b) => (ratio(b) > ratio(a) ? b : a));
  const d = missionDef(m.id);
  return `<span class="sub">${m.progress >= d.goal ? '¡Recompensa lista!' : `${d.text} · ${m.progress} / ${d.goal}`}</span>`;
}

function showMenu() {
  const p = getProfile();
  const into = xpIntoLevel(p.xp);
  const title = COSMETICS.find((c) => c.id === p.cosmetics.title)?.name;
  app.innerHTML = `
    <section class="screen scenic home">
      <div class="embers" aria-hidden="true">${'<i></i>'.repeat(10)}</div>
      <header class="topbar">
        ${resources()}
        <button class="icon-btn gear" data-go="profile" aria-label="Perfil">${avatarHtml(p)}${mailSlot()}</button>
      </header>
      <h1 class="logo"><img src="img/ui/logo.webp" alt="DUSKFORGE"></h1>
      <div class="home-foot stagger">
        <button class="panel summary" data-go="missions">
          <span class="lvl"><b>${levelOf(p.xp)}</b></span>
          <span class="summary-text">
            <span class="row"><b>Nivel ${levelOf(p.xp)}</b><span class="sub">${title ?? `${p.wins} V · ${p.losses} D`}</span></span>
            <span class="xpbar" title="${into} / ${ECONOMY.xpPerLevel} XP"><span style="width:${(into / ECONOMY.xpPerLevel) * 100}%"></span></span>
            ${nextGoal(p)}
          </span>
        </button>
        <button class="btn gold big-play" data-go="battle"><img src="img/ui/icon_play.webp" alt=""><span>Jugar<small>Mazo ${p.activeDeck + 1}</small></span></button>
        <div class="home-extra">
          <button class="btn small ghost" data-go="online">${icon('heart')}Con amigos</button>
          <button class="btn small ghost" data-act="pass">${icon('spark')}Pase ${passTier(p)}/${SEASON.tiers.length}</button>
        </div>
      </div>
    </section>`;
  onTap((el) => {
    if (el.closest('[data-act="pass"]')) go('missions', 'pass');
  });
  if (!p.tutorialSeen) showRules();
  else if (!p.welcomeClaimed) showWelcome();
}

// Sale al entrar hasta que se recoge. Si no hay conexión, vuelve la próxima vez que se abra el inicio.
function showWelcome() {
  const bg = document.createElement('div');
  bg.className = 'modal-bg';
  bg.innerHTML = `
    <div class="modal" role="dialog" aria-label="Regalo de bienvenida">
      <h2>¡Gracias por probar DUSKFORGE!</h2>
      <p>Te hacemos este regalo por ayudarnos a probar el juego, y para que tus primeras partidas sean más fáciles.</p>
      <ul>
        ${WELCOME_GIFT.packs.map((x) => `<li><b>${x.count}</b> ${x.text}</li>`).join('')}
        <li><b>${WELCOME_GIFT.coins}</b> monedas ${icon('coin')}</li>
      </ul>
      <p>Si todo va bien y el juego sale adelante, quienes sigan aquí tendrán otra buena recompensa.</p>
      <button class="btn gold" data-act="claim">Abrir mi regalo</button>
    </div>`;
  app.appendChild(bg);
  bg.addEventListener('click', async (ev) => {
    ev.stopPropagation();
    if (!ev.target.closest('[data-act="claim"]')) return;
    bg.remove();
    const r = await act('claimWelcome');
    if (r.error) toast(r.error);
    else showReveal(r, 'menu');
  });
}

function showRules() {
  const bg = document.createElement('div');
  bg.className = 'modal-bg';
  bg.innerHTML = `
    <div class="modal" role="dialog" aria-label="Cómo jugar">
      <h2>Cómo jugar</h2>
      <ul>
        <li>Deja la vida del rival en <b>0</b> para ganar. Empiezas con 20, y curarte puede llevarte por encima: la vida no tiene tope. Hasta el nivel 10 el rival empieza con menos; después, con más a medida que subes.</li>
        <li>Los mazos tienen <b>24 cartas</b> y cada jugador puede tener hasta <b>10 criaturas</b> en la mesa.</li>
        <li>Cada turno ganas <b>energía</b> ${icon('gem')} (hasta 5). Las cartas cuestan energía. Los dos empezáis con 4 cartas.</li>
        <li>Toca una carta para verla en grande y <b>toca otra vez</b> para jugarla. Si necesita objetivo, toca el objetivo marcado en rojo. Las criaturas del rival también se pueden ampliar.</li>
        <li>Las criaturas con brillo verde pueden atacar: tócala y luego toca su objetivo. ${icon('skull')} significa que el objetivo caerá y ${icon('warn')} que caerá tu atacante. ${icon('sleep')} es que esa criatura ya no puede atacar este turno.</li>
        <li><b>Guardián</b> debe ser atacado primero. <b>Ímpetu</b> ataca al entrar. <b>Escudo</b> anula un golpe. <b>Vampírico</b> te cura al atacar.</li>
        <li><b>Letal</b> destruye a la criatura que dañe. <b>Sigilo</b>: nadie puede atacarla ni apuntarla hasta que ataque. <b>Furia</b>: ataca dos veces por turno. Una criatura <b>congelada</b> ${icon('snow')} no ataca en su siguiente turno.</li>
        <li>Una criatura <b>silenciada</b> ${icon('mute')} pierde sus palabras clave y su habilidad. <b>Debilitar</b> le quita ataque; con 0 de ataque no puede atacar. <b>Transformar</b> la convierte en otra criatura (como un Sapito Maldito 0/1).</li>
        <li>Gana monedas ${icon('coin')} jugando y con misiones para comprar sobres. Las cartas repetidas dan fragmentos ${icon('shard')} para fabricar las que quieras.</li>
        <li>Las cartas son <b>comunes</b>, <b>raras</b>, <b>épicas</b> o <b>legendarias</b>. En un mazo puedes llevar 2 copias de cada una, pero solo 1 de cada legendaria.</li>
        <li>Mira tu <b>Buzón</b> ${icon('mail')} en el Perfil: ahí llegan noticias, ofertas y regalos.</li>
      </ul>
      <button class="btn gold" data-act="close">¡Entendido!</button>
    </div>`;
  app.appendChild(bg);
  bg.addEventListener('click', (ev) => {
    ev.stopPropagation();
    if (!ev.target.closest('[data-act="close"]')) return;
    savePrefs({ tutorialSeen: true });
    bg.remove();
    if (!getProfile().welcomeClaimed) showWelcome();
  });
}

// ---------- Resultado ----------
function showResult(won, rewards, draw, friendly, note) {
  const levelUp = rewards && rewards.levelAfter > rewards.levelBefore;
  const art = won ? 'victory' : 'defeat';
  app.innerHTML = `
    <section class="screen result ${won ? 'won' : draw ? 'draw' : 'lost'}">
      <img class="result-art" src="img/ui/${draw ? 'battle_bg' : art}.webp" alt="">
      <div class="rays" aria-hidden="true"></div>
      <div class="embers" aria-hidden="true">${'<i></i>'.repeat(10)}</div>
      <h1 class="result-title">${draw ? 'EMPATE' : `<img src="img/ui/title_${art}.webp" alt="${won ? '¡Victoria!' : 'Derrota'}">`}</h1>
      ${rewards ? `
      <div class="panel rewards">
        <div class="reward"><small>Monedas</small><b class="coins">${icon('coin')}<span data-count="${rewards.coins}">+0</span></b></div>
        <div class="reward"><small>Experiencia</small><b><span data-count="${rewards.xp}">+0</span> XP</b></div>
        ${rewards.firstWinBonus ? `<p class="bonus">Primera victoria del día: incluye +${rewards.firstWinBonus} monedas</p>` : ''}
      </div>` : `<p class="sub">${note || (friendly ? 'Las partidas con amigos no dan recompensa.' : 'Terminó demasiado pronto: no cuenta como partida ni da recompensa.')}</p>`}
      ${levelUp ? `<div class="levelup">${icon('up')} ¡Has subido a nivel ${rewards.levelAfter}!</div>` : ''}
      <div class="menu-buttons">
        <button class="btn gold" data-go="${friendly ? 'online' : 'battle'}">Jugar otra vez</button>
        <button class="btn ghost" data-go="menu">Volver al inicio</button>
      </div>
    </section>`;
  app.querySelectorAll('[data-count]').forEach((el) => countUp(el, Number(el.dataset.count), '+'));
}

// ---------- Perfil ----------
const RARITY_PLURAL = { common: 'Comunes', rare: 'Raras', epic: 'Épicas', legendary: 'Legendarias' };
const bar = (n, total) => `<span class="xpbar"><span style="width:${total ? Math.min(100, (n / total) * 100) : 0}%"></span></span>`;
const progress = (label, n, total, cls = '') => `
  <div class="progress-row"><span class="${cls}">${label}</span><b>${n} / ${total}</b></div>${bar(n, total)}`;

// Todo lo conseguido de un vistazo. Los trofeos de la Arena se añadirán aquí cuando exista.
function showProfile() {
  const p = getProfile();
  const user = getCloudUser();
  const into = xpIntoLevel(p.xp);
  const title = COSMETICS.find((c) => c.id === p.cosmetics.title)?.name;
  const owned = new Set(Object.keys(p.collection).filter((id) => p.collection[id] > 0));
  const played = p.wins + p.losses;
  const achievements = achievementList(p);
  const { banner } = p.cosmetics;
  const row = (attrs, ic, label, hint, extra = '') => `
    <button class="profile-row" ${attrs}>${icon(ic)}<span><b>${label}</b><span class="sub">${hint}</span></span>${extra}${icon('next')}</button>`;
  const stat = (n, label) => `<span><b>${n}</b><small>${label}</small></span>`;
  app.innerHTML = `
    <section class="screen top">
      ${topBar('Perfil', 'menu')}
      <div class="panel profile-card ${banner ? `banner c-${banner}` : ''}">
        <button class="avatar-btn" data-act="avatar" aria-label="Cambiar avatar">${avatarHtml(p, 'big')}<span class="lvl"><b>${levelOf(p.xp)}</b></span></button>
        <span class="summary-text">
          <b>${title ?? `Nivel ${levelOf(p.xp)}`}</b>
          <span class="sub">${user ? escapeHtml(user.email) : 'Sin cuenta'}</span>
          <span class="sub">Nivel ${levelOf(p.xp)} · ${into} / ${ECONOMY.xpPerLevel} XP</span>
          ${bar(into, ECONOMY.xpPerLevel)}
        </span>
      </div>
      <div class="panel">
        <h3>Combates</h3>
        <div class="profile-stats">
          ${stat(played, 'Partidas')}${stat(p.wins, 'Victorias')}${stat(p.losses, 'Derrotas')}${stat(played ? `${Math.round((p.wins / played) * 100)} %` : '–', 'Ganadas')}
        </div>
      </div>
      <div class="panel">
        <h3>Colección</h3>
        ${progress('Cartas distintas', owned.size, COLLECTIBLE.length)}
        ${RARITIES.map((r) => progress(RARITY_PLURAL[r], COLLECTIBLE.filter((c) => c.rarity === r && owned.has(c.id)).length, COLLECTIBLE.filter((c) => c.rarity === r).length, `t-${r}`)).join('')}
        <div class="progress-row"><span>Brillantes</span><b>${p.foils.length}</b></div>
      </div>
      <div class="panel">
        <h3>Logros y temporada</h3>
        ${progress('Logros conseguidos', achievements.filter((a) => a.claimed).length, achievements.length)}
        ${progress(`Pase «${SEASON.name}»${hasPremiumPass() ? ' · premium' : ''}`, passTier(p), SEASON.tiers.length)}
        <div class="progress-row"><span>Huecos de mazo</span><b>${p.decks.length}</b></div>
        <div class="progress-row"><span>Bolsa de botín</span><b>Nivel ${p.upgrades.purse}</b></div>
      </div>
      <div class="panel">
        <h3>Estilo</h3>
        ${Object.entries(COSMETIC_KINDS).map(([kind, label]) => {
          const all = COSMETICS.filter((c) => c.kind === kind);
          return progress(label, all.filter((c) => p.cosmetics.owned.includes(c.id)).length, all.length);
        }).join('')}
        <button class="btn small ghost profile-more" data-act="style">${icon('spark')}Ver marcos, estandartes y más</button>
      </div>
      <nav class="panel profile-menu" aria-label="Perfil">
        ${row('data-go="mail"', 'mail', 'Buzón', 'Noticias, ofertas y regalos', mailSlot())}
        ${row('data-act="rules"', 'help', 'Cómo jugar', 'Las normas del juego')}
        ${row('data-go="settings"', 'gear', 'Ajustes', 'Sonido, animaciones y cuenta')}
        ${row('data-go="support"', 'scroll', 'Contacto', '¿Dudas, errores o ideas? Escríbenos')}
      </nav>
    </section>`;
  onTap((el) => {
    if (el.closest('[data-act="rules"]')) showRules();
    if (el.closest('[data-act="avatar"]')) showAvatarPicker(showProfile);
    if (el.closest('[data-act="style"]')) go('shop', 'extras');
  });
}

// ---------- Ajustes ----------
function showSettings() {
  const s = getProfile().settings;
  const toggle = (key, label, hint) => `
    <label class="setting"><span><b>${label}</b><span class="sub">${hint}</span></span>
      <input type="checkbox" role="switch" data-setting="${key}" ${s[key] ? 'checked' : ''}></label>`;
  app.innerHTML = `
    <section class="screen top">
      ${topBar('Ajustes', 'profile')}
      <div class="panel">
        <h3>Juego</h3>
        ${toggle('reducedMotion', 'Animaciones reducidas', 'Menos movimiento en pantalla.')}
        ${toggle('fastAi', 'Rival rápido', 'El rival juega sus cartas más deprisa.')}
        ${toggle('sound', 'Efectos de sonido', 'Cartas, golpes, monedas y botones.')}
        ${toggle('music', 'Música', 'Música de fondo en los menús y en combate.')}
      </div>
      ${accountPanel()}
    </section>`;
  onTap((el) => {
    const act = el.closest('[data-act]')?.dataset.act;
    if (act) return accountAction(act);
    const input = el.closest('[data-setting]');
    if (!input) return;
    savePrefs({ settings: { ...getProfile().settings, [input.dataset.setting]: input.checked } });
    updateMusic();
  });
}

register('menu', showMenu);
register('battle', startBattle);
register('result', showResult);
register('collection', showCollection);
register('deck', () => { resetDeckDraft(); showDeckBuilder(); });
register('shop', showShop);
register('missions', showMissions);
register('profile', showProfile);
register('mail', showMail);
register('settings', showSettings);
register('auth', showAuth);
register('support', showSupport);
register('online', showOnline);

startApp();
