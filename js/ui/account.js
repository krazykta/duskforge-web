// Cuenta: entrar, crear cuenta, recuperar contraseña, cerrar sesión y borrar cuenta.
import { sb, currentUser, signUp, signIn, signOut, sendReset, setPassword, deleteAccount, pullProfile, pushProfile, sendSupport, mySupport, markSupportSeen } from '../cloud.js';
import { app, getProfile, go, toast, topBar, setCloudUser, getCloudUser, flushCloud, replaceProfile } from './store.js';

const GUEST_KEY = 'duskforge.guest';
const isGuest = () => { try { return localStorage.getItem(GUEST_KEY) === '1'; } catch { return false; } };
const setGuest = (on) => { try { on ? localStorage.setItem(GUEST_KEY, '1') : localStorage.removeItem(GUEST_KEY); } catch { /* sin almacenamiento */ } };

let recovering = false; // se ha abierto el enlace de "recuperar contraseña" del correo

// Arranque: entra con la sesión guardada, o pide cuenta (salvo que ya eligiera jugar sin cuenta).
export async function startApp() {
  sb?.auth.onAuthStateChange((event) => {
    if (event !== 'PASSWORD_RECOVERY') return;
    recovering = true;
    setTimeout(() => go('auth', 'newPassword')); // fuera del callback: Supabase recomienda no esperar dentro
  });
  const user = await currentUser();
  if (user) return enterWithUser(user);
  go(isGuest() ? 'menu' : 'auth');
}

// Al entrar: si la cuenta ya tiene partida en la nube, se usa esa; si no, se sube la de este dispositivo.
async function enterWithUser(user) {
  const r = await pullProfile(user.id);
  if (r.error) {
    // No se sube nada para no sobrescribir la partida de la nube con la local.
    toast('No se pudo cargar tu partida de la nube. Juegas con la de este dispositivo.');
  } else {
    if (r.data) replaceProfile(r.data);
    else await pushProfile(user.id, getProfile());
    setCloudUser(user);
    mySupport().then((s) => s.data?.some((m) => m.reply && !m.reply_seen) && toast('Te hemos respondido: míralo en Ajustes → Contacto'));
  }
  setGuest(false);
  if (recovering) go('auth', 'newPassword');
  else go('menu');
}

const FORMS = {
  login: { title: 'Entrar', fields: ['email', 'password'], submit: 'Entrar' },
  register: { title: 'Crear cuenta', fields: ['email', 'password', 'password2'], submit: 'Crear cuenta' },
  forgot: { title: 'Recuperar contraseña', fields: ['email'], submit: 'Enviar correo' },
  newPassword: { title: 'Nueva contraseña', fields: ['password', 'password2'], submit: 'Guardar contraseña' },
};
const FIELD = {
  email: '<label>Correo<input name="email" type="email" autocomplete="email" required></label>',
  password: (mode) => `<label>Contraseña<input name="password" type="password" minlength="8" required
    autocomplete="${mode === 'login' ? 'current-password' : 'new-password'}"></label>`,
  password2: '<label>Repite la contraseña<input name="password2" type="password" minlength="8" required autocomplete="new-password"></label>',
};

export function showAuth(mode = 'login') {
  const f = FORMS[mode];
  app.innerHTML = `
    <section class="screen auth scenic">
      <h1 class="logo"><img src="img/ui/logo.webp" alt="DUSKFORGE"></h1>
      <form class="panel auth-form" novalidate>
        <h3>${f.title}</h3>
        ${f.fields.map((k) => (typeof FIELD[k] === 'function' ? FIELD[k](mode) : FIELD[k])).join('')}
        ${mode === 'login' || mode === 'forgot' ? '' : '<p class="sub">Mínimo 8 caracteres.</p>'}
        <p class="warn" role="alert" id="auth-msg"></p>
        <button class="btn gold" type="submit">${f.submit}</button>
      </form>
      <div class="auth-links">
        ${mode !== 'login' && mode !== 'newPassword' ? '<button class="link" data-mode="login">Ya tengo cuenta</button>' : ''}
        ${mode === 'login' ? '<button class="link" data-mode="register">Crear cuenta nueva</button><button class="link" data-mode="forgot">¿Olvidaste tu contraseña?</button>' : ''}
        ${mode !== 'newPassword' ? '<button class="link" data-act="guest">Jugar sin cuenta</button>' : ''}
      </div>
      ${mode !== 'newPassword' ? '<p class="sub small-print">Solo guardamos tu correo y tu partida. La contraseña se guarda cifrada (hash) y nunca la vemos.</p>' : ''}
    </section>`;
  const form = app.querySelector('form');
  const msg = app.querySelector('#auth-msg');
  app.querySelector('.auth-links').addEventListener('click', (ev) => {
    const b = ev.target.closest('button');
    if (!b) return;
    if (b.dataset.mode) return showAuth(b.dataset.mode);
    setGuest(true);
    go('menu');
  });
  form.addEventListener('submit', async (ev) => {
    ev.preventDefault();
    const v = Object.fromEntries(new FormData(form));
    const problem = validate(mode, v);
    if (problem) return (msg.textContent = problem);
    const button = form.querySelector('[type="submit"]');
    button.disabled = true;
    msg.textContent = '';
    const r = await submit(mode, v);
    button.disabled = false;
    if (r?.error) msg.textContent = r.error;
  });
}

function validate(mode, v) {
  if ('email' in v && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(v.email.trim())) return 'Escribe un correo válido.';
  if ('password' in v && v.password.length < 8 && mode !== 'login') return 'La contraseña debe tener al menos 8 caracteres.';
  if ('password' in v && !v.password) return 'Escribe tu contraseña.';
  if ('password2' in v && v.password !== v.password2) return 'Las contraseñas no coinciden.';
  return null;
}

