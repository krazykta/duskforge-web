// Todos los números de equilibrio en un solo sitio. Son hipótesis iniciales:
// cámbialos aquí y no en el código de reglas.
export const GAME_NAME = 'DUSKFORGE';

export const RULES = {
  startHp: 20,
  deckSize: 24,
  startHand: 4, // igual para los dos: quien empieza no roba en su primer turno
  maxHand: 7, // si robas con la mano llena, la carta se quema
  startEnergy: 1,
  maxEnergy: 5,
  boardSize: 10,
  fatigueDamage: 2, // daño al robar con el mazo vacío
};

export const API_VERSION = 5; // súbelo si cambia lo que el juego y la función de Supabase se envían

// Vida inicial del rival según el nivel del jugador (ver aiHp en core/replay.js). Del nivel 1 al fullAt sube de start
// a RULES.startHp: el mazo inicial gana el 74 % con 8 y el 46 % con 20. Después, +1 cada everyLevels niveles hasta max.
export const AI_HP = { start: 8, fullAt: 10, everyLevels: 2, max: 30 };

// Arena (decisión 42, core/arena.js): el mazo de otro jugador con trofeos parecidos, llevado por la IA.
// La derrota se descuenta al empezar: cerrar la app a media partida no la evita.
export const ARENA = {
  win: 30,
  loss: 20,
  spread: 150, // trofeos de diferencia con el rival, como mucho
  fallbackLevels: 6, // sin rivales cerca, la IA de siempre: +3 de vida por cada arena (ver aiHp)
  arenas: [
    { name: 'Forja de Novatos', from: 0, winBonus: 0 },
    { name: 'Cripta Olvidada', from: 300, winBonus: 10 },
    { name: 'Cumbres de Escarcha', from: 700, winBonus: 20 },
    { name: 'Trono del Ocaso', from: 1200, winBonus: 35 },
  ],
};

// Reto diario (decisión 43, core/daily.js): la misma partida para todos cada día; gana quien lo haga en menos turnos.
export const DAILY = { coins: 100, top: 10, url: 'https://krazykta.github.io/duskforge-web/' };

