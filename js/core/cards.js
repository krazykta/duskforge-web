// Catálogo de cartas originales. Datos puros: el motor de reglas los interpreta.
//
// keywords:  guard  = Guardián (hay que atacarlo primero)
//            swift  = Ímpetu (puede atacar el turno en que entra)
//            shield = Escudo (anula el primer daño que recibe)
//            drain  = Vampírico (al atacar, cura a tu héroe lo que inflige)
// effect.trigger: play (al jugarla) | death (al morir) | spell (cuando lanzas un hechizo)
// effect.target:  enemy (unidad o héroe enemigo) | enemyUnit | allyUnit | (sin objetivo)

export const CARDS = [
  // --- Comunes ---
  { id: 'dusk_recruit', name: 'Recluta del Ocaso', type: 'unit', rarity: 'common', cost: 1, atk: 1, hp: 2, art: '🗡️' },
  { id: 'ash_bat', name: 'Murciélago de Ceniza', type: 'unit', rarity: 'common', cost: 1, atk: 1, hp: 1, keywords: ['swift'], art: '🦇' },
  { id: 'rune_squire', name: 'Escudero Rúnico', type: 'unit', rarity: 'common', cost: 2, atk: 1, hp: 3, keywords: ['guard'], art: '🛡️' },
  { id: 'flame_acolyte', name: 'Acólita de la Llama', type: 'unit', rarity: 'common', cost: 2, atk: 2, hp: 2, art: '🔥',
    effect: { trigger: 'play', kind: 'damage', amount: 1, target: 'enemy' } },
  { id: 'bronze_sentinel', name: 'Centinela de Bronce', type: 'unit', rarity: 'common', cost: 3, atk: 2, hp: 4, keywords: ['guard'], art: '🗿' },
  { id: 'arcane_librarian', name: 'Bibliotecario Arcano', type: 'unit', rarity: 'common', cost: 3, atk: 2, hp: 3, art: '📜',
    effect: { trigger: 'play', kind: 'draw', amount: 1 } },
  { id: 'night_leech', name: 'Sanguijuela Nocturna', type: 'unit', rarity: 'common', cost: 3, atk: 3, hp: 2, keywords: ['drain'], art: '🩸' },
  { id: 'spark', name: 'Chispa', type: 'spell', rarity: 'common', cost: 1, art: '✨',
    effect: { kind: 'damage', amount: 2, target: 'enemy' } },
  { id: 'moon_potion', name: 'Poción Lunar', type: 'spell', rarity: 'common', cost: 1, art: '🧪',
    effect: { kind: 'heal', amount: 4 } },
  { id: 'aegis', name: 'Égida', type: 'spell', rarity: 'common', cost: 1, art: '🔰',
    effect: { kind: 'shield', target: 'allyUnit' } },
  { id: 'dark_blessing', name: 'Bendición Oscura', type: 'spell', rarity: 'common', cost: 2, art: '🌑',
    effect: { kind: 'buff', amount: 2, target: 'allyUnit' } },

  // --- Raras ---
  { id: 'storm_apprentice', name: 'Aprendiz de Tormenta', type: 'unit', rarity: 'rare', cost: 2, atk: 1, hp: 3, art: '🌩️',
    effect: { trigger: 'spell', kind: 'buffSelf', amount: 1 } },
  { id: 'doom_herald', name: 'Heraldo Funesto', type: 'unit', rarity: 'rare', cost: 3, atk: 3, hp: 2, art: '💀',
    effect: { trigger: 'death', kind: 'damageHero', amount: 2 } },
  { id: 'spectral_knight', name: 'Caballero Espectral', type: 'unit', rarity: 'rare', cost: 4, atk: 3, hp: 4, keywords: ['shield'], art: '👻' },
  { id: 'lightning_rider', name: 'Jinete del Relámpago', type: 'unit', rarity: 'rare', cost: 4, atk: 4, hp: 2, keywords: ['swift'], art: '⚡' },
  { id: 'hive_matron', name: 'Matrona de la Colmena', type: 'unit', rarity: 'rare', cost: 4, atk: 2, hp: 3, art: '🐝',
    effect: { trigger: 'play', kind: 'summon', amount: 2, token: 'larva' } },
  { id: 'arcane_vision', name: 'Visión Arcana', type: 'spell', rarity: 'rare', cost: 2, art: '👁️',
    effect: { kind: 'draw', amount: 2 } },
  { id: 'lightning_lance', name: 'Lanza de Rayo', type: 'spell', rarity: 'rare', cost: 3, art: '🔱',
    effect: { kind: 'damage', amount: 4, target: 'enemy' } },

  // --- Épicas ---
  { id: 'obsidian_colossus', name: 'Coloso de Obsidiana', type: 'unit', rarity: 'epic', cost: 5, atk: 5, hp: 6, keywords: ['guard'], art: '🪨' },
  { id: 'pack_lord', name: 'Señor de la Manada', type: 'unit', rarity: 'epic', cost: 5, atk: 3, hp: 3, art: '🐺',
    effect: { trigger: 'play', kind: 'growPerAlly', amount: 1 } },
  { id: 'ash_storm', name: 'Tormenta de Ceniza', type: 'spell', rarity: 'epic', cost: 4, art: '🌪️',
    effect: { kind: 'damageAllEnemies', amount: 2 } },

  // --- Legendarias ---
  { id: 'eclipse_dragon', name: 'Dragón del Eclipse', type: 'unit', rarity: 'legendary', cost: 5, atk: 5, hp: 5, art: '🐉',
    effect: { trigger: 'play', kind: 'damage', amount: 3, target: 'enemy' } },
  { id: 'ember_queen', name: 'Reina de las Brasas', type: 'unit', rarity: 'legendary', cost: 5, atk: 4, hp: 4, keywords: ['swift', 'drain'], art: '👑' },
  { id: 'archmage_velkar', name: 'Archimago Velkar', type: 'unit', rarity: 'legendary', cost: 4, atk: 2, hp: 4, art: '🧙',
    effect: { trigger: 'spell', kind: 'damageHero', amount: 1 } },

  // --- Fichas (no coleccionables) ---
  { id: 'larva', name: 'Larva', type: 'unit', rarity: 'common', cost: 0, atk: 1, hp: 1, art: '🐛', token: true },
];