async function submit(mode, v) {
  const email = v.email?.trim();
  if (mode === 'login') {
    const r = await signIn(email, v.password);
    return r.error ? r : enterWithUser(r.data.user);
  }
  if (mode === 'register') {
    const r = await signUp(email, v.password);
    if (r.error) return r;
    if (r.data.session) return enterWithUser(r.data.user); // confirmación de correo desactivada
    return info('Revisa tu correo', `Te hemos enviado un enlace a <b>${escapeHtml(email)}</b> para confirmar la cuenta. Ábrelo en este dispositivo.`);
  }
  if (mode === 'forgot') {
    const r = await sendReset(email);
    if (r.error) return r;
    return info('Revisa tu correo', 'Si existe una cuenta con ese correo, recibirás un enlace para elegir una contraseña nueva.');
  }
  const r = await setPassword(v.password);
  if (r.error) return r;
  recovering = false;
  toast('Contraseña cambiada');
  go('menu');
}

function info(title, html) {
  app.innerHTML = `
    <section class="screen auth scenic">
      <h1 class="logo"><img src="img/ui/logo.webp" alt="DUSKFORGE"></h1>
      <div class="panel"><h3>${title}</h3><p>${html}</p></div>
      <button class="btn ghost" data-go="auth">Volver</button>
    </section>`;
}

const escapeHtml = (s) => s.replace(/[&<>"']/g, (c) => `&#${c.charCodeAt(0)};`);

// ---------- Contacto: el jugador escribe y lee aquí la respuesta (la damos desde Supabase, docs/soporte.md) ----------
export function showSupport() {
  const user = getCloudUser();
  app.innerHTML = `
    <section class="screen top">
      ${topBar('Contacto')}
      ${user ? `
      <form class="panel auth-form" novalidate>
        <h3>Contacta con nosotros</h3>
        <label>Tu mensaje<textarea name="message" rows="5" maxlength="2000" required></textarea></label>
        <p class="sub">Te responderemos aquí mismo. El mensaje se guarda cifrado.</p>
        <p class="warn" role="alert" id="support-msg"></p>
        <button class="btn gold" type="submit">Enviar</button>
      </form>
      <div class="support-list" aria-live="polite"><p class="sub">Cargando tus mensajes…</p></div>` : `
      <div class="panel"><h3>Contacta con nosotros</h3>
        <p class="sub">Para escribirnos y recibir la respuesta en el juego necesitas una cuenta.</p>
        <button class="btn small gold" data-go="auth">Entrar o crear cuenta</button></div>`}
    </section>`;
  if (!user) return;
  const form = app.querySelector('form');
  const list = app.querySelector('.support-list');
  form.addEventListener('submit', async (ev) => {
    ev.preventDefault();
    const text = form.message.value.trim();
    const msg = app.querySelector('#support-msg');
    if (!text) return (msg.textContent = 'Escribe tu mensaje.');
    const button = form.querySelector('[type="submit"]');
    button.disabled = true;
    const r = await sendSupport(text);
    button.disabled = false;
    msg.textContent = r.error ?? '';
    if (r.error) return;
    form.reset();
    toast('Mensaje enviado');
    loadSupport(list);
  });
  loadSupport(list);
}

async function loadSupport(list) {
  const r = await mySupport();
  if (!list.isConnected) return;
  if (r.error) return (list.innerHTML = `<p class="warn">${r.error}</p>`);
  const when = (t) => new Date(t).toLocaleString('es-ES', { dateStyle: 'short', timeStyle: 'short' });
  list.innerHTML = r.data.length ? r.data.map((m) => `
    <div class="panel">
      <span class="sub">Tú · ${when(m.created_at)}</span><p>${escapeHtml(m.message)}</p>
      ${m.reply ? `<div class="reply"><span class="sub">DUSKFORGE · ${when(m.replied_at)}</span><p>${escapeHtml(m.reply)}</p></div>`
        : '<p class="sub">Aún sin respuesta.</p>'}
    </div>`).join('') : '<p class="sub">Aún no nos has escrito.</p>';
  if (r.data.some((m) => m.reply && !m.reply_seen)) markSupportSeen();
}

// ---------- Panel de cuenta en Ajustes ----------
export function accountPanel() {
  const user = getCloudUser();
  return user
    ? `<div class="panel"><h3>Cuenta</h3>
        <p class="sub">Conectado como <b>${escapeHtml(user.email)}</b>. Tu partida se guarda en la nube.</p>
        <div class="modal-actions"><button class="btn small ghost" data-act="logout">Cerrar sesión</button>
        <button class="btn small danger" data-act="delete-account">Borrar cuenta</button></div></div>`
    : `<div class="panel"><h3>Cuenta</h3>
        <p class="sub">Sin cuenta: el progreso solo está en este dispositivo y se pierde si borras la app.</p>
        <button class="btn small gold" data-go="auth">Entrar o crear cuenta</button></div>`;
}

export async function accountAction(act) {
  if (act === 'logout') {
    await flushCloud();
    await signOut();
  } else if (act === 'delete-account') {
    if (!confirm('¿Borrar tu cuenta y tu partida de la nube para siempre? No se puede deshacer.')) return;
    const r = await deleteAccount();
    if (r.error) return toast(r.error);
    await signOut();
  } else return;
  setCloudUser(null);
  replaceProfile(null); // este dispositivo vuelve a empezar; la partida sigue en la cuenta (salvo si se borró)
  toast(act === 'logout' ? 'Sesión cerrada' : 'Cuenta borrada');
  go('auth');
}
