// Cuenta (correo + contraseña) y partida guardada en Supabase.
// La clave publicable NO es secreta: está pensada para ir en la app. Los datos los protege
// RLS en la base de datos (cada usuario solo puede leer su fila; escribirla, solo la función game).
import { API_VERSION } from './core/config.js';

const GAME_TIMEOUT_MS = 15000;
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

// Todo lo que cambia la partida guardada pasa por la función game (supabase/functions/game).
// offline: no ha habido respuesta válida, se puede reintentar. Los errores de juego vienen en { error }.
export async function callGame(op, args) {
  if (!sb) return { error: 'Sin conexión con el servidor.', offline: true };
  try {
    const session = (await sb.auth.getSession()).data.session;
    const res = await fetch(`${SUPABASE_URL}/functions/v1/game`, {
      method: 'POST',
      headers: { Authorization: `Bearer ${session?.access_token}`, apikey: SUPABASE_KEY, 'Content-Type': 'application/json' },
      body: JSON.stringify({ v: API_VERSION, op, args }),
      signal: AbortSignal.timeout(GAME_TIMEOUT_MS),
    });
    const body = await res.json();
    return res.ok ? body : { ...body, offline: true };
  } catch {
    return { error: 'Sin conexión con el servidor.', offline: true };
  }
}
