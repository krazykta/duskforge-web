// Qué efecto visual le toca a cada carta, deducido de su nombre e icono para que las 1199 tengan
// sentido sin anotarlas una a una. Datos puros: el dibujo está en ui/fx.js.

// El primer patrón que encaja gana, así que lo más concreto va antes.
const ATTACKS = [
  ['arrow', /arquer|ballester|cazador|cazadora|flecha|saeta|🏹|🎯/i],
  ['shot', /cañon|mosquete|artiller|polvor|balista|catapult|asedio|💣|🧨|🔫/i],
  ['throw', /lanzador|hachero|dardo|hondero|malabar|tirador|🥢/i],
  ['pierce', /lancer|alabard|tritón|hoplita|legionari|jinete|🔱/i],
  ['bite', /serpiente|víbora|vampir|lobo|sabueso|perro|chacal|tiburón|cocodrilo|caimán|\brata\b|ratón|murciélago|sanguijuela|zombi|necrófago|\bgul\b|hiena|jabalí|lagarto|naga|tortuga|🐍|🐺|🐕|🦇|🧛|🐊|🦈|🐀|🐁|🐗|🦎|🐸|🐢/i],
  ['sting', /abeja|avispa|escorpión|araña|mosquito|polilla|🐝|🦂|🕷️|🦗|🪰|🪲|🦋/i],
  ['claw', /grifo|hipogrifo|arpía|león|leona|tigre|jaguar|pantera|\boso\b|gato|lobezno|águila|halcón|cuervo|búho|gárgola|demonio|diablillo|🦅|🦁|🐆|🐅|🐈|🐻|🦉|🐦|🦡|😈|👹|👺|🐾/i],
  ['breath', /dragón|draco|elemental|sierpe|🐉|🐲|🌋|🌊|🌩️|⛈️|🌪️|❄️|🧊|🔥/i],
  ['magic', /mag[oa]\b|bruj|hechicer|sacerdot|chamán|oráculo|acólit|alquimist|nigromant|monje|druida|hada|espíritu|fantasma|sirena|bard|tamborilero|🔮|🧙|📜|🕯️|⚗️|📿|🪄|👻|🌙|☀️|🧚|🎶|📖/i],
  ['smash', /gólem|gigante|coloso|ogro|troll|trol\b|cíclope|minotauro|ariete|enano|herrero|martill|maza|árbol|sauce|🗿|🪨|🌳|⛏️|⚒️|🔨|🐂|🐘|🦣|🦏|🏔️|💪|👊|🧱|⚙️|🤖/i],
];

const ELEMENTS = [
  ['lightning', /rayo|relámpago|trueno|tormenta|tempestad|chispa|⚡|🌩️|⛈️/i],
  ['ice', /hielo|escarcha|helad|nieve|granizo|ventisca|glaci|congel|🧊|❄️|🌨️/i],
  ['fire', /fuego|llama|brasa|ceniza|ígneo|infierno|infernal|ígnea|meteoro|cometa|ascua|lava|volcán|\barde|pólvora|cañon|bomba|explos|🔥|☄️|💥|💣|🌋|🧨/i],
  ['poison', /veneno|envenen|plaga|peste|espora|toxin|ponzoña|miasma|☠️|🦠|🐍|🦂|🍄/i],
  ['blood', /sangre|sifón|vampir|drenar|transfusión|🩸|🦇/i],
  ['water', /marea|maremoto|\bola\b|agua|lluvia|océano|\bmar\b|manantial|oasis|🌊|💧|⛲|🌧️|🫧/i],
  ['wind', /viento|vendaval|tornado|huracán|torbellino|ráfaga|aliento|🌬️|🌪️|🌀|💨|🍃/i],
  ['earth', /tierra|arena|piedra|roca|terremoto|grieta|muro|arcilla|avalancha|🪨|🧱|🏜️|⛰️|🏔️/i],
  ['nature', /bosque|raíz|raíces|zarza|espina|enjambre|salvaje|flor|\brosa\b|🌿|🌱|🌲|🌳|🌹|🐝/i],
  ['steel', /espada|acero|\bhoja|tajo|hacha|lanza|daga|martill|batalla|guerra|🗡️|⚔️|🪓|🔪|🛡️|🏹/i],
  ['shadow', /sombra|oscur|noche|muerte|maldición|maleficio|vacío|eclipse|alma|tumba|pesadilla|🌑|💀|🖤|👻|⚰️|🕳️|🕸️/i],
  ['holy', /sagrad|bendición|juicio|luz|lunar|luna|solar|\bsol\b|alba|dioses|himno|oración|🌕|🌙|🌅|☀️|🌞|✝️|🕊️|🙏|⛪/i],
];

// Si el nombre no dice nada, manda lo que hace la carta.
const BY_KIND = {
  heal: 'heal', damageHeal: 'blood', freeze: 'ice', freezeAll: 'ice', shield: 'holy', shieldAll: 'holy', buff: 'holy', buffAll: 'holy',
  grant: 'holy', weaken: 'shadow', destroy: 'shadow', silence: 'shadow', silenceAll: 'shadow', bounce: 'wind',
};

const label = (card) => `${card.name} ${card.art ?? ''}`;

export const RANGED = new Set(['arrow', 'shot', 'throw', 'breath', 'magic']);

// Cómo golpea una criatura: arrow, shot, throw, pierce, bite, sting, claw, breath, magic, smash o slash.
export const attackStyle = (card) => ATTACKS.find(([, re]) => re.test(label(card)))?.[0] ?? 'slash';

// De qué está hecho su efecto o su ataque a distancia.
export function fxElement(card, fallback = 'arcane') {
  const kind = card.effect?.kind;
  if (kind === 'heal') return 'heal';
  return ELEMENTS.find(([, re]) => re.test(label(card)))?.[0] ?? BY_KIND[kind] ?? fallback;
}
