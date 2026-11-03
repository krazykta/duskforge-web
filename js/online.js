// Salas para jugar con amigos: un canal de Supabase Realtime por sala. No toca la base de datos ni pide cuenta.
// Los dos móviles ejecutan el mismo motor con la misma semilla y solo se envían las jugadas.
// shortcut: quien modifique su cliente puede ver la mano rival y elegir semilla; las amistosas no dan premios.
// shortcut: si el móvil pierde la conexión la partida termina; reconectar exigiría guardar las jugadas en el servidor.
import { sb } from './cloud.js';

const LETTERS = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789'; // sin 0/O ni 1/I, que se confunden al dictarlos
export const CODE_LENGTH = 6;
export const newRoomCode = () => [...crypto.getRandomValues(new Uint8Array(CODE_LENGTH))].map((n) => LETTERS[n % LETTERS.length]).join('');
export const cleanRoomCode = (text) => text.toUpperCase().replace(/[^A-Z0-9]/g, '').slice(0, CODE_LENGTH);

export async function openRoom(code) {
  if (!sb) return null;
  const id = crypto.randomUUID();
  const inbox = [];
  let waiting = null;
  let peer = null;
  const room = {
    id,
    onStop: null, // el rival se rinde o se va: llega aunque no se esté esperando una jugada
    setPeer: (who) => (peer = who),
    send: (msg) => channel.send({ type: 'broadcast', event: 'm', payload: { ...msg, from: id } }),
    // Devuelve el siguiente mensaje, o null si pasan ms sin ninguno.
    receive: (ms = 0) => new Promise((done) => {
      if (inbox.length) return done(inbox.shift());
      waiting = done;
      if (ms) setTimeout(() => {
        if (waiting !== done) return;
        waiting = null;
        done(null);
      }, ms);
    }),
    close: () => sb.removeChannel(channel),
  };
  const channel = sb.channel(`sala-${code}`, { config: { broadcast: { ack: true }, presence: { key: id } } });
  channel.on('broadcast', { event: 'm' }, ({ payload }) => {
    if (peer && payload?.from !== peer) return; // la sala es de dos: lo demás es un tercero con el código
    if (payload?.type === 'concede') return room.onStop?.(payload);
    if (!waiting) return inbox.push(payload);
    const done = waiting;
    waiting = null;
    done(payload);
  });
  channel.on('presence', { event: 'leave' }, ({ key }) => {
    if (key === peer) room.onStop?.({ type: 'left' });
  });
  const joined = await new Promise((done) => {
    channel.subscribe((status) => {
      if (status === 'SUBSCRIBED') done(true);
      else if (status !== 'CLOSED') done(false); // CHANNEL_ERROR o TIMED_OUT
    });
  });
  if (!joined) {
    room.close();
    return null;
  }
  await channel.track({});
  return room;
}

// Invitaciones de amigos (tabla invites, decisión 41): Realtime avisa de cada una nueva; RLS solo deja oír las tuyas.
export function listenInvites(uid, onInvite) {
  if (!sb) return () => {};
  const channel = sb.channel(`invites-${uid}`)
    .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'invites', filter: `to_id=eq.${uid}` }, ({ new: row }) => onInvite(row))
    .subscribe();
  return () => sb.removeChannel(channel);
}