export const ECONOMY = {
  winCoins: 30,
  lossCoins: 15,
  winXp: 50,
  lossXp: 20,
  firstWinOfDayCoins: 50,
  pursePerLevel: 5, // monedas extra por victoria con cada nivel de la mejora Bolsa de botín
  xpPerLevel: 100,
  dailyMatches: 100, // partidas al día con recompensa: nadie honrado llega y limita a los bots
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

// Más cartas por sobre y la última siempre rara o mejor: ayuda a completar una colección grande.
export const BIG_PACK = {
  name: 'Sobre grande',
  price: 180,
  cards: 5,
  odds: PACK.odds,
  lastOdds: { common: 0, rare: 0.75, epic: 0.2, legendary: 0.05 },
};
export const CHEST = {
  name: 'Cofre de coleccionista',
  price: 340,
  cards: 10,
  odds: PACK.odds,
  lastOdds: BIG_PACK.lastOdds,
};
export const EPIC_PACK = {
  name: 'Sobre épico',
  price: 400,
  cards: 5,
  odds: PACK.odds,
  lastOdds: { common: 0, rare: 0, epic: 0.85, legendary: 0.15 },
};
export const LEGEND_PACK = {
  name: 'Sobre legendario',
  price: 900,
  cards: 5,
  odds: PACK.odds,
  lastOdds: { common: 0, rare: 0, epic: 0, legendary: 1 },
};
export const PACKS = [PACK, BIG_PACK, CHEST, EPIC_PACK, LEGEND_PACK];

// Regalo único de bienvenida y agradecimiento por probar el juego.
export const WELCOME_GIFT = {
  coins: 800,
  packs: [{ pack: EPIC_PACK, count: 3, text: 'sobres épicos' }, { pack: LEGEND_PACK, count: 2, text: 'sobres legendarios' }],
};

// Solo se recoge lo que se muestra, así que recordar más de lo que se muestra impide cobrar dos veces un mensaje antiguo.
export const MAIL = { shown: 30, remembered: 100 };

// Escaparate del día: igual para todos y distinto cada día (ver core/shop.js). Cada artículo se compra una vez al día.
export const SHOP = { slots: ['common', 'common', 'rare', 'rare', 'epic', 'legendary'], dealOff: 0.4, offersPerDay: 3 };
export const CARD_PRICE = { common: 60, rare: 160, epic: 400, legendary: 1200 };
export const OFFERS = [
  { id: 'o_big', name: 'Sobre grande', text: '5 cartas, la última rara o mejor', was: 180, price: 120, pack: BIG_PACK },
  { id: 'o_chest', name: 'Cofre de coleccionista', text: '10 cartas, la última rara o mejor', was: 340, price: 240, pack: CHEST },
  { id: 'o_epic', name: 'Sobre épico', text: '5 cartas, la última épica o mejor', was: 400, price: 280, pack: EPIC_PACK },
  { id: 'o_legend', name: 'Sobre legendario', text: '5 cartas, la última legendaria', was: 900, price: 650, pack: LEGEND_PACK },
  { id: 'o_frags', name: 'Saco de fragmentos', text: '200 fragmentos para fabricar lo que quieras', price: 150, fragments: 200 },
];

// Mejoras permanentes; cada precio es un nivel. No hay ninguna de XP: el servidor rechaza la que no sale de las partidas.
export const UPGRADES = [
  { id: 'deck', name: 'Hueco de mazo', text: 'Un mazo guardado más.', prices: [300, 800] },
  { id: 'purse', name: 'Bolsa de botín', text: `+${ECONOMY.pursePerLevel} monedas por victoria.`, prices: [500, 1200, 2500] },
];

// Coleccionables: no cambian el combate. Sin precio solo se consiguen en el pase. Su aspecto está en styles.css (.c-<id>).
// La rareza es como la de las cartas y sube con el precio.
export const COSMETICS = [
  // Marcos ilustrados (img/frames/<id>.webp): cuanto más trabajado y más efectos (styles.css), más caro.
  { id: 'frame_iron', kind: 'frame', name: 'Hierro forjado', rarity: 'common', price: 300 },
  { id: 'frame_bronze', kind: 'frame', name: 'Laurel de bronce', rarity: 'common', price: 300 },
  { id: 'frame_bone', kind: 'frame', name: 'Osario', rarity: 'common', price: 350 },
  { id: 'frame_wood', kind: 'frame', name: 'Raíces antiguas', rarity: 'common', price: 400 },
  { id: 'frame_silver', kind: 'frame', name: 'Plata rúnica', rarity: 'rare', price: 750 },
  { id: 'frame_frost', kind: 'frame', name: 'Corona de escarcha', rarity: 'rare', price: 800 },
  { id: 'frame_jade', kind: 'frame', name: 'Serpiente de jade', rarity: 'rare', price: 850 },
  { id: 'frame_rose', kind: 'frame', name: 'Rosa espinada', rarity: 'rare', price: 900 },
  { id: 'frame_amethyst', kind: 'frame', name: 'Cristal arcano', rarity: 'epic', price: 1600 },
  { id: 'frame_ember', kind: 'frame', name: 'Anillo de magma', rarity: 'epic', price: 1700 },
  { id: 'frame_abyss', kind: 'frame', name: 'Fauces del abismo', rarity: 'epic', price: 1800 },
  { id: 'frame_bat', kind: 'frame', name: 'Alas de la noche', rarity: 'epic', price: 1900 },
  { id: 'frame_dragon', kind: 'frame', name: 'Dragón dorado', rarity: 'legendary', price: 3200 },
  { id: 'frame_dusk', kind: 'frame', name: 'Sol del Ocaso', rarity: 'legendary', price: 3400 },
  { id: 'frame_forge', kind: 'frame', name: 'Forja Eterna', rarity: 'legendary', price: 3600 },
  { id: 'frame_seraph', kind: 'frame', name: 'Alas del alba', rarity: 'legendary', price: 4000 },
  { id: 'banner_night', kind: 'banner', name: 'Noche estrellada', rarity: 'common', price: 200 },
  { id: 'banner_moss', kind: 'banner', name: 'Bosque de musgo', rarity: 'common', price: 200 },
  { id: 'banner_ember', kind: 'banner', name: 'Brasas', rarity: 'rare', price: 450 },
  { id: 'banner_frost', kind: 'banner', name: 'Ventisca', rarity: 'rare', price: 450 },
  { id: 'banner_abyss', kind: 'banner', name: 'Abismo', rarity: 'epic', price: 900 },
  { id: 'banner_blood', kind: 'banner', name: 'Luna de sangre', rarity: 'epic', price: 900 },
  { id: 'banner_gold', kind: 'banner', name: 'Oro de la forja', rarity: 'legendary', price: 1800 },
  { id: 'back_ember', kind: 'back', name: 'Dorso de ascuas', rarity: 'common', price: 300 },
  { id: 'back_jade', kind: 'back', name: 'Dorso de jade', rarity: 'common', price: 300 },
  { id: 'back_abyss', kind: 'back', name: 'Dorso del abismo', rarity: 'common', price: 300 },
  { id: 'back_ash', kind: 'back', name: 'Dorso de ceniza', rarity: 'common', price: 300 },
  { id: 'back_frost', kind: 'back', name: 'Dorso de escarcha', rarity: 'common', price: 300 },
  { id: 'back_venom', kind: 'back', name: 'Dorso de veneno', rarity: 'rare', price: 400 },
  { id: 'back_rose', kind: 'back', name: 'Dorso de rosas', rarity: 'rare', price: 400 },
  { id: 'back_blood', kind: 'back', name: 'Dorso de sangre', rarity: 'rare', price: 500 },
  { id: 'back_storm', kind: 'back', name: 'Dorso de tormenta', rarity: 'rare', price: 500 },
  { id: 'back_void', kind: 'back', name: 'Dorso del vacío', rarity: 'epic', price: 700 },
  { id: 'back_sun', kind: 'back', name: 'Dorso solar', rarity: 'epic', price: 800 },
  { id: 'back_s1', kind: 'back', name: 'Dorso de la temporada', rarity: 'rare' },
  { id: 'back_s1f', kind: 'back', name: 'Dorso de la forja', rarity: 'epic' },
  { id: 'back_s1p', kind: 'back', name: 'Dorso dorado', rarity: 'legendary' },
  { id: 'title_wander', kind: 'title', name: 'Errante del Ocaso', rarity: 'common', price: 150 },
  { id: 'title_ember', kind: 'title', name: 'Llama Indómita', rarity: 'common', price: 200 },
  { id: 'title_forge', kind: 'title', name: 'Alma de la Forja', rarity: 'common', price: 250 },
  { id: 'title_dusk', kind: 'title', name: 'Eco del Crepúsculo', rarity: 'common', price: 300 },
  { id: 'title_ash', kind: 'title', name: 'Filo de Ceniza', rarity: 'rare', price: 350 },
  { id: 'title_abyss', kind: 'title', name: 'Voz del Abismo', rarity: 'rare', price: 400 },
  { id: 'title_nameless', kind: 'title', name: 'Sombra sin Nombre', rarity: 'rare', price: 500 },
  { id: 'title_heart', kind: 'title', name: 'Corazón de Brasa', rarity: 'epic', price: 600 },
  { id: 'title_legend', kind: 'title', name: 'Leyenda Viva', rarity: 'legendary', price: 1000 },
  { id: 'title_myth', kind: 'title', name: 'Mito del Ocaso', rarity: 'legendary', price: 1500 },
  { id: 'title_s1', kind: 'title', name: 'Ascua Eterna', rarity: 'epic' },
  { id: 'title_s1p', kind: 'title', name: 'Corona de Ascuas', rarity: 'legendary' },
];
// La mesa de combate no es un coleccionable: la elige el juego (más adelante, según la arena).
export const COSMETIC_KINDS = { frame: 'Marcos de avatar', banner: 'Estandartes del perfil', back: 'Dorsos de carta', title: 'Títulos' };

// Pase de temporada: las casillas se ganan con la XP de las partidas. pack es un índice de PACKS.
// Las casillas reclamadas se guardan como logros (s1_5, s1p_5) y el servidor las paga igual: al cambiar
// o sumar temporada hay que copiar sus recompensas en el guard (lo comprueba test/server-guard.test.js).
function seasonTier(n) {
  const free = { 15: { cosmetic: 'title_s1' }, 30: { cosmetic: 'back_s1' } }[n]
    ?? (n % 5 === 0 ? { pack: 1 } : n % 2 ? { coins: 40 } : { fragments: 30 });
  const premium = { 10: { cosmetic: 'back_s1f' }, 20: { cosmetic: 'title_s1p' }, 30: { cosmetic: 'back_s1p' } }[n]
    ?? (n % 5 === 0 ? { pack: 3 } : n % 2 ? { coins: 80 } : { fragments: 60 });
  return { free, premium };
}
export const SEASON = {
  id: 's1',
  name: 'Ascuas del Ocaso',
  ends: '2027-02-01',
  xpPerTier: 100,
  sku: 'pass_s1', // producto que desbloquea la vía premium (tabla entitlements, ver docs/pagos.md)
  tiers: Array.from({ length: 30 }, (_, i) => seasonTier(i + 1)),
};
export const tierId = (n, premium) => `${SEASON.id}${premium ? 'p' : ''}_${n}`;

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

// Logros permanentes: se cumplen con el estado del perfil y se reclaman una sola vez (ver core/achievements.js).
// stat: wins, level, unique (cartas distintas), legendaries (legendarias distintas), foils (brillantes).
export const ACHIEVEMENTS = [
  { id: 'a_win1', text: 'Gana tu primera partida', stat: 'wins', goal: 1, coins: 50 },
  { id: 'a_win10', text: 'Gana 10 partidas', stat: 'wins', goal: 10, coins: 150 },
  { id: 'a_win50', text: 'Gana 50 partidas', stat: 'wins', goal: 50, coins: 300, fragments: 100 },
  { id: 'a_win100', text: 'Gana 100 partidas', stat: 'wins', goal: 100, coins: 500, fragments: 200 },
  { id: 'a_lvl5', text: 'Llega a nivel 5', stat: 'level', goal: 5, coins: 100 },
  { id: 'a_lvl10', text: 'Llega a nivel 10', stat: 'level', goal: 10, coins: 200, fragments: 50 },
  { id: 'a_lvl25', text: 'Llega a nivel 25', stat: 'level', goal: 25, coins: 500, fragments: 150 },
  { id: 'a_col50', text: 'Consigue 50 cartas distintas', stat: 'unique', goal: 50, coins: 100 },
  { id: 'a_col100', text: 'Consigue 100 cartas distintas', stat: 'unique', goal: 100, coins: 200, fragments: 50 },
  { id: 'a_col200', text: 'Consigue 200 cartas distintas', stat: 'unique', goal: 200, coins: 400, fragments: 100 },
  { id: 'a_col300', text: 'Consigue 300 cartas distintas', stat: 'unique', goal: 300, coins: 600, fragments: 200 },
  { id: 'a_col400', text: 'Consigue 400 cartas distintas', stat: 'unique', goal: 400, coins: 800, fragments: 300 },
  { id: 'a_col500', text: 'Consigue 500 cartas distintas', stat: 'unique', goal: 500, coins: 1000, fragments: 500 },
  { id: 'a_col600', text: 'Consigue 600 cartas distintas', stat: 'unique', goal: 600, coins: 1500, fragments: 800 },
  { id: 'a_col750', text: 'Consigue 750 cartas distintas', stat: 'unique', goal: 750, coins: 2000, fragments: 1000 },
  { id: 'a_col1000', text: 'Consigue 1000 cartas distintas', stat: 'unique', goal: 1000, coins: 3000, fragments: 1500 },
  { id: 'a_leg1', text: 'Consigue una carta legendaria', stat: 'legendaries', goal: 1, coins: 100 },
  { id: 'a_leg10', text: 'Consigue 10 legendarias distintas', stat: 'legendaries', goal: 10, coins: 300, fragments: 100 },
  { id: 'a_foil1', text: 'Mejora una carta a brillante', stat: 'foils', goal: 1, coins: 50 },
  { id: 'a_foil10', text: 'Ten 10 cartas brillantes', stat: 'foils', goal: 10, coins: 200, fragments: 50 },
];

export const STARTER_DECK = [
  'dusk_recruit', 'dusk_recruit', 'ash_bat', 'rune_squire', 'flame_acolyte', 'bronze_sentinel',
  'arcane_librarian', 'night_leech', 'spark', 'spark', 'mire_toad', 'lightning_lance',
  'ash_bat', 'rune_squire', 'flame_acolyte', 'bronze_sentinel', 'moon_potion', 'aegis',
  'dark_blessing', 'grave_rat', 'cinder_imp', 'shadow_cutpurse', 'bog_lurker', 'tower_archer',
];

// Cada lista de rival define su estilo con 12 cartas; el resto lo pone el mazo inicial, igual que empieza el jugador.
function fullAiDeck(list) {
  const deck = [...list];
  for (const id of STARTER_DECK) {
    if (deck.length < RULES.deckSize && deck.filter((x) => x === id).length < 2) deck.push(id);
  }
  return deck;
}

const ASSAULT_DECK = [
  'ash_bat', 'ash_bat', 'rune_squire', 'flame_acolyte', 'night_leech', 'doom_herald',
  'mire_toad', 'lightning_rider', 'spark', 'dark_blessing', 'aegis', 'arcane_vision',
];

// Mazos del rival: la partida elige uno al azar. Cada uno enseña un estilo de juego.
export const AI_DECKS = [
  ASSAULT_DECK, // Asalto: criaturas rápidas y hechizos de apoyo
  [ // Cripta: muertos que vuelven y veneno
    'moon_potion', 'mire_toad', 'cinder_imp', 'cinder_imp', 'bone_warden', 'tomb_scholar',
    'venom_spitter', 'spore_mother', 'plague_bearer', 'soul_siphon', 'dusk_recruit', 'mire_toad',
  ],
  [ // Escarcha: congelar, aguantar y rematar
    'frost_wisp', 'frost_wisp', 'frost_bolt', 'ironhide_boar', 'dusk_recruit', 'chapel_healer',
    'tower_archer', 'ice_warden', 'firebolt', 'ironhide_boar', 'firebolt', 'bog_lurker',
  ],
  [ // Sombras: sigilo, furia y proyectiles
    'shadow_cutpurse', 'shadow_cutpurse', 'ember_hound', 'ember_hound', 'phantom_thief', 'twin_blade',
    'ash_bat', 'wolf_rider', 'magic_missiles', 'magic_missiles', 'blood_pact', 'storm_crow',
  ],
  [ // Forja: escudos, guardianes y criaturas que crecen
    'forge_apprentice', 'forge_apprentice', 'scrap_golem', 'anvil_guard', 'bellows_imp', 'mire_toad',
    'master_smith', 'sharpen_steel', 'dusk_recruit', 'dwarf_crossbow', 'ash_crawler', 'quick_study',
  ],
  [ // Telaraña: arañas, silencio y debilitar
    'spider_weaver', 'spider_weaver', 'night_moth', 'mire_toad', 'sea_hag', 'silent_monk',
    'blinding_ash', 'vow_of_silence', 'ash_crawler', 'raven_messenger', 'raven_messenger', 'crypt_lamplighter',
  ],  [ // Manada: lobos y bestias que crecen al atacar
    'rabid_wolf', 'rabid_wolf', 'storm_hawk', 'highland_ram', 'trapper', 'cave_bear',
    'wolverine', 'frost_wolf', 'call_of_the_pack', 'charge', 'ash_bat', 'mire_toad',
  ],
  [ // Sangre: vampíricos que se curan mientras pegan
    'blood_thrall', 'blood_thrall', 'bat_swarm', 'bloodlust', 'night_leech', 'skeleton_legionary',
    'forest_spirit', 'hungry_shade', 'mercenary', 'soul_siphon', 'vampire_noble', 'giant_wasp',
  ],
  [ // Piratas: abordaje rápido y cañonazos al héroe
    'deckhand', 'pirate_parrot', 'cannoneer', 'powder_monkey', 'buccaneer', 'boarding',
    'cannon_shot', 'old_rum', 'powder_keg', 'low_tide', 'mountain_goat', 'dusk_fisher',
  ],
  [ // Montaña: enanos que aguantan y se curan
    'dwarf_miner', 'dwarf_miner', 'anvil_guard', 'moon_potion', 'low_tide', 'hammer_blow',
    'old_rum', 'moon_acolyte', 'powder_keg', 'powder_keg', 'moonlight', 'dwarf_mason',
  ],
  [ // Bosque: setas y retoños que tapan el paso
    'mushroom_folk', 'mushroom_folk', 'dryad', 'wise_owl', 'forest_hermit', 'brambles',
    'healing_spring', 'fairy_dust', 'mischief_fairy', 'white_stag', 'mounted_lancer', 'light_lance',
  ],
  [ // Carnaval: bufones y marionetas que distraen
    'jester', 'jester', 'cog_mouse', 'fortune_teller', 'acrobat', 'puppeteer',
    'juggling', 'oil_gears', 'healing_spring', 'cursed_clown', 'fire_breather', 'old_rum',
  ],
  [ // Trasgos: muchos y pequeños, con granadas
    'goblin_scrapper', 'goblin_scrapper', 'goblin_miner', 'goblin_sapper', 'goblin_thief', 'goblin_horde',
    'goblin_grenade', 'goblin_chief', 'bell_ringer', 'holy_water', 'prayer', 'old_rum',
  ],
  [ // Norte: saqueadores con hachas y escaldos
    'clan_youth', 'clan_youth', 'raider', 'axe_thrower', 'skald', 'troll_hunter',
    'frost_axe', 'pearl', 'riptide', 'merfolk_priestess', 'will_o_wisp', 'war_horn',
  ],
  [ // Jungla: serpientes venenosas y jaguares al acecho
    'hunter_apprentice', 'toucan', 'lockpick', 'jungle_shaman', 'jaguar', 'ruins_explorer',
    'temple_guard', 'moon_potion', 'jade_offering', 'smoke_bomb', 'mire_toad', 'lockpick',
  ],
  [ // Estepa: centauros veloces y halcones
    'young_centaur', 'academy_student', 'steppe_rider', 'nomad_falconer', 'bola_thrower', 'archivist',
    'beaked_healer', 'wild_gallop', 'mana_surge', 'centaur_warrior', 'steppe_wind', 'living_tome',
  ],
  [ // Laberinto: minotauros, sueños y callejones sin salida
    'maze_rat', 'dream_moth', 'young_minotaur', 'labyrinth_guide', 'nightmare_hound', 'sandman',
    'maze_warden', 'night_mare', 'horn_charge', 'dead_end', 'gem_light', 'bad_dream',
  ],
  [ // Micelio: esporas, setas venenosas y canciones
    'glowcap', 'puffball', 'rot_beetle', 'mushroom_picker', 'toadstool_sentry', 'stargazer',
    'toadstool_sentry', 'falling_star', 'spore_cloud', 'dissonance', 'mycelium_net', 'heroic_ballad',
  ],
  [ // Cosecha: calabazas, segadores y almas del río
    'pumpkin_head', 'farmhand', 'harvest_crow', 'pumpkin_farmer', 'straw_golem', 'scythe_peasant',
    'mourner', 'soul_oarsman', 'river_wraith', 'pumpkin_patch', 'rose_oath', 'reaping',
  ],
  [ // Mascarada: enmascarados, venenos y trucos de salón
    'masked_servant', 'bronze_sentinel', 'night_owl', 'masked_guest', 'illusionist', 'ball_butler',
    'masquerade_dancer', 'toast', 'false_face', 'poisoned_wine', 'fox_trick', 'quagmire',
  ],
  [ // Mitos: héroes griegos, genios del desierto y gnomos
    'satyr', 'spring_nymph', 'gnome_lookout', 'dervish', 'first_wish', 'amazon_archer',
    'dune_viper', 'moon_potion', 'caravan_camel', 'gorgon_acolyte', 'javelin', 'hoplite',
  ],
  [ // Torneo: abejas, escuderos y monjes
    'worker_bee', 'page_boy', 'beekeeper', 'drone_bee', 'herald', 'aegis',
    'novice_monk', 'staff_monk', 'jousting_knight', 'honey_jar', 'iron_fist', 'meditation',
  ],
  [ // Arena: gladiadores, tritones y bandidos
    'young_gladiator', 'road_bandit', 'net_fighter', 'highwayman', 'sunken_priest', 'pearl_diver',
    'highway_toll', 'triton_guard', 'bandit_archer', 'sand_in_eyes', 'stolen_purse', 'crowd_cheer',
  ],
  [ // Tumbas: momias, trampas y gatos del templo
    'tomb_scarab', 'temple_cat', 'dusk_recruit', 'embalmer', 'tomb_robber', 'trapmaker',
    'moon_potion', 'jackal_guard', 'sand_mummy', 'treasure_map', 'pit_trap', 'curse_of_tomb',
  ],
  [ // Castillo: vampiros, gárgolas y asedio
    'fledgling', 'ghoul', 'castle_servant', 'gargoyle_whelp', 'sapper', 'ballista_crew',
    'siege_volley', 'crumbling_wall', 'castle_gate', 'garlic', 'stone_skin', 'life_sip',
  ],
  [ // Taberna: orcos, lagartos y camorristas
    'orc_grunt', 'lizard_scout', 'tavern_brawler', 'barmaid', 'dice_gambler', 'swamp_naga',
    'war_boar', 'innkeeper', 'lucky_dice', 'bar_fight', 'swamp_gas', 'thrown_axe',
  ],
  [ // Bosque Lunar: elfos arqueros, ciervos y sauces
    'elf_novice', 'moon_moth', 'fawn_keeper', 'lunar_archer', 'willow_sprite', 'elf_warden',
    'young_hippogriff', 'elf_herbalist', 'moon_arrow', 'elven_grace', 'sapling_grove', 'moonwell',
  ],
  [ // Niebla: ronin, oni y grullas de papel
    'ronin_youth', 'paper_folder', 'kappa', 'mist_scout', 'lantern_bearer', 'oni_brute',
    'wandering_swordsman', 'tea_master', 'quick_draw', 'paper_charm', 'sake_offering', 'paper_flock',
  ],
].map(fullAiDeck);
export const AI_DECK = AI_DECKS[0];

// Nombre del rival que se muestra en combate, uno por mazo de AI_DECKS (mismo orden).
export const AI_NAMES = ['Señor del Abismo', 'Guardiana de la Cripta', 'Bruja de la Escarcha', 'El Encapuchado', 'Maestro Forjador',
  'La Tejedora', 'Cazadora de la Manada', 'Conde Sangriento', 'Capitán Sal', 'Thane de la Montaña', 'La Dama del Bosque',
  'El Maestro de Pista', 'Gran Jefe Trasgo', 'La Jarl de Hierro', 'El Sacerdote de Jade', 'El Kan del Viento', 'El Guardián del Laberinto', 'La Druida de las Setas', 'El Espantapájaros', 'La Dama Enmascarada', 'La Pitonisa del Oasis', 'El Mariscal del Torneo', 'La Lanista', 'El Gran Embalsamador', 'La Condesa del Castillo', 'El Posadero del Cruce', 'La Reina del Bosque Lunar', 'El Ronin de la Niebla'];
