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

export const COLLECTION = {
  maxCopies: 2, // copias por carta (en colección y en mazo)
  legendaryMaxCopies: 1,
  // Fragmentos que da una copia que ya no cabe en la colección.
  duplicateFragments: { common: 5, rare: 20, epic: 50, legendary: 150 },
  craftCost: { common: 30, rare: 80, epic: 200, legendary: 600 },
  foilCost: { common: 20, rare: 50, epic: 120, legendary: 300 }, // mejora cosmética
  historySize: 20,
};

export const PACK = {
  name: 'Sobre básico',
  price: 100,
  cards: 3,
  // Probabilidad de rareza de CADA carta. Dentro de una rareza todas las cartas son igual de probables.
  odds: { common: 0.7, rare: 0.22, epic: 0.065, legendary: 0.015 },
};

// Misiones: "stat" es la estadística que las hace avanzar (ver core/missions.js).
export const MISSIONS = {
  dailyCount: 3,
  daily: [
    { id: 'd_win2', text: 'Gana 2 partidas', stat: 'wins', goal: 2, coins: 60 },
    { id: 'd_play3', text: 'Juega 3 partidas', stat: 'matches', goal: 3, coins: 50 },
    { id: 'd_spells5', text: 'Lanza 5 hechizos', stat: 'spells', goal: 5, coins: 50 },
    { id: 'd_units8', text: 'Juega 8 criaturas', stat: 'units', goal: 8, coins: 50 },
    { id: 'd_face25', text: 'Inflige 25 de daño al héroe rival', stat: 'heroDamage', goal: 25, coins: 70 },
    { id: 'd_kill6', text: 'Destruye 6 criaturas enemigas', stat: 'kills', goal: 6, coins: 60 },
  ],
  weekly: [
    { id: 'w_win10', text: 'Gana 10 partidas', stat: 'wins', goal: 10, coins: 200, fragments: 30 },
    { id: 'w_play20', text: 'Juega 20 partidas', stat: 'matches', goal: 20, coins: 150, fragments: 20 },
    { id: 'w_packs3', text: 'Abre 3 sobres', stat: 'packs', goal: 3, coins: 100, fragments: 20 },
  ],
};

export const STARTER_DECK = [
  'dusk_recruit', 'dusk_recruit', 'ash_bat', 'rune_squire', 'flame_acolyte', 'bronze_sentinel',
  'arcane_librarian', 'night_leech', 'spark', 'spark', 'moon_potion', 'lightning_lance',
];

export const AI_DECK = [
  'ash_bat', 'ash_bat', 'rune_squire', 'flame_acolyte', 'night_leech', 'doom_herald',
  'storm_apprentice', 'lightning_rider', 'spark', 'dark_blessing', 'aegis', 'arcane_vision',
];
