// Todos los números de equilibrio en un solo sitio. Son hipótesis iniciales:
// cámbialos aquí y no en el código de reglas.
export const GAME_NAME = 'DUSKFORGE';

export const RULES = {
  startHp: 20,
  deckSize: 12,
  startHand: 3,
  secondPlayerExtraCards: 1, // compensa al jugador que empieza segundo
  secondPlayerBonus: 'ember', // y además recibe esta carta (Ascua: +1 de energía un turno)
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

// Más cartas por sobre y la última siempre rara o mejor: ayuda a completar una colección grande.
export const BIG_PACK = {
  name: 'Sobre grande',
  price: 180,
  cards: 5,
  odds: PACK.odds,
  lastOdds: { common: 0, rare: 0.75, epic: 0.2, legendary: 0.05 },
};
export const PACKS = [PACK, BIG_PACK];

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
  { id: 'a_leg1', text: 'Consigue una carta legendaria', stat: 'legendaries', goal: 1, coins: 100 },
  { id: 'a_leg10', text: 'Consigue 10 legendarias distintas', stat: 'legendaries', goal: 10, coins: 300, fragments: 100 },
  { id: 'a_foil1', text: 'Mejora una carta a brillante', stat: 'foils', goal: 1, coins: 50 },
  { id: 'a_foil10', text: 'Ten 10 cartas brillantes', stat: 'foils', goal: 10, coins: 200, fragments: 50 },
];

export const STARTER_DECK = [
  'dusk_recruit', 'dusk_recruit', 'ash_bat', 'rune_squire', 'flame_acolyte', 'bronze_sentinel',
  'arcane_librarian', 'night_leech', 'spark', 'spark', 'mire_toad', 'lightning_lance',
];

export const AI_DECK = [
  'ash_bat', 'ash_bat', 'rune_squire', 'flame_acolyte', 'night_leech', 'doom_herald',
  'storm_apprentice', 'lightning_rider', 'spark', 'dark_blessing', 'aegis', 'arcane_vision',
];

// Mazos del rival: la partida elige uno al azar. Cada uno enseña un estilo de juego.
export const AI_DECKS = [
  AI_DECK, // Asalto: criaturas rápidas y hechizos de apoyo
  [ // Cripta: muertos que vuelven y veneno
    'grave_rat', 'ash_bat', 'cinder_imp', 'cinder_imp', 'bone_warden', 'tomb_scholar',
    'venom_spitter', 'spore_mother', 'plague_bearer', 'soul_siphon', 'dusk_recruit', 'ash_bat',
  ],
  [ // Escarcha: congelar, aguantar y rematar
    'frost_wisp', 'frost_wisp', 'frost_bolt', 'ironhide_boar', 'dusk_recruit', 'chapel_healer',
    'tower_archer', 'ice_warden', 'firebolt', 'ironhide_boar', 'banish', 'bog_lurker',
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
    'dwarf_miner', 'dwarf_miner', 'anvil_guard', 'dwarf_brewer', 'low_tide', 'hammer_blow',
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
    'hunter_apprentice', 'toucan', 'pickpocket', 'jungle_shaman', 'jaguar', 'ruins_explorer',
    'temple_guard', 'fence', 'jade_offering', 'smoke_bomb', 'river_crocodile', 'lockpick',
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
    'glowcap', 'puffball', 'rot_beetle', 'mushroom_picker', 'drummer', 'stargazer',
    'toadstool_sentry', 'falling_star', 'spore_cloud', 'dissonance', 'mycelium_net', 'heroic_ballad',
  ],
];

// Nombre del rival que se muestra en combate, uno por mazo de AI_DECKS (mismo orden).
export const AI_NAMES = ['Señor del Abismo', 'Guardiana de la Cripta', 'Bruja de la Escarcha', 'El Encapuchado', 'Maestro Forjador',
  'La Tejedora', 'Cazadora de la Manada', 'Conde Sangriento', 'Capitán Sal', 'Thane de la Montaña', 'La Dama del Bosque',
  'El Maestro de Pista', 'Gran Jefe Trasgo', 'La Jarl de Hierro', 'El Sacerdote de Jade', 'El Kan del Viento', 'El Guardián del Laberinto', 'La Druida de las Setas'];
