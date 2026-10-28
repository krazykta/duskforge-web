// Punto de entrada: menú, cómo jugar, resultado y ajustes. Registra el resto de pantallas.
import { ECONOMY } from './core/config.js';
import { levelOf, xpIntoLevel } from './core/progression.js';
import { app, getProfile, setProfile, register, onTap, topBar, missionBadge } from './ui/store.js';
import { startBattle } from './ui/battle.js';
import { showCollection, showDeckBuilder, resetDeckDraft } from './ui/collection.js';
import { showShop } from './ui/shop.js';
import { showMissions } from './ui/missions.js';
import { startApp, showAuth, accountPanel, accountAction } from './ui/account.js';

// ---------- Menú ----------
function showMenu() {
  const p = getProfile();
  app.innerHTML = `
    <section class="screen scenic">
      ${topBar()}
      <h1 class="logo">DUSK<span>FORGE</span></h1>
      <div class="profile">
        <div class="profile-row"><span>Nivel ${levelOf(p.xp)}</span><span class="sub">${p.wins} V · ${p.losses} D</span></div>
        <div class="xpbar" title="Experiencia"><div style="width:${(xpIntoLevel(p.xp) / ECONOMY.xpPerLevel) * 100}%"></div></div>
        <div class="stats">${xpIntoLevel(p.xp)} / ${ECONOMY.xpPerLevel} XP para el siguiente nivel</div>
      </div>
      <button class="btn gold big-play" data-go="battle">⚔️ Jugar</button>
      <nav class="tiles">
        <button class="tile" data-go="collection"><img src="img/ui/icon_collection.webp" alt="">Colección</button>
        <button class="tile" data-go="deck"><img src="img/ui/icon_deck.webp" alt="">Mazo</button>
        <button class="tile" data-go="shop"><img src="img/ui/icon_shop.webp" alt="">Tienda</button>
        <button class="tile" data-go="missions"><img src="img/ui/icon_missions.webp" alt="">Misiones${missionBadge()}</button>
        <button class="tile" data-go="settings"><img src="img/ui/icon_settings.webp" alt="">Ajustes</button>
        <button class="tile" data-act="rules"><img src="img/ui/icon_rules.webp" alt="">Cómo jugar</button>
      </nav>
    </section>`;
  onTap((el) => {
    if (el.closest('[data-act="rules"]')) showRules();
  });
  if (!p.tutorialSeen) showRules();
}

function showRules() {
  const bg = document.createElement('div');
  bg.className = 'modal-bg';
  bg.innerHTML = `
    <div class="modal" role="dialog" aria-label="Cómo jugar">
      <h2>Cómo jugar</h2>
      <ul>
        <li>Deja la vida del rival en <b>0</b> para ganar. Ambos empezáis con 20.</li>
        <li>Cada turno ganas <b>energía 💎</b> (hasta 5). Las cartas cuestan energía.</li>
        <li>Toca una carta para verla y <b>toca otra vez</b> para jugarla. Si necesita objetivo, toca el objetivo marcado en rojo.</li>
        <li>Las criaturas con brillo verde pueden atacar: tócala y luego toca su objetivo.</li>
        <li><b>Guardián</b> debe ser atacado primero. <b>Ímpetu</b> ataca al entrar. <b>Escudo</b> anula un golpe. <b>Vampírico</b> te cura al atacar.</li>
        <li><b>Letal</b> destruye a la criatura que dañe. <b>Sigilo</b>: nadie puede atacarla ni apuntarla hasta que ataque. <b>Furia</b>: ataca dos veces por turno. Una criatura <b>congelada</b> ❄️ no ataca en su siguiente turno.</li>
        <li>Gana monedas 🪙 jugando y con misiones para comprar sobres. Las cartas repetidas dan fragmentos 💠 para fabricar las que quieras.</li>
      </ul>
      <button class="btn" data-act="close">¡Entendido!</button>
    </div>`;
  app.appendChild(bg);
  bg.addEventListener('click', (ev) => {
    ev.stopPropagation();
    if (!ev.target.closest('[data-act="close"]')) return;
    setProfile({ ...getProfile(), tutorialSeen: true });
    bg.remove();
  });
}

// ---------- Resultado ----------
function showResult(won, rewards, draw) {
  const levelUp = rewards && rewards.levelAfter > rewards.levelBefore;
  app.innerHTML = `
    <section class="screen">
      ${draw ? '' : `<img class="result-art" src="img/ui/${won ? 'victory' : 'defeat'}.webp" alt="">`}
      <h1 class="result-title ${won ? 'win' : 'lose'}">${won ? '¡VICTORIA!' : draw ? 'EMPATE' : 'DERROTA'}</h1>
      ${rewards ? `
      <div class="rewards">
        <div><span>Monedas</span><b class="coins">+${rewards.coins} 🪙</b></div>
        ${rewards.firstWinBonus ? `<div class="bonus"><span>Primera victoria del día</span><span>(incluye +${rewards.firstWinBonus})</span></div>` : ''}
        <div><span>Experiencia</span><b>+${rewards.xp} XP</b></div>
      </div>` : ''}
      ${levelUp ? `<div class="levelup">⬆ ¡Has subido a nivel ${rewards.levelAfter}!</div>` : ''}
      <div class="menu-buttons">
        <button class="btn gold" data-go="battle">Jugar otra vez</button>
        <button class="btn ghost" data-go="menu">Menú${missionBadge()}</button>
      </div>
    </section>`;
}

// ---------- Ajustes ----------
function showSettings() {
  const s = getProfile().settings;
  const toggle = (key, label, hint) => `
    <label class="setting"><span><b>${label}</b><br><span class="sub">${hint}</span></span>
      <input type="checkbox" data-setting="${key}" ${s[key] ? 'checked' : ''}></label>`;
  app.innerHTML = `
    <section class="screen top">
      ${topBar('Ajustes')}
      <div class="panel">
        ${toggle('reducedMotion', 'Animaciones reducidas', 'Menos movimiento en pantalla.')}
        ${toggle('fastAi', 'Rival rápido', 'El rival juega sus cartas más deprisa.')}
      </div>
      ${accountPanel()}
      <p class="sub">Sonido: todavía no disponible.</p>
    </section>`;
  onTap((el) => {
    const act = el.closest('[data-act]')?.dataset.act;
    if (act) return accountAction(act);
    const input = el.closest('[data-setting]');
    if (!input) return;
    const p = getProfile();
    setProfile({ ...p, settings: { ...p.settings, [input.dataset.setting]: input.checked } });
  });
}

register('menu', showMenu);
register('battle', startBattle);
register('result', showResult);
register('collection', showCollection);
register('deck', () => { resetDeckDraft(); showDeckBuilder(); });
register('shop', showShop);
register('missions', showMissions);
register('settings', showSettings);
register('auth', showAuth);

startApp();