export const CARD_BY_ID = Object.fromEntries(CARDS.map((c) => [c.id, c]));

export const KEYWORD_TEXT = {
  guard: 'Guardián',
  swift: 'Ímpetu',
  shield: 'Escudo',
  drain: 'Vampírico',
};

const TARGET_TEXT = { enemy: 'a un enemigo', enemyUnit: 'a una criatura enemiga', allyUnit: 'a una criatura aliada' };
const TRIGGER_TEXT = { play: 'Al jugarla: ', death: 'Al morir: ', spell: 'Cuando lanzas un hechizo: ' };

// Texto de reglas legible, generado a partir de los datos (una sola fuente de verdad).
export function cardText(card) {
  const parts = (card.keywords || []).map((k) => KEYWORD_TEXT[k]);
  const e = card.effect;
  if (e) {
    const t = TARGET_TEXT[e.target] || '';
    const body = {
      damage: `inflige ${e.amount} de daño ${t}`,
      damageAllEnemies: `inflige ${e.amount} de daño a todas las criaturas enemigas`,
      damageHero: `inflige ${e.amount} de daño al héroe enemigo`,
      heal: `cura ${e.amount} a tu héroe`,
      draw: `roba ${e.amount} carta${e.amount > 1 ? 's' : ''}`,
      shield: `da Escudo ${t}`,
      buff: `da +${e.amount}/+${e.amount} ${t}`,
      summon: `invoca ${e.amount} ${CARD_BY_ID[e.token]?.name ?? e.token} 1/1`,
      growPerAlly: `gana +${e.amount}/+${e.amount} por cada otra criatura aliada`,
      buffSelf: `gana +${e.amount} de ataque`,
    }[e.kind];
    const text = (TRIGGER_TEXT[e.trigger] || '') + body;
    parts.push(text.charAt(0).toUpperCase() + text.slice(1) + '.');
  }
  return parts.join('. ');
}
