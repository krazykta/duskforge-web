// Todos los números de equilibrio en un solo sitio. Son hipótesis iniciales:
// cámbialos aquí y no en el código de reglas.
export const GAME_NAME = 'CARD CLASH: ARENA';

export const RULES = {
  startHp: 20,
  deckSize: 12,
  startHand: 3,
  secondPlayerExtraCards: 1, // compensa al jugador que empieza segundo
  maxHand: 7, // si robas con la mano llena, la carta se quema
  startEnergy: 1,
  maxEnergy: 5,
  boardSize: 5,
  fatigueDamage: 2, // daño al robar con el mazo vacío
};

export const ECONOMY = {
  winCoins: 30,
  lossCoins: 15,
  winXp: 50,
  lossXp: 20,
  firstWinOfDayCoins: 50,
  xpPerLevel: 100,
};

export const STARTER_DECK = [
  'dusk_recruit', 'dusk_recruit', 'ash_bat', 'rune_squire', 'flame_acolyte', 'bronze_sentinel',
  'arcane_librarian', 'night_leech', 'spark', 'spark', 'moon_potion', 'lightning_lance',
];

export const AI_DECK = [
  'ash_bat', 'ash_bat', 'rune_squire', 'flame_acolyte', 'night_leech', 'doom_herald',
  'storm_apprentice', 'lightning_rider', 'spark', 'dark_blessing', 'aegis', 'arcane_vision',
];
