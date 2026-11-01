// Cuenta (correo + contraseña) y partida guardada en Supabase.
// La clave publicable NO es secreta: está pensada para ir en la app. Los datos los protege
// RLS en la base de datos (cada usuario solo puede leer y escribir su propia fila).
const SUPABASE_URL = 'https://opcpyzzctddsflfhriga.supabase.co';
const SUPABASE_KEY = 'sb_publishable_7o0PA0opdwOK_yXbisR_PQ_LoJv476Y';

// Si la librería no cargó (sin red la primera vez), el juego sigue funcionando sin cuenta.
export const sb = window.supabase ? window.supabase.createClient(SUPABASE_URL, SUPABASE_KEY) : null;

const ERRORS = {
  invalid_credentials: 'Correo o contraseña incorrectos.',
  email_not_confirmed: 'Confirma tu correo primero: revisa tu bandeja de entrada.',
  user_already_exists: 'Ya existe una cuenta con ese correo.',
  weak_password: 'La contraseña es demasiado débil.',
  over_email_send_rate_limit: 'Se han enviado demasiados correos. Prueba dentro de un rato.',
  email_address_not_authorized: 'Ahora mismo solo se pueden enviar correos a direcciones autorizadas (modo pruebas).',
  same_password: 'La nueva contraseña debe ser distinta de la anterior.',
  DF400: 'El mensaje debe tener entre 1 y 2000 caracteres.', // códigos propios de supabase/migrations/0002_support.sql
  DF429: 'Ya has enviado 5 mensajes hoy. Te responderemos lo antes posible.',
};
const message = (error) => ERRORS[error.code] || 'No se pudo completar. Comprueba tu conexión e inténtalo de nuevo.';
// Los enlaces de los correos vuelven aquí; en local o en la app nativa se usa la Site URL de Supabase.
const backHere = () => (location.protocol === 'https:' ? location.origin + location.pathname : undefined);

async function call(promise) {
  if (!sb) return { error: 'Sin conexión con el servidor.' };
  try {
    const { data, error } = await promise;
    return error ? { error: message(error), code: error.code } : { data };
  } catch {
    return { error: 'Sin conexión con el servidor.' };
  }
}

export const currentUser = async () => (sb ? (await sb.auth.getSession()).data.session?.user ?? null : null);
export const signUp = (email, password) => call(sb?.auth.signUp({ email, password, options: { emailRedirectTo: backHere() } }));
export const signIn = (email, password) => call(sb?.auth.signInWithPassword({ email, password }));
export const signOut = () => call(sb?.auth.signOut());
export const sendReset = (email) => call(sb?.auth.resetPasswordForEmail(email, { redirectTo: backHere() }));
export const setPassword = (password) => call(sb?.auth.updateUser({ password }));
export const deleteAccount = () => call(sb?.rpc('delete_my_account'));
// Soporte: los mensajes se guardan cifrados y solo se leen con estas funciones (ver docs/soporte.md).
export const sendSupport = (message) => call(sb?.rpc('send_support_message', { message }));
export const mySupport = () => call(sb?.rpc('my_support_messages'));
export const markSupportSeen = () => call(sb?.rpc('mark_support_seen'));

export async function pullProfile(userId) {
  const r = await call(sb?.from('profiles').select('data, rev').eq('id', userId).maybeSingle());
  return r.error ? r : { data: r.data?.data ?? null, rev: r.data?.rev ?? null };
}

// Guarda solo si la fila sigue en la versión que leímos (rev); sin rev es la primera vez que se sube.
// El servidor revisa cada guardado (supabase/migrations/0003_profile_guard.sql).
export async function saveProfile(userId, data, rev) {
  const r = await call(rev === null
    ? sb?.from('profiles').insert({ id: userId, data }).select('rev').single()
    : sb?.from('profiles').update({ data }).eq('id', userId).eq('rev', rev).select('rev').maybeSingle());
  if (r.code === 'DF422') return { rejected: true };
  if (r.code === 'DF409' || r.code === '23505' || (!r.error && !r.data)) return { conflict: true };
  return r.error ? r : { rev: r.data.rev };
}
