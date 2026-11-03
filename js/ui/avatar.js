// Avatar del perfil: el héroe, la ilustración de una carta que se tiene o una foto de la galería o la cámara.
// La foto se queda en este dispositivo (PHOTO_KEY): no se sube a ningún sitio y en otro móvil se ve el héroe.
import { CARD_BY_ID } from '../core/cards.js';
import { CARD_ART } from './card-art.js';
import { PHOTO_KEY, getProfile, savePrefs, toast } from './store.js';
import { icon } from './icons.js';

const HERO = 'img/ui/hero_player.webp';
const PHOTO_PX = 192; // el avatar más grande mide 96 px: el doble basta para pantallas de alta densidad
const MAX_FILE = 25 * 1024 * 1024;
const RARITY_ORDER = ['legendary', 'epic', 'rare', 'common'];

const storedPhoto = () => { try { return localStorage.getItem(PHOTO_KEY); } catch { return null; } };

export function avatarSrc(p = getProfile()) {
  if (p.avatar === 'photo') return storedPhoto() ?? HERO;
  if (p.avatar?.startsWith('card:')) return `img/cards/${p.avatar.slice(5)}.webp`;
  return HERO;
}

// El marco equipado rodea la imagen; cls cambia el tamaño (ver .avatar en styles.css).
export const avatarHtml = (p = getProfile(), cls = '') =>
  `<span class="avatar ${p.cosmetics.frame ? `c-${p.cosmetics.frame}` : ''} ${cls}"><img src="${avatarSrc(p)}" alt="" draggable="false"></span>`;

// Recorta el centro en cuadrado y lo reduce: una foto del móvil pesa megas y el avatar cabe en unos 15 KB.
async function shrinkPhoto(file) {
  const bmp = await createImageBitmap(file); // respeta la orientación EXIF de la cámara
  const side = Math.min(bmp.width, bmp.height);
  const canvas = document.createElement('canvas');
  canvas.width = canvas.height = PHOTO_PX;
  canvas.getContext('2d').drawImage(bmp, (bmp.width - side) / 2, (bmp.height - side) / 2, side, side, 0, 0, PHOTO_PX, PHOTO_PX);
  bmp.close();
  return canvas.toDataURL('image/jpeg', 0.85);
}

// El navegador (o Android) pide el permiso de cámara o de fotos al abrir el selector: la web no los pide por su cuenta.
function pickPhoto(camera, done) {
  const input = document.createElement('input');
  input.type = 'file';
  input.accept = 'image/*';
  if (camera) input.capture = 'user';
  input.addEventListener('change', async () => {
    const file = input.files[0];
    if (!file) return;
    if (!file.type.startsWith('image/') || file.size > MAX_FILE) return toast('Elige una imagen de menos de 25 MB');
    try {
      localStorage.setItem(PHOTO_KEY, await shrinkPhoto(file));
    } catch {
      return toast('No se ha podido usar esa imagen. Prueba con otra en JPG o PNG.');
    }
    savePrefs({ avatar: 'photo' });
    done();
  });
  input.click();
}

export function showAvatarPicker(onChange) {
  const p = getProfile();
  const cards = Object.keys(p.collection).map((id) => CARD_BY_ID[id]).filter((c) => c && CARD_ART.has(c.id))
    .sort((a, b) => RARITY_ORDER.indexOf(a.rarity) - RARITY_ORDER.indexOf(b.rarity) || a.name.localeCompare(b.name, 'es'));
  const bg = document.createElement('div');
  bg.className = 'modal-bg';
  bg.innerHTML = `
    <div class="modal avatar-picker" role="dialog" aria-label="Elegir avatar">
      <h2>Tu avatar</h2>
      <div class="modal-actions">
        <button class="btn small" data-photo="camera">${icon('camera')}Hacer foto</button>
        <button class="btn small" data-photo="gallery">${icon('image')}Galería</button>
        <button class="btn small ghost ${p.avatar ? '' : 'on'}" data-pick="">${icon('user')}Héroe</button>
      </div>
      <p class="sub">Tu foto se guarda solo en este dispositivo: no se sube a ningún sitio ni la ve nadie más.</p>
      <h3>Tus cartas <span class="sub">(${cards.length})</span></h3>
      <div class="avatar-grid">${cards.map((c) => `
        <button class="avatar-opt r-${c.rarity} ${p.avatar === `card:${c.id}` ? 'on' : ''}" data-pick="card:${c.id}" aria-label="${c.name}">
          <img src="img/cards/${c.id}.webp" alt="" loading="lazy" draggable="false"></button>`).join('')}</div>
      <button class="btn ghost" data-act="close">Cerrar</button>
    </div>`;
  document.body.appendChild(bg);
  const close = () => { bg.remove(); onChange(); };
  bg.addEventListener('click', (ev) => {
    const photo = ev.target.closest('[data-photo]')?.dataset.photo;
    if (photo) return pickPhoto(photo === 'camera', close);
    const pick = ev.target.closest('[data-pick]')?.dataset.pick;
    if (pick !== undefined) {
      savePrefs({ avatar: pick || null });
      return close();
    }
    if (ev.target.closest('[data-act="close"]') || ev.target === bg) close();
  });
}
