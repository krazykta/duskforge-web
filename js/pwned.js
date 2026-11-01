// Contraseñas filtradas: comprobación propia porque la de Supabase exige el plan Pro.
// Solo salen los 5 primeros caracteres del SHA-1 (k-anonimato): ni la contraseña ni su hash completo.
// shortcut: quien llame directo a Supabase se la salta, y solo debilitaría su propia cuenta; con plan Pro, activar la del servidor.
const RANGE_URL = 'https://api.pwnedpasswords.com/range/';

export async function isPwned(password) {
  try {
    const digest = await crypto.subtle.digest('SHA-1', new TextEncoder().encode(password));
    const hash = [...new Uint8Array(digest)].map((b) => b.toString(16).padStart(2, '0')).join('').toUpperCase();
    const res = await fetch(RANGE_URL + hash.slice(0, 5), { headers: { 'Add-Padding': 'true' }, signal: AbortSignal.timeout(4000) });
    if (!res.ok) return false;
    const rows = (await res.text()).split('\n').map((line) => line.trim().split(':'));
    return rows.some(([suffix, seen]) => suffix === hash.slice(5) && Number(seen) > 0); // el relleno llega con 0
  } catch {
    return false; // sin red o sin servicio no se bloquea a nadie
  }
}
