import { CharacterAvatarConfig } from '../types';

export interface CharacterPreset {
  id: string;
  defaultConfig: CharacterAvatarConfig;
}

// Warm, rich vintage toy skin / fur tones - strictly ordered from lightest to darkest
export const SKIN_TONES = [
  { id: 'fair_cream', color: '#ffdfbf' },       // 1. Lightest cream
  { id: 'peach', color: '#ffd0a6' },            // 2. Soft peach
  { id: 'golden_sand', color: '#f5be8e' },      // 3. Warm sand
  { id: 'warm_caramel', color: '#e5a56d' },     // 4. Warm caramel
  { id: 'terracotta_skin', color: '#c68449' },  // 5. Terracotta tan
  { id: 'chestnut', color: '#8d532b' },         // 6. Chestnut brown
  { id: 'dark_espresso', color: '#573319' },    // 7. Dark espresso
];

// Deep, high quality vintage toy colors (Ochre yellow, Bordeaux red, Petrol blue, Forest green, Terracotta, Plum)
export const BACKGROUND_COLORS = [
  { id: 'ochre_yellow', color: '#c67d0a' },
  { id: 'bordeaux_red', color: '#881337' },
  { id: 'petrol_blue', color: '#0e7490' },
  { id: 'forest_green', color: '#15803d' },
  { id: 'terracotta_orange', color: '#c2410c' },
  { id: 'plum_purple', color: '#581c87' },
];

// 6 Hair Styles + none
export const HAIR_STYLES = [
  { id: 'bald' },
  { id: 'short' },
  { id: 'mid_curly' },
  { id: 'bob' },
  { id: 'bun' },
  { id: 'long' },
  { id: 'wavy' },
];

// Deep rich hair colors
export const HAIR_COLORS = [
  { id: 'espresso_black', color: '#18181b' },
  { id: 'chestnut_brown', color: '#451a03' },
  { id: 'mahogany_red', color: '#78350f' },
  { id: 'ochre_blonde', color: '#d97706' },
  { id: 'vintage_ginger', color: '#ea580c' },
  { id: 'silver_slate', color: '#64748b' },
];

// 6 Eye Styles
export const EYE_STYLES = [
  { id: 'sparkle' },
  { id: 'cartoon' },
  { id: 'curved' },
  { id: 'round' },
  { id: 'wink' },
  { id: 'stars' },
];

// 6 Aesthetic Eyebrow Styles (delicate, proportional)
export const EYEBROW_STYLES = [
  { id: 'none' },
  { id: 'gentle' },
  { id: 'arch' },
  { id: 'straight' },
  { id: 'dots' },
  { id: 'inquisitive' },
];

// Eye Colors
export const EYE_COLORS = [
  { id: 'dark_charcoal', color: '#1c1917' },
  { id: 'petrol_blue', color: '#0284c7' },
  { id: 'forest_green', color: '#16a34a' },
  { id: 'warm_amber', color: '#b45309' },
  { id: 'royal_indigo', color: '#4338ca' },
  { id: 'hazel', color: '#78350f' },
];

// 6 Nose Styles
export const NOSE_STYLES = [
  { id: 'button' },
  { id: 'curve' },
  { id: 'triangle' },
  { id: 'oval' },
  { id: 'dot' },
  { id: 'drop' },
];

// 6 Mouth Styles
export const MOUTH_STYLES = [
  { id: 'broad_smile' },
  { id: 'gentle' },
  { id: 'laugh' },
  { id: 'smirk' },
  { id: 'open_o' },
  { id: 'tongue' },
];

// Attribute: Glasses Styles
export const GLASSES_STYLES = [
  { id: 'none' },
  { id: 'round' },
  { id: 'thick' },
  { id: 'rect' },
  { id: 'sunglasses' },
  { id: 'cat_eye' },
];

// Glasses Colors
export const GLASSES_COLORS = [
  { id: 'black', color: '#18181b' },
  { id: 'tortoise', color: '#78350f' },
  { id: 'ochre', color: '#d97706' },
  { id: 'bordeaux', color: '#881337' },
  { id: 'petrol', color: '#0e7490' },
  { id: 'forest', color: '#166534' },
];

// Attribute: Hat Styles
export const HAT_STYLES = [
  { id: 'none' },
  { id: 'beret' },
  { id: 'party_hat' },
  { id: 'bowler' },
  { id: 'beanie' },
  { id: 'crown' },
  { id: 'cap' },
];

// Hat Colors
export const HAT_COLORS = [
  { id: 'bordeaux', color: '#881337' },
  { id: 'ochre', color: '#c67d0a' },
  { id: 'petrol', color: '#0e7490' },
  { id: 'forest', color: '#15803d' },
  { id: 'terracotta', color: '#c2410c' },
  { id: 'gold', color: '#eab308' },
];

// 6 Distinct Vintage Toy Animal Characters: Bear, Fox, Bunny, Cat, Owl, Dog (All plain, no hats/glasses/wigs)
export const CHARACTER_PRESETS: CharacterPreset[] = [
  {
    id: 'bear',
    defaultConfig: {
      characterId: 'bear',
      hairStyle: 'bald',
      hairColor: '#451a03',
      skinTone: '#8d532b', // Teddy bear brown
      eyeStyle: 'sparkle',
      eyeColor: '#1c1917',
      eyebrowStyle: 'none',
      noseStyle: 'button',
      mouthStyle: 'broad_smile',
      glassesStyle: 'none',
      glassesColor: '#18181b',
      hatStyle: 'none',
      hatColor: '#881337',
      bgColor: '#c67d0a', // Ochre Yellow
    },
  },
  {
    id: 'fox',
    defaultConfig: {
      characterId: 'fox',
      hairStyle: 'bald',
      hairColor: '#ea580c',
      skinTone: '#c2410c', // Rusty fox orange
      eyeStyle: 'wink',
      eyeColor: '#16a34a',
      eyebrowStyle: 'none',
      noseStyle: 'triangle',
      mouthStyle: 'smirk',
      glassesStyle: 'none',
      glassesColor: '#18181b',
      hatStyle: 'none',
      hatColor: '#581c87',
      bgColor: '#0e7490', // Petrol Blue
    },
  },
  {
    id: 'bunny',
    defaultConfig: {
      characterId: 'bunny',
      hairStyle: 'bald',
      hairColor: '#78350f',
      skinTone: '#ffdfbf', // Soft cream bunny
      eyeStyle: 'cartoon',
      eyeColor: '#0284c7',
      eyebrowStyle: 'none',
      noseStyle: 'oval',
      mouthStyle: 'gentle',
      glassesStyle: 'none',
      glassesColor: '#881337',
      hatStyle: 'none',
      hatColor: '#c2410c',
      bgColor: '#15803d', // Forest Green
    },
  },
  {
    id: 'cat',
    defaultConfig: {
      characterId: 'cat',
      hairStyle: 'bald',
      hairColor: '#18181b',
      skinTone: '#f5be8e', // Warm ginger cream
      eyeStyle: 'curved',
      eyeColor: '#16a34a',
      eyebrowStyle: 'none',
      noseStyle: 'triangle',
      mouthStyle: 'broad_smile',
      glassesStyle: 'none',
      glassesColor: '#78350f',
      hatStyle: 'none',
      hatColor: '#15803d',
      bgColor: '#c2410c', // Terracotta Orange
    },
  },
  {
    id: 'owl',
    defaultConfig: {
      characterId: 'owl',
      hairStyle: 'bald',
      hairColor: '#451a03',
      skinTone: '#78350f', // Warm tawny brown
      eyeStyle: 'round',
      eyeColor: '#b45309',
      eyebrowStyle: 'none',
      noseStyle: 'triangle',
      mouthStyle: 'gentle',
      glassesStyle: 'none',
      glassesColor: '#18181b',
      hatStyle: 'none',
      hatColor: '#18181b',
      bgColor: '#581c87', // Antique Plum
    },
  },
  {
    id: 'dog',
    defaultConfig: {
      characterId: 'dog',
      hairStyle: 'bald',
      hairColor: '#18181b',
      skinTone: '#ffd0a6', // Golden puppy
      eyeStyle: 'sparkle',
      eyeColor: '#78350f',
      eyebrowStyle: 'none',
      noseStyle: 'button',
      mouthStyle: 'tongue',
      glassesStyle: 'none',
      glassesColor: '#18181b',
      hatStyle: 'none',
      hatColor: '#0e7490',
      bgColor: '#881337', // Bordeaux Red
    },
  },
];

// Helper to normalize legacy preset IDs to new animal IDs
export function normalizeCharacterId(characterId?: string): string {
  if (!characterId) return 'bear';
  if (characterId === 'pip') return 'bear';
  if (characterId === 'milo') return 'dog';
  if (characterId === 'ziggy') return 'fox';
  if (characterId === 'lola') return 'bunny';
  if (characterId === 'nori') return 'cat';
  if (characterId === 'felix') return 'owl';
  return characterId;
}

export function getDefaultAvatarConfig(characterId = 'bear'): CharacterAvatarConfig {
  const normId = normalizeCharacterId(characterId);
  const preset = CHARACTER_PRESETS.find(p => p.id === normId) || CHARACTER_PRESETS[0];
  return { ...preset.defaultConfig };
}

/**
 * Pure SVG generator for the custom animal animated character
 * Designed with vintage wooden/tin toy aesthetic:
 * - Perfectly centered in the 200x200 canvas
 * - Rich lacquered colors, soft curves, expressive eyes and vintage details
 */
export function renderCharacterSvgString(config: CharacterAvatarConfig, size = 200): string {
  const normCharId = normalizeCharacterId(config.characterId);
  const {
    hairStyle = 'bald',
    hairColor = '#451a03',
    skinTone = '#8d532b',
    eyeStyle = 'sparkle',
    eyeColor = '#1c1917',
    eyebrowStyle = 'none',
    noseStyle = 'button',
    mouthStyle = 'broad_smile',
    glassesStyle = 'none',
    glassesColor = '#18181b',
    hatStyle = 'none',
    hatColor = '#881337',
    bgColor = '#c67d0a',
  } = config;

  // 6 Distinct Animals: Bear, Fox, Bunny, Cat, Owl, Dog
  // All 6 animals share a standardized upper skull curvature (cx=100, cy=106, rx=47, ry=45)
  // so that EVERY hairstyle and hat fits seamlessly with zero gaps.
  let headShape = '';
  let ears = '';
  let animalMuzzle = '';
  let clothes = '';
  let blush = '';

  if (normCharId === 'fox') {
    // 2. FOX (Vos) - Sleek, alert, cute animation fox
    ears = `
      <!-- Left fox ear -->
      <polygon points="62,64 68,34 82,60" fill="${skinTone}" />
      <polygon points="65,60 69,40 79,58" fill="#fffbeb" />
      <polygon points="67,39 68,34 71,41" fill="#1c1917" />
      <!-- Right fox ear -->
      <polygon points="118,60 132,34 138,64" fill="${skinTone}" />
      <polygon points="121,58 131,40 135,60" fill="#fffbeb" />
      <polygon points="129,41 132,34 133,39" fill="#1c1917" />
    `;
    headShape = `
      <!-- Harmonized cartoon fox head -->
      <path d="M53 102 C52 70 70 61 100 61 C130 61 148 70 147 102 C146 126 122 151 100 151 C78 151 54 126 53 102 Z" fill="${skinTone}" />
      <!-- Soft fluffy cream cheeks & muzzle -->
      <path d="M56 110 C70 106 84 120 100 120 C116 120 130 106 144 110 C140 136 122 151 100 151 C78 151 60 136 56 110 Z" fill="#fffbeb" />
    `;
    animalMuzzle = '';
    clothes = `
      <!-- Dapper cartoon teal pullover with cream collar -->
      <path d="M46 200 C46 150 70 148 100 148 C130 148 154 150 154 200 Z" fill="#0e7490" />
      <path d="M88 148 L100 162 L112 148 Z" fill="#fef3c7" />
    `;
    blush = `
      <ellipse cx="68" cy="116" rx="6" ry="3.5" fill="#fb7185" opacity="0.32" />
      <ellipse cx="132" cy="116" rx="6" ry="3.5" fill="#fb7185" opacity="0.32" />
    `;
  } else if (normCharId === 'bunny') {
    // 3. BUNNY (Konijn) - Adorable upright cartoon bunny ears
    ears = `
      <!-- Left tall bunny ear -->
      <path d="M70 68 C66 46 68 20 75 20 C82 20 83 46 84 66 Z" fill="${skinTone}" />
      <path d="M72 64 C69 46 71 25 75 25 C79 25 80 46 81 63 Z" fill="#fca5a5" />
      <!-- Right tall bunny ear -->
      <path d="M116 66 C117 46 118 20 125 20 C132 20 134 46 130 68 Z" fill="${skinTone}" />
      <path d="M119 63 C120 46 121 25 125 25 C129 25 131 46 128 64 Z" fill="#fca5a5" />
    `;
    headShape = `<ellipse cx="100" cy="106" rx="47" ry="45" fill="${skinTone}" />`;
    animalMuzzle = `
      <!-- Soft chubby bunny cheek pads -->
      <circle cx="94" cy="124" r="7.5" fill="#fffbeb" opacity="0.9" />
      <circle cx="106" cy="124" r="7.5" fill="#fffbeb" opacity="0.9" />
      <!-- Delicate subtle whiskers (soft, cartoon-friendly) -->
      <line x1="56" y1="122" x2="42" y2="120" stroke="#92400e" stroke-width="1.2" stroke-linecap="round" opacity="0.45" />
      <line x1="56" y1="126" x2="42" y2="127" stroke="#92400e" stroke-width="1.2" stroke-linecap="round" opacity="0.45" />
      <line x1="144" y1="122" x2="158" y2="120" stroke="#92400e" stroke-width="1.2" stroke-linecap="round" opacity="0.45" />
      <line x1="144" y1="126" x2="158" y2="127" stroke="#92400e" stroke-width="1.2" stroke-linecap="round" opacity="0.45" />
    `;
    clothes = `
      <!-- Clean sky-blue jumper -->
      <path d="M46 200 C46 150 70 148 100 148 C130 148 154 150 154 200 Z" fill="#0284c7" />
      <rect x="82" y="148" width="36" height="6" rx="3" fill="#38bdf8" />
    `;
    blush = `
      <circle cx="68" cy="120" r="6" fill="#f43f5e" opacity="0.32" />
      <circle cx="132" cy="120" r="6" fill="#f43f5e" opacity="0.32" />
    `;
  } else if (normCharId === 'cat') {
    // 4. CAT (Kat) - Perky, sweet cartoon cat ears and face
    ears = `
      <!-- Left cat ear -->
      <polygon points="58,68 66,40 80,62" fill="${skinTone}" />
      <polygon points="62,65 67,46 76,61" fill="#fca5a5" />
      <!-- Right cat ear -->
      <polygon points="120,62 134,40 142,68" fill="${skinTone}" />
      <polygon points="124,61 133,46 138,65" fill="#fca5a5" />
    `;
    headShape = `<ellipse cx="100" cy="106" rx="47" ry="45" fill="${skinTone}" />`;
    animalMuzzle = `
      <!-- Sweet feline muzzle -->
      <circle cx="94" cy="123" r="7" fill="#fffbeb" opacity="0.88" />
      <circle cx="106" cy="123" r="7" fill="#fffbeb" opacity="0.88" />
      <!-- Soft delicate cat whiskers -->
      <line x1="56" y1="120" x2="42" y2="117" stroke="#78350f" stroke-width="1.2" stroke-linecap="round" opacity="0.45" />
      <line x1="56" y1="124" x2="42" y2="125" stroke="#78350f" stroke-width="1.2" stroke-linecap="round" opacity="0.45" />
      <line x1="144" y1="120" x2="158" y2="117" stroke="#78350f" stroke-width="1.2" stroke-linecap="round" opacity="0.45" />
      <line x1="144" y1="124" x2="158" y2="125" stroke="#78350f" stroke-width="1.2" stroke-linecap="round" opacity="0.45" />
    `;
    clothes = `
      <!-- Chic French breton sailor top -->
      <path d="M46 200 C46 150 70 148 100 148 C130 148 154 150 154 200 Z" fill="#ffffff" />
      <path d="M48 168 L152 168 L151 174 L49 174 Z" fill="#1e3a8a" />
      <path d="M52 184 L148 184 L147 190 L53 190 Z" fill="#1e3a8a" />
      <rect x="84" y="148" width="32" height="5" rx="2.5" fill="#dc2626" />
    `;
    blush = `
      <circle cx="68" cy="118" r="5.5" fill="#f43f5e" opacity="0.32" />
      <circle cx="132" cy="118" r="5.5" fill="#f43f5e" opacity="0.32" />
    `;
  } else if (normCharId === 'owl') {
    // 5. OWL (Uil) - Cute cartoon owlet with plumage crest and soft eye discs
    ears = `
      <!-- Left feather tuft -->
      <polygon points="62,64 65,42 76,60" fill="${skinTone}" />
      <polygon points="66,62 67,46 73,59" fill="#ca8a04" opacity="0.6" />
      <!-- Right feather tuft -->
      <polygon points="124,60 135,42 138,64" fill="${skinTone}" />
      <polygon points="127,59 133,46 134,62" fill="#ca8a04" opacity="0.6" />
    `;
    headShape = `
      <ellipse cx="100" cy="106" rx="47" ry="45" fill="${skinTone}" />
      <!-- Soft plumage eye discs -->
      <circle cx="80" cy="103" r="18" fill="#fef3c7" opacity="0.9" />
      <circle cx="120" cy="103" r="18" fill="#fef3c7" opacity="0.9" />
    `;
    animalMuzzle = `
      <!-- Subtle feathery chest scallops -->
      <path d="M92 138 Q100 144 108 138" stroke="#ca8a04" stroke-width="1.8" fill="none" stroke-linecap="round" opacity="0.5" />
    `;
    clothes = `
      <!-- Forest green storybook vest -->
      <path d="M46 200 C46 150 70 148 100 148 C130 148 154 150 154 200 Z" fill="#15803d" />
      <path d="M90 148 L100 162 L110 148 Z" fill="#ca8a04" />
      <circle cx="100" cy="174" r="2.5" fill="#fef08a" />
    `;
    blush = `
      <circle cx="66" cy="120" r="5" fill="#f97316" opacity="0.3" />
      <circle cx="134" cy="120" r="5" fill="#f97316" opacity="0.3" />
    `;
  } else if (normCharId === 'dog') {
    // 6. DOG (Hond) - Floppy puppy hound ears hugging cheeks closely
    ears = `
      <!-- Left floppy puppy ear -->
      <ellipse cx="54" cy="98" rx="10" ry="22" fill="#78350f" transform="rotate(8 54 98)" />
      <!-- Right floppy puppy ear -->
      <ellipse cx="146" cy="98" rx="10" ry="22" fill="#78350f" transform="rotate(-8 146 98)" />
    `;
    headShape = `<ellipse cx="100" cy="106" rx="47" ry="45" fill="${skinTone}" />`;
    animalMuzzle = `
      <!-- Puppy snout -->
      <ellipse cx="100" cy="122" rx="18" ry="12" fill="#fffbeb" />
    `;
    clothes = `
      <!-- Cheerful crimson sweater -->
      <path d="M46 200 C46 150 70 148 100 148 C130 148 154 150 154 200 Z" fill="#dc2626" />
      <rect x="80" y="148" width="40" height="6" rx="3" fill="#b91c1c" />
      <circle cx="100" cy="172" r="2.5" fill="#fef08a" />
    `;
    blush = `
      <circle cx="68" cy="120" r="5.5" fill="#fb7185" opacity="0.32" />
      <circle cx="132" cy="120" r="5.5" fill="#fb7185" opacity="0.32" />
    `;
  } else {
    // 1. BEAR (Default - Beer) - Classic warm teddy bear
    ears = `
      <!-- Left round bear ear (proportional, sits on skull curve) -->
      <circle cx="66" cy="68" r="13" fill="${skinTone}" />
      <circle cx="66" cy="68" r="7" fill="#fffbeb" opacity="0.8" />
      <!-- Right round bear ear -->
      <circle cx="134" cy="68" r="13" fill="${skinTone}" />
      <circle cx="134" cy="68" r="7" fill="#fffbeb" opacity="0.8" />
    `;
    headShape = `<ellipse cx="100" cy="106" rx="47" ry="45" fill="${skinTone}" />`;
    animalMuzzle = `
      <!-- Soft cream teddy bear muzzle -->
      <ellipse cx="100" cy="122" rx="20" ry="13" fill="#fffbeb" opacity="0.95" />
    `;
    clothes = `
      <!-- Warm cozy knit sweater -->
      <path d="M46 200 C46 150 70 148 100 148 C130 148 154 150 154 200 Z" fill="#b45309" />
      <rect x="78" y="146" width="44" height="8" rx="4" fill="#92400e" />
    `;
    blush = `
      <circle cx="68" cy="118" r="6" fill="#f43f5e" opacity="0.3" />
      <circle cx="132" cy="118" r="6" fill="#f43f5e" opacity="0.3" />
    `;
  }

  // --- 6 EYEBROW STYLES (Delicate, expressive, vintage storybook balance above eyes at y=88-90) ---
  let eyebrowSvg = '';
  const browColor = '#27272a';
  if (eyebrowStyle === 'gentle') {
    eyebrowSvg = `
      <g stroke="${browColor}" stroke-width="2.2" stroke-linecap="round" fill="none" opacity="0.85">
        <path d="M72 90 C76 86 85 86 89 89.5" />
        <path d="M111 89.5 C115 86 124 86 128 90" />
      </g>
    `;
  } else if (eyebrowStyle === 'arch') {
    eyebrowSvg = `
      <g stroke="${browColor}" stroke-width="2.2" stroke-linecap="round" fill="none" opacity="0.85">
        <path d="M71 91.5 C75 84.5 85 84.5 89 90" />
        <path d="M111 90 C115 84.5 125 84.5 129 91.5" />
      </g>
    `;
  } else if (eyebrowStyle === 'straight') {
    eyebrowSvg = `
      <g stroke="${browColor}" stroke-width="2.2" stroke-linecap="round" fill="none" opacity="0.85">
        <path d="M72 89 L89 88.5" />
        <path d="M111 88.5 L128 89" />
      </g>
    `;
  } else if (eyebrowStyle === 'dots') {
    eyebrowSvg = `
      <g fill="${browColor}" opacity="0.85">
        <circle cx="80" cy="88" r="2.2" />
        <circle cx="120" cy="88" r="2.2" />
      </g>
    `;
  } else if (eyebrowStyle === 'inquisitive') {
    eyebrowSvg = `
      <g stroke="${browColor}" stroke-width="2.2" stroke-linecap="round" fill="none" opacity="0.85">
        <path d="M72 90 C76 86 85 86 89 89.5" />
        <path d="M111 86 C115 81 125 81.5 129 87" />
      </g>
    `;
  }

  // --- 6 EYES STYLES (Optically centered at y=102, clean spacing) ---
  let eyesSvg = '';
  if (eyeStyle === 'curved') {
    eyesSvg = `
      <g>
        <path d="M72 103 C74 96 86 96 88 103" fill="none" stroke="${eyeColor}" stroke-width="3.5" stroke-linecap="round" />
        <path d="M112 103 C114 96 126 96 128 103" fill="none" stroke="${eyeColor}" stroke-width="3.5" stroke-linecap="round" />
      </g>
    `;
  } else if (eyeStyle === 'cartoon') {
    eyesSvg = `
      <g>
        <ellipse cx="80" cy="102" rx="9.5" ry="11.5" fill="#ffffff" stroke="#18181b" stroke-width="1.4" />
        <ellipse cx="81" cy="102" rx="6" ry="7.5" fill="${eyeColor}" />
        <circle cx="82" cy="102" r="3.4" fill="#09090b" />
        <circle cx="84" cy="98.5" r="2.2" fill="#ffffff" />
        <circle cx="79" cy="105" r="1.1" fill="#ffffff" />

        <ellipse cx="120" cy="102" rx="9.5" ry="11.5" fill="#ffffff" stroke="#18181b" stroke-width="1.4" />
        <ellipse cx="119" cy="102" rx="6" ry="7.5" fill="${eyeColor}" />
        <circle cx="118" cy="102" r="3.4" fill="#09090b" />
        <circle cx="121" cy="98.5" r="2.2" fill="#ffffff" />
        <circle cx="116" cy="105" r="1.1" fill="#ffffff" />
      </g>
    `;
  } else if (eyeStyle === 'round') {
    eyesSvg = `
      <g>
        <circle cx="80" cy="102" r="7" fill="${eyeColor}" />
        <circle cx="80" cy="102" r="4.2" fill="#09090b" />
        <circle cx="82.2" cy="99.8" r="2.2" fill="#ffffff" />

        <circle cx="120" cy="102" r="7" fill="${eyeColor}" />
        <circle cx="120" cy="102" r="4.2" fill="#09090b" />
        <circle cx="122.2" cy="99.8" r="2.2" fill="#ffffff" />
      </g>
    `;
  } else if (eyeStyle === 'wink') {
    eyesSvg = `
      <g>
        <path d="M72 103 C75 97 85 97 88 103" fill="none" stroke="${eyeColor}" stroke-width="3.5" stroke-linecap="round" />
        <circle cx="120" cy="102" r="7" fill="${eyeColor}" />
        <circle cx="120" cy="102" r="4.2" fill="#09090b" />
        <circle cx="122.2" cy="99.8" r="2.4" fill="#ffffff" />
        <circle cx="118" cy="104" r="1.2" fill="#ffffff" />
      </g>
    `;
  } else if (eyeStyle === 'stars') {
    eyesSvg = `
      <g fill="${eyeColor}">
        <path d="M80 94 L81.8 100.5 L88 102 L81.8 103.5 L80 110 L78.2 103.5 L72 102 L78.2 100.5 Z" />
        <circle cx="80" cy="102" r="1.8" fill="#ffffff" />
        <path d="M120 94 L121.8 100.5 L128 102 L121.8 103.5 L120 110 L118.2 103.5 L112 102 L118.2 100.5 Z" />
        <circle cx="120" cy="102" r="1.8" fill="#ffffff" />
      </g>
    `;
  } else {
    // sparkle
    eyesSvg = `
      <g>
        <ellipse cx="80" cy="102" rx="6.5" ry="8" fill="#18181b" />
        <circle cx="81.8" cy="99.5" r="3" fill="#ffffff" />
        <circle cx="78.2" cy="104" r="1.4" fill="#ffffff" />

        <ellipse cx="120" cy="102" rx="6.5" ry="8" fill="#18181b" />
        <circle cx="121.8" cy="99.5" r="3" fill="#ffffff" />
        <circle cx="118.2" cy="104" r="1.4" fill="#ffffff" />
      </g>
    `;
  }

  // --- 6 NOSE STYLES (Optically centered at y=116-118) ---
  let noseSvg = '';
  if (noseStyle === 'curve') {
    noseSvg = `<path d="M100 113 C103 115 103 120 99 120" fill="none" stroke="#78350f" stroke-width="2.4" stroke-linecap="round" />`;
  } else if (noseStyle === 'triangle') {
    noseSvg = `<polygon points="100,113 94,121 106,121" fill="#1c1917" />`;
  } else if (noseStyle === 'oval') {
    noseSvg = `<ellipse cx="100" cy="117" rx="5" ry="3.8" fill="#1c1917" />`;
  } else if (noseStyle === 'dot') {
    noseSvg = `<circle cx="100" cy="117" r="3" fill="#1c1917" />`;
  } else if (noseStyle === 'drop') {
    noseSvg = `
      <path d="M100 112 C97 115 95 119 97 121 C99 123 101 123 103 121 C105 119 103 115 100 112 Z" fill="#ea580c" />
      <circle cx="99" cy="118" r="1" fill="#ffffff" opacity="0.6" />
    `;
  } else {
    // button
    noseSvg = `
      <ellipse cx="100" cy="117" rx="5.5" ry="3.8" fill="#18181b" />
      <ellipse cx="100" cy="116" rx="2.5" ry="1.2" fill="#ffffff" opacity="0.4" />
    `;
  }

  // --- 6 MOUTH STYLES (Optically centered at y=129-133) ---
  let mouthSvg = '';
  if (mouthStyle === 'gentle') {
    mouthSvg = `<path d="M92 131 C96 136 104 136 108 131" fill="none" stroke="#713f12" stroke-width="2.6" stroke-linecap="round" />`;
  } else if (mouthStyle === 'laugh') {
    mouthSvg = `
      <g>
        <path d="M89 129 C89 143 111 143 111 129 Z" fill="#881337" />
        <path d="M93 136 C97 132 103 132 107 136 C105 142 95 142 93 136 Z" fill="#f43f5e" />
      </g>
    `;
  } else if (mouthStyle === 'smirk') {
    mouthSvg = `<path d="M93 133 C97 134 105 132 109 128" fill="none" stroke="#713f12" stroke-width="2.6" stroke-linecap="round" />`;
  } else if (mouthStyle === 'open_o') {
    mouthSvg = `
      <ellipse cx="100" cy="133" rx="5.5" ry="6.8" fill="#881337" />
      <ellipse cx="100" cy="134" rx="3" ry="3.5" fill="#f43f5e" />
    `;
  } else if (mouthStyle === 'tongue') {
    mouthSvg = `
      <g>
        <path d="M89 129 C94 135 106 135 111 129" fill="none" stroke="#713f12" stroke-width="2.6" stroke-linecap="round" />
        <path d="M96 132 C96 141 104 141 104 132 Z" fill="#f43f5e" />
        <path d="M100 133 L100 138" stroke="#be123c" stroke-width="1.3" stroke-linecap="round" />
      </g>
    `;
  } else {
    // broad_smile
    mouthSvg = `
      <g>
        <path d="M87 128 C87 142 113 142 113 128 Z" fill="#881337" />
        <path d="M89 128 C89 132 111 132 111 128 Z" fill="#ffffff" />
        <path d="M93 135 C96 132 104 132 107 135 C105 141 95 141 93 135 Z" fill="#fb7185" />
      </g>
    `;
  }

  // --- REFINED CARTOON GLASSES (Clean, iconic, never clutter or overpower the face) ---
  let glassesSvg = '';
  if (glassesStyle === 'round') {
    glassesSvg = `
      <g stroke="${glassesColor}" stroke-width="2.4" fill="none" stroke-linecap="round">
        <circle cx="79" cy="103" r="13.5" fill="#ffffff" fill-opacity="0.1" />
        <circle cx="121" cy="103" r="13.5" fill="#ffffff" fill-opacity="0.1" />
        <path d="M92.5 101 C96 98 104 98 107.5 101" stroke-width="2" />
        <path d="M65.5 103 L60 102" stroke-width="2" />
        <path d="M134.5 103 L140 102" stroke-width="2" />
      </g>
    `;
  } else if (glassesStyle === 'thick') {
    // Chic rounded-square acetate frames
    glassesSvg = `
      <g stroke="${glassesColor}" stroke-width="2.6" fill="none" stroke-linejoin="round" stroke-linecap="round">
        <rect x="66" y="93" width="26" height="19" rx="5" fill="#ffffff" fill-opacity="0.1" />
        <rect x="108" y="93" width="26" height="19" rx="5" fill="#ffffff" fill-opacity="0.1" />
        <path d="M92 99 C96 96 104 96 108 99" stroke-width="2.6" />
        <path d="M66 99 L61 98" stroke-width="2.2" />
        <path d="M134 99 L139 98" stroke-width="2.2" />
      </g>
    `;
  } else if (glassesStyle === 'rect') {
    // Minimal sleek rectangular readers
    glassesSvg = `
      <g stroke="${glassesColor}" stroke-width="2" fill="none" stroke-linecap="round">
        <rect x="67" y="95" width="25" height="16" rx="3.5" fill="#ffffff" fill-opacity="0.1" />
        <rect x="108" y="95" width="25" height="16" rx="3.5" fill="#ffffff" fill-opacity="0.1" />
        <path d="M92 99 L108 99" stroke-width="2" />
        <path d="M67 99 L62 98" stroke-width="1.8" />
        <path d="M133 99 L138 98" stroke-width="1.8" />
      </g>
    `;
  } else if (glassesStyle === 'sunglasses') {
    // Cool, smooth dark tinted shades with clean cartoon shine
    glassesSvg = `
      <g stroke="${glassesColor}" stroke-width="2" fill="#18181b" fill-opacity="0.88">
        <path d="M66 94 L92 94 C92 110 77 113 66 106 Z" />
        <path d="M134 94 L108 94 C108 110 123 113 134 106 Z" />
        <path d="M92 97 L108 97" stroke="${glassesColor}" stroke-width="2.4" />
        <path d="M66 97 L61 96" stroke="${glassesColor}" stroke-width="2" />
        <path d="M134 97 L139 96" stroke="${glassesColor}" stroke-width="2" />
      </g>
    `;
  } else if (glassesStyle === 'cat_eye') {
    // Elegant vintage wing frames
    glassesSvg = `
      <g stroke="${glassesColor}" stroke-width="2.2" fill="none" stroke-linejoin="round">
        <path d="M65 95 C71 91 87 93 92 99 C92 110 75 112 66 104 Z" fill="#ffffff" fill-opacity="0.1" />
        <path d="M135 95 C129 91 113 93 108 99 C108 110 125 112 134 104 Z" fill="#ffffff" fill-opacity="0.1" />
        <path d="M92 99 L108 99" stroke-width="2" />
        <path d="M65 95 L60 96" stroke-width="1.8" />
        <path d="M135 95 L140 96" stroke-width="1.8" />
      </g>
    `;
  }

  // --- HAT-AWARE AESTHETIC HAIR ---
  // Solid skull cap foundation ensures ZERO gap or white space on ANY animal head.
  const hasHat = hatStyle && hatStyle !== 'none';
  let hairSvg = '';

  if (hairStyle !== 'bald') {
    if (hasHat) {
      // Hat-adapted hair: fringe/bangs and side-locks peeking out under hat
      if (hairStyle === 'mid_curly' || hairStyle === 'curly') {
        hairSvg = `
          <g fill="${hairColor}">
            <!-- Soft curls peeking under brim across forehead and sides -->
            <circle cx="70" cy="74" r="9" />
            <circle cx="85" cy="75" r="9" />
            <circle cx="100" cy="74" r="9" />
            <circle cx="115" cy="75" r="9" />
            <circle cx="130" cy="74" r="9" />
            <!-- Bouncy side curls -->
            <circle cx="56" cy="88" r="9" />
            <circle cx="52" cy="104" r="9.5" />
            <circle cx="54" cy="120" r="9" />
            <circle cx="144" cy="88" r="9" />
            <circle cx="148" cy="104" r="9.5" />
            <circle cx="146" cy="120" r="9" />
          </g>
        `;
      } else if (hairStyle === 'short') {
        hairSvg = `
          <g fill="${hairColor}">
            <path d="M58 75 C72 70 96 69 110 74 C124 70 138 73 142 77 C132 81 120 78 108 82 C96 79 82 81 68 76 C62 76 58 75 58 75 Z" />
            <path d="M56 80 C54 86 57 95 61 98 C61 92 59 86 56 80 Z" />
            <path d="M144 80 C146 86 143 95 139 98 C139 92 141 86 144 80 Z" />
          </g>
        `;
      } else if (hairStyle === 'long') {
        hairSvg = `
          <g fill="${hairColor}">
            <path d="M58 75 C74 70 126 70 142 75 C132 79 120 77 106 79 C94 77 82 79 72 75 C64 75 60 74 58 75 Z" />
            <!-- Long locks streaming past shoulders -->
            <path d="M54 78 C50 96 46 122 48 148 C50 174 56 195 65 198 C67 190 64 165 60 142 C58 124 60 100 60 88 C60 83 57 80 54 78 Z" />
            <path d="M146 78 C150 96 154 122 152 148 C150 174 144 195 135 198 C133 190 136 165 140 142 C142 124 140 100 140 88 C140 83 143 80 146 78 Z" />
          </g>
        `;
      } else if (hairStyle === 'wavy' || hairStyle === 'bob') {
        hairSvg = `
          <g fill="${hairColor}">
            <path d="M58 75 C74 70 126 70 142 75 C132 79 120 77 106 79 C94 77 82 79 72 75 C64 75 60 74 58 75 Z" />
            <path d="M54 78 C51 94 52 110 57 122 C61 114 59 100 59 88 C59 83 57 80 54 78 Z" />
            <path d="M146 78 C149 94 148 110 143 122 C139 114 141 100 141 88 C141 83 143 80 146 78 Z" />
          </g>
        `;
      } else if (hairStyle === 'bun') {
        hairSvg = `
          <g fill="${hairColor}">
            <path d="M60 75 C76 70 124 70 140 75 C130 79 118 77 106 79 C94 77 82 79 72 75 C64 75 62 74 60 75 Z" />
            <circle cx="58" cy="86" r="8" />
            <circle cx="142" cy="86" r="8" />
          </g>
        `;
      } else {
        // sleek / default fallback
        hairSvg = `
          <g fill="${hairColor}">
            <path d="M58 75 C74 69 126 69 142 75 C128 79 114 77 102 80 C90 78 80 77 72 75 C64 75 60 74 58 75 Z" />
            <path d="M56 80 C55 89 57 99 60 104 C62 97 60 88 56 80 Z" />
            <path d="M144 80 C145 89 143 99 140 104 C138 97 140 88 144 80 Z" />
          </g>
        `;
      }
    } else {
      // Full standalone hairstyle:
      // Solid skull cap foundation seamlessly sealing over the skull curve (53 to 147, y=54 to 100)
      const skullCap = `<path d="M53 100 C51 68 70 54 100 54 C130 54 149 68 147 100 C140 90 126 80 100 80 C74 80 60 90 53 100 Z" />`;

      if (hairStyle === 'mid_curly' || hairStyle === 'curly') {
        // MID-LENGTH CURLS: bouncy, rich cartoon curls around skull and cascading past jaw/neck
        hairSvg = `
          <g fill="${hairColor}">
            ${skullCap}
            <!-- Crown & forehead curls -->
            <circle cx="100" cy="50" r="17" />
            <circle cx="82" cy="54" r="15" />
            <circle cx="118" cy="54" r="15" />
            <circle cx="66" cy="64" r="14" />
            <circle cx="134" cy="64" r="14" />
            <circle cx="56" cy="78" r="13" />
            <circle cx="144" cy="78" r="13" />
            <circle cx="88" cy="68" r="12" />
            <circle cx="112" cy="68" r="12" />
            <circle cx="74" cy="76" r="10" />
            <circle cx="126" cy="76" r="10" />
            <!-- Medium-length side curls cascading to jaw and shoulders -->
            <circle cx="52" cy="94" r="12.5" />
            <circle cx="50" cy="110" r="12" />
            <circle cx="53" cy="126" r="11" />
            <circle cx="58" cy="140" r="9.5" />
            <circle cx="148" cy="94" r="12.5" />
            <circle cx="150" cy="110" r="12" />
            <circle cx="147" cy="126" r="11" />
            <circle cx="142" cy="140" r="9.5" />
          </g>
        `;
      } else if (hairStyle === 'short') {
        // CLEAN SHORT HAIR: neat stylish swept fringe and clean trimmed sides
        hairSvg = `
          <g fill="${hairColor}">
            ${skullCap}
            <!-- Styled swept fringe across forehead -->
            <path d="M53 98 C50 64 70 48 100 48 C130 48 150 64 147 98 C140 80 128 72 116 76 C106 72 94 72 84 76 C72 72 60 80 53 98 Z" />
            <path d="M72 52 C86 48 114 48 128 52 C118 49 92 49 72 52 Z" fill="#ffffff" opacity="0.18" />
          </g>
        `;
      } else if (hairStyle === 'long') {
        // LONG HAIR: elegant straight/sleek long hair flowing far down over shoulders
        hairSvg = `
          <g fill="${hairColor}">
            ${skullCap}
            <!-- Crown coif and forehead framing -->
            <path d="M53 98 C50 64 70 48 100 48 C130 48 150 64 147 98 C138 78 122 72 102 75 C84 72 66 78 53 98 Z" />
            <path d="M72 52 C88 48 114 48 128 52 C118 49 92 49 72 52 Z" fill="#ffffff" opacity="0.18" />
            <!-- Left long hair strand extending past shoulders to chest -->
            <path d="M54 84 C48 104 44 130 46 156 C48 180 52 198 64 200 C67 200 68 186 64 166 C61 146 60 126 62 104 C62 94 59 86 54 84 Z" />
            <!-- Right long hair strand extending past shoulders to chest -->
            <path d="M146 84 C152 104 156 130 154 156 C152 180 148 198 136 200 C133 200 132 186 136 166 C139 146 140 126 138 104 C138 94 141 86 146 84 Z" />
          </g>
        `;
      } else if (hairStyle === 'wavy') {
        // MEDIUM-LENGTH WAVY: elegant soft waves down to collar
        hairSvg = `
          <g fill="${hairColor}">
            ${skullCap}
            <!-- Full top skull wave arch -->
            <path d="M53 98 C50 64 70 48 100 48 C130 48 150 64 147 98 C140 80 128 72 118 76 C108 72 96 72 88 76 C78 72 68 76 60 78 C55 83 53 90 53 98 Z" />
            <!-- Left flowing side wave down to collar -->
            <path d="M55 78 C51 92 49 112 55 128 C59 140 64 148 68 144 C67 136 62 122 61 106 C60 96 58 86 55 78 Z" />
            <!-- Right flowing side wave down to collar -->
            <path d="M145 78 C149 92 151 112 145 128 C141 140 136 148 132 144 C133 136 138 122 139 106 C140 96 142 86 145 78 Z" />
          </g>
        `;
      } else if (hairStyle === 'bob') {
        // CLASSIC BOB: clean chin-length rounded bob
        hairSvg = `
          <g fill="${hairColor}">
            ${skullCap}
            <!-- Classic cartoon bob curved around cheeks -->
            <path d="M52 90 C49 60 70 48 100 48 C130 48 151 60 148 90 C152 106 150 122 143 128 C140 116 141 100 137 88 C130 78 116 74 100 75 C84 74 70 78 63 88 C59 100 60 116 57 128 C50 122 48 106 52 90 Z" />
            <path d="M74 52 C88 48 112 48 126 52 C116 49 94 49 74 52 Z" fill="#ffffff" opacity="0.18" />
          </g>
        `;
      } else if (hairStyle === 'bun') {
        // ELEGANT TOPKNOT BUN: firmly anchored directly to the skull & hair crown (NO floating)
        hairSvg = `
          <g fill="${hairColor}">
            ${skullCap}
            <!-- Solid hair dome that sits directly on top of skull (no gap/floating) -->
            <path d="M53 98 C50 64 72 48 100 48 C128 48 150 64 147 98 C140 80 128 73 116 76 C106 72 94 72 84 76 C72 73 60 80 53 98 Z" />
            <!-- Bun base transition mound anchoring bun to the dome -->
            <ellipse cx="100" cy="50" rx="20" ry="8" />
            <!-- Velvet ribbon tie resting at bun junction -->
            <ellipse cx="100" cy="46" rx="13" ry="5" fill="#881337" />
            <!-- The full rounded topknot bun itself nestled securely on the head -->
            <circle cx="100" cy="36" r="17" />
            <circle cx="98" cy="33" r="13" opacity="0.18" fill="#ffffff" />
          </g>
        `;
      } else {
        // sleek / default
        hairSvg = `
          <g fill="${hairColor}">
            ${skullCap}
            <!-- Side-parted sleek cartoon swoosh -->
            <path d="M53 98 C50 64 70 48 102 48 C130 48 150 64 147 98 C136 78 120 73 104 76 C92 78 78 77 66 82 C58 82 54 88 53 98 Z" />
            <path d="M72 52 C88 48 118 48 132 54 C118 50 88 50 72 52 Z" fill="#ffffff" opacity="0.2" />
          </g>
        `;
      }
    }
  }

  // --- HATS (Refined, iconic, beautifully integrated with the animal head) ---
  let hatSvg = '';
  if (hatStyle === 'beret') {
    hatSvg = `
      <g>
        <ellipse cx="102" cy="50" rx="38" ry="15" fill="${hatColor}" transform="rotate(-6 102 50)" />
        <circle cx="102" cy="48" r="24" fill="${hatColor}" opacity="0.9" />
        <rect x="101" y="32" width="3" height="5" rx="1.5" fill="${hatColor}" />
      </g>
    `;
  } else if (hatStyle === 'party_hat') {
    hatSvg = `
      <g>
        <polygon points="100,20 78,60 122,60" fill="${hatColor}" />
        <circle cx="100" cy="20" r="5" fill="#fde047" />
        <circle cx="94" cy="42" r="2" fill="#ffffff" opacity="0.8" />
        <circle cx="106" cy="48" r="2.2" fill="#ffffff" opacity="0.8" />
      </g>
    `;
  } else if (hatStyle === 'bowler') {
    hatSvg = `
      <g>
        <ellipse cx="100" cy="46" rx="28" ry="19" fill="${hatColor}" />
        <rect x="73" y="54" width="54" height="6" rx="3" fill="#f59e0b" />
        <ellipse cx="100" cy="58" rx="36" ry="8" fill="${hatColor}" />
      </g>
    `;
  } else if (hatStyle === 'beanie') {
    hatSvg = `
      <g>
        <ellipse cx="100" cy="48" rx="32" ry="20" fill="${hatColor}" />
        <rect x="68" y="54" width="64" height="12" rx="5" fill="${hatColor}" stroke="#ffffff" stroke-opacity="0.25" stroke-width="1.2" />
        <circle cx="100" cy="28" r="6" fill="#fef08a" />
      </g>
    `;
  } else if (hatStyle === 'crown') {
    hatSvg = `
      <g>
        <polygon points="74,58 74,38 86,47 100,32 114,47 126,38 126,58" fill="#eab308" />
        <rect x="72" y="56" width="56" height="5" rx="2.5" fill="#ca8a04" />
        <circle cx="100" cy="33" r="2.8" fill="#ef4444" />
      </g>
    `;
  } else if (hatStyle === 'cap') {
    hatSvg = `
      <g>
        <ellipse cx="100" cy="49" rx="34" ry="16" fill="${hatColor}" />
        <circle cx="100" cy="41" r="2.5" fill="#f59e0b" />
        <path d="M72 56 C82 62 118 62 128 56 C122 62 78 62 72 56 Z" fill="#18181b" />
      </g>
    `;
  }

  // Centered inside circle
  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 200 200" width="${size}" height="${size}">
    <defs>
      <clipPath id="avatar-clip">
        <circle cx="100" cy="100" r="98" />
      </clipPath>
      <filter id="soft-shadow" x="-10%" y="-10%" width="120%" height="120%">
        <feDropShadow dx="0" dy="3" stdDeviation="3" flood-opacity="0.18" />
      </filter>
      <linearGradient id="toy-sheen" x1="0%" y1="0%" x2="100%" y2="100%">
        <stop offset="0%" stop-color="#ffffff" stop-opacity="0.25" />
        <stop offset="50%" stop-color="#ffffff" stop-opacity="0.04" />
        <stop offset="100%" stop-color="#000000" stop-opacity="0.22" />
      </linearGradient>
    </defs>
    <g clip-path="url(#avatar-clip)">
      <!-- Deep vintage background circle -->
      <circle cx="100" cy="100" r="100" fill="${bgColor}" />
      <circle cx="100" cy="100" r="100" fill="url(#toy-sheen)" />

      <!-- Ears behind head -->
      ${ears}

      <!-- Head Base -->
      <g filter="url(#soft-shadow)">
        ${headShape}
      </g>

      <!-- Animal Snout / Muzzle -->
      ${animalMuzzle}

      <!-- Soft Natural Blush -->
      ${blush}

      <!-- Clothes -->
      ${clothes}

      <!-- Eyebrows (subtle vintage expression) -->
      ${eyebrowSvg}

      <!-- Eyes -->
      ${eyesSvg}

      <!-- Nose -->
      ${noseSvg}

      <!-- Mouth -->
      ${mouthSvg}

      <!-- Hair (Hat-aware: gracefully tucks under hats, frames ears) -->
      ${hairSvg}

      <!-- Glasses (rest over eyes & hair temples) -->
      ${glassesSvg}

      <!-- Hat (crowning top of head) -->
      ${hatSvg}
    </g>
  </svg>`;
}

export function getCharacterAvatarDataUri(config: CharacterAvatarConfig, size = 200): string {
  const svg = renderCharacterSvgString(config, size);
  return `data:image/svg+xml;utf8,${encodeURIComponent(svg)}`;
}

// -------------------------------------------------------------
// PURE VISUAL SAMPLES: Render clean mini SVGs for each choice
// -------------------------------------------------------------

export function renderEyeSampleSvg(eyeStyle: string, eyeColor = '#0284c7'): string {
  let inner = '';
  if (eyeStyle === 'curved') {
    inner = `
      <path d="M8 18 C10 10 22 10 24 18" fill="none" stroke="${eyeColor}" stroke-width="4.5" stroke-linecap="round" />
      <path d="M32 18 C34 10 46 10 48 18" fill="none" stroke="${eyeColor}" stroke-width="4.5" stroke-linecap="round" />
    `;
  } else if (eyeStyle === 'cartoon') {
    inner = `
      <ellipse cx="16" cy="18" rx="9" ry="11" fill="#ffffff" stroke="#18181b" stroke-width="1.5" />
      <ellipse cx="17" cy="18" rx="5.5" ry="7" fill="${eyeColor}" />
      <circle cx="18" cy="18" r="3.2" fill="#09090b" />
      <circle cx="20" cy="15" r="2" fill="#ffffff" />

      <ellipse cx="40" cy="18" rx="9" ry="11" fill="#ffffff" stroke="#18181b" stroke-width="1.5" />
      <ellipse cx="39" cy="18" rx="5.5" ry="7" fill="${eyeColor}" />
      <circle cx="38" cy="18" r="3.2" fill="#09090b" />
      <circle cx="40" cy="15" r="2" fill="#ffffff" />
    `;
  } else if (eyeStyle === 'round') {
    inner = `
      <circle cx="16" cy="18" r="8" fill="${eyeColor}" />
      <circle cx="16" cy="18" r="4.5" fill="#09090b" />
      <circle cx="18.5" cy="15.5" r="2.2" fill="#ffffff" />

      <circle cx="40" cy="18" r="8" fill="${eyeColor}" />
      <circle cx="40" cy="18" r="4.5" fill="#09090b" />
      <circle cx="42.5" cy="15.5" r="2.2" fill="#ffffff" />
    `;
  } else if (eyeStyle === 'wink') {
    inner = `
      <path d="M8 18 C11 11 21 11 24 18" fill="none" stroke="${eyeColor}" stroke-width="4" stroke-linecap="round" />
      <circle cx="40" cy="17" r="8" fill="${eyeColor}" />
      <circle cx="40" cy="17" r="4.5" fill="#09090b" />
      <circle cx="42" cy="14.5" r="2.2" fill="#ffffff" />
    `;
  } else if (eyeStyle === 'stars') {
    inner = `
      <g fill="${eyeColor}">
        <path d="M16 9 L18 16 L25 18 L18 20 L16 27 L14 20 L7 18 L14 16 Z" />
        <circle cx="16" cy="18" r="1.8" fill="#ffffff" />
        <path d="M40 9 L42 16 L49 18 L42 20 L40 27 L38 20 L31 18 L38 16 Z" />
        <circle cx="40" cy="18" r="1.8" fill="#ffffff" />
      </g>
    `;
  } else {
    // sparkle
    inner = `
      <ellipse cx="16" cy="18" rx="7" ry="8.5" fill="#18181b" />
      <circle cx="18" cy="15" r="3.2" fill="#ffffff" />
      <circle cx="14" cy="20" r="1.6" fill="#ffffff" />

      <ellipse cx="40" cy="18" rx="7" ry="8.5" fill="#18181b" />
      <circle cx="42" cy="15" r="3.2" fill="#ffffff" />
      <circle cx="38" cy="20" r="1.6" fill="#ffffff" />
    `;
  }

  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 56 36" width="56" height="36">
    ${inner}
  </svg>`;
}

export function renderEyebrowSampleSvg(eyebrowStyle: string, color = '#27272a'): string {
  let inner = '';
  if (eyebrowStyle === 'gentle') {
    inner = `
      <g stroke="${color}" stroke-width="2.5" stroke-linecap="round" fill="none">
        <path d="M6 13 C10 8 18 8 22 12.5" />
        <path d="M26 12.5 C30 8 38 8 42 13" />
      </g>
    `;
  } else if (eyebrowStyle === 'arch') {
    inner = `
      <g stroke="${color}" stroke-width="2.5" stroke-linecap="round" fill="none">
        <path d="M6 15 C10 6 18 6 22 13" />
        <path d="M26 13 C30 6 38 6 42 15" />
      </g>
    `;
  } else if (eyebrowStyle === 'straight') {
    inner = `
      <g stroke="${color}" stroke-width="2.5" stroke-linecap="round" fill="none">
        <path d="M6 11 L22 10" />
        <path d="M26 10 L42 11" />
      </g>
    `;
  } else if (eyebrowStyle === 'dots') {
    inner = `
      <g fill="${color}">
        <circle cx="14" cy="11" r="2.8" />
        <circle cx="34" cy="11" r="2.8" />
      </g>
    `;
  } else if (eyebrowStyle === 'inquisitive') {
    inner = `
      <g stroke="${color}" stroke-width="2.5" stroke-linecap="round" fill="none">
        <path d="M6 13 C10 8 18 8 22 12.5" />
        <path d="M26 8 C30 2 38 3 42 10" />
      </g>
    `;
  } else {
    // none - subtle slash
    return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 48 24" width="48" height="24">
      <ellipse cx="24" cy="12" rx="16" ry="7" fill="none" stroke="#e5e7eb" stroke-width="1.2" stroke-dasharray="3,3" />
      <line x1="16" y1="18" x2="32" y2="6" stroke="#ef4444" stroke-width="2" stroke-linecap="round" />
    </svg>`;
  }

  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 48 24" width="48" height="24">
    ${inner}
  </svg>`;
}

export function renderNoseSampleSvg(noseStyle: string): string {
  let inner = '';
  if (noseStyle === 'curve') {
    inner = `<path d="M16 10 C24 14 24 24 16 24" fill="none" stroke="#be7037" stroke-width="3" stroke-linecap="round" />`;
  } else if (noseStyle === 'triangle') {
    inner = `<polygon points="20,8 10,24 30,24" fill="#1c1917" />`;
  } else if (noseStyle === 'oval') {
    inner = `<ellipse cx="20" cy="16" rx="8" ry="6" fill="#1c1917" />`;
  } else if (noseStyle === 'dot') {
    inner = `<circle cx="20" cy="16" r="5" fill="#1c1917" />`;
  } else if (noseStyle === 'drop') {
    inner = `
      <path d="M20 8 C15 14 13 20 15 24 C17 27 23 27 25 24 C27 20 25 14 20 8 Z" fill="#ea580c" />
      <circle cx="18" cy="19" r="1.5" fill="#ffffff" opacity="0.6" />
    `;
  } else {
    // button
    inner = `
      <ellipse cx="20" cy="16" rx="9" ry="6" fill="#18181b" />
      <ellipse cx="20" cy="14.5" rx="4" ry="2" fill="#ffffff" opacity="0.5" />
    `;
  }

  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 40 32" width="40" height="32">
    ${inner}
  </svg>`;
}

export function renderMouthSampleSvg(mouthStyle: string): string {
  let inner = '';
  if (mouthStyle === 'gentle') {
    inner = `<path d="M8 14 C16 22 28 22 36 14" fill="none" stroke="#713f12" stroke-width="3.5" stroke-linecap="round" />`;
  } else if (mouthStyle === 'laugh') {
    inner = `
      <path d="M6 10 C6 26 38 26 38 10 Z" fill="#881337" />
      <path d="M12 18 C18 14 26 14 32 18 C30 25 14 25 12 18 Z" fill="#f43f5e" />
    `;
  } else if (mouthStyle === 'smirk') {
    inner = `<path d="M10 18 C16 20 28 17 34 11" fill="none" stroke="#713f12" stroke-width="3.5" stroke-linecap="round" />`;
  } else if (mouthStyle === 'open_o') {
    inner = `
      <ellipse cx="22" cy="17" rx="8" ry="10" fill="#881337" />
      <ellipse cx="22" cy="18" rx="4.5" ry="5.5" fill="#f43f5e" />
    `;
  } else if (mouthStyle === 'tongue') {
    inner = `
      <path d="M6 12 C14 20 30 20 38 12" fill="none" stroke="#713f12" stroke-width="3.5" stroke-linecap="round" />
      <path d="M16 16 C16 27 28 27 28 16 Z" fill="#f43f5e" />
      <path d="M22 17 L22 24" stroke="#be123c" stroke-width="1.8" stroke-linecap="round" />
    `;
  } else {
    // broad smile
    inner = `
      <path d="M4 10 C4 26 40 26 40 10 Z" fill="#881337" />
      <path d="M6 10 C6 15 38 15 38 10 Z" fill="#ffffff" />
      <path d="M12 18 C16 15 28 15 32 18 C30 25 14 25 12 18 Z" fill="#fb7185" />
    `;
  }

  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 44 32" width="44" height="32">
    ${inner}
  </svg>`;
}

export function renderHairSampleSvg(hairStyle: string, hairColor = '#451a03'): string {
  let hairPart = '';
  if (hairStyle === 'mid_curly' || hairStyle === 'curly') {
    hairPart = `
      <circle cx="28" cy="16" r="11" />
      <circle cx="18" cy="18" r="9" />
      <circle cx="38" cy="18" r="9" />
      <circle cx="10" cy="24" r="8" />
      <circle cx="46" cy="24" r="8" />
      <circle cx="12" cy="30" r="7" />
      <circle cx="44" cy="30" r="7" />
      <circle cx="22" cy="24" r="7" />
      <circle cx="34" cy="24" r="7" />
      <!-- Medium curls dangling lower -->
      <circle cx="11" cy="38" r="6" />
      <circle cx="45" cy="38" r="6" />
      <circle cx="13" cy="45" r="5" />
      <circle cx="43" cy="45" r="5" />
    `;
  } else if (hairStyle === 'short') {
    hairPart = `
      <path d="M9 31 C8 17 15 13 28 13 C41 13 48 17 47 31 C43 27 38 27 34 24 C30 27 26 25 23 27 C19 24 14 27 9 31 Z" />
      <path d="M16 16 C22 14 34 14 40 16 C35 15 21 15 16 16 Z" fill="#ffffff" opacity="0.2" />
    `;
  } else if (hairStyle === 'long') {
    hairPart = `
      <path d="M9 31 C8 17 15 13 28 13 C41 13 48 17 47 31 C40 24 33 22 28 23 C22 22 16 24 9 31 Z" />
      <!-- Long straight locks falling past jaw/neck -->
      <path d="M9 28 C7 36 6 46 9 53 C11 53 14 47 13 36 C13 32 11 29 9 28 Z" />
      <path d="M47 28 C49 36 50 46 47 53 C45 53 42 47 43 36 C43 32 45 29 47 28 Z" />
      <path d="M16 16 C22 14 34 14 40 16 C35 15 21 15 16 16 Z" fill="#ffffff" opacity="0.2" />
    `;
  } else if (hairStyle === 'wavy') {
    hairPart = `
      <path d="M9 31 C8 17 15 13 28 13 C41 13 48 17 47 31 C44 26 38 24 33 26 C29 23 23 23 19 26 C15 24 12 26 9 31 Z" />
      <path d="M10 28 C7 38 7 48 12 53 C14 48 13 40 14 34 Z" />
      <path d="M46 28 C49 38 49 48 44 53 C42 48 43 40 42 34 Z" />
    `;
  } else if (hairStyle === 'bob') {
    hairPart = `
      <path d="M8 31 C7 17 15 13 28 13 C41 13 49 17 48 31 C50 40 49 49 45 53 C43 46 44 37 42 30 C38 25 32 23 28 24 C24 23 18 25 14 30 C12 37 13 46 11 53 C7 49 6 40 8 31 Z" />
      <path d="M16 16 C22 14 34 14 40 16 C35 15 21 15 16 16 Z" fill="#ffffff" opacity="0.2" />
    `;
  } else if (hairStyle === 'bun') {
    hairPart = `
      <!-- Anchored topknot bun connected directly to hair cap -->
      <circle cx="28" cy="11" r="7.5" />
      <circle cx="28" cy="14" r="3" fill="#881337" />
      <path d="M9 30 C8 17 15 14 28 14 C41 14 48 17 47 30 C43 26 38 24 34 26 C30 23 24 23 20 26 C15 24 12 26 9 30 Z" />
      <ellipse cx="28" cy="15" rx="7" ry="2.5" />
    `;
  } else if (hairStyle === 'sleek') {
    hairPart = `
      <path d="M9 30 C8 17 15 13 29 13 C41 13 47 17 47 30 C41 24 33 23 24 26 C18 28 12 27 9 30 Z" />
      <path d="M16 16 C22 14 34 14 40 16 C35 15 21 15 16 16 Z" fill="#ffffff" opacity="0.2" />
    `;
  } else {
    // bald / none: subtle clean line with slash
    return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 56 56" width="56" height="56">
      <ellipse cx="28" cy="30" rx="18" ry="18" fill="#fef3c7" stroke="#e5e7eb" stroke-width="1.5" />
      <line x1="16" y1="42" x2="40" y2="18" stroke="#ef4444" stroke-width="3" stroke-linecap="round" />
    </svg>`;
  }

  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 56 56" width="56" height="56">
    <ellipse cx="28" cy="32" rx="18" ry="18" fill="#ffdfbf" />
    <g fill="${hairColor}">
      ${hairPart}
    </g>
  </svg>`;
}

export function renderGlassesSampleSvg(glassesStyle: string, glassesColor = '#18181b'): string {
  let inner = '';
  if (glassesStyle === 'round') {
    inner = `
      <g stroke="${glassesColor}" stroke-width="3" fill="none" stroke-linecap="round">
        <circle cx="16" cy="18" r="10" fill="#ffffff" fill-opacity="0.3" />
        <circle cx="36" cy="18" r="10" fill="#ffffff" fill-opacity="0.3" />
        <path d="M26 18 L26 18" />
        <path d="M6 18 L2 17" />
        <path d="M46 18 L50 17" />
      </g>
    `;
  } else if (glassesStyle === 'thick') {
    inner = `
      <g stroke="${glassesColor}" stroke-width="3.5" fill="none" stroke-linejoin="round">
        <rect x="7" y="11" width="16" height="14" rx="4" fill="#ffffff" fill-opacity="0.3" />
        <rect x="29" y="11" width="16" height="14" rx="4" fill="#ffffff" fill-opacity="0.3" />
        <path d="M23 17 L29 17" stroke-width="4.5" />
      </g>
    `;
  } else if (glassesStyle === 'rect') {
    inner = `
      <g stroke="${glassesColor}" stroke-width="2.5" fill="none">
        <rect x="7" y="12" width="16" height="12" rx="3" fill="#ffffff" fill-opacity="0.3" />
        <rect x="29" y="12" width="16" height="12" rx="3" fill="#ffffff" fill-opacity="0.3" />
        <path d="M23 18 L29 18" />
      </g>
    `;
  } else if (glassesStyle === 'sunglasses') {
    inner = `
      <g stroke="${glassesColor}" stroke-width="2" fill="#18181b">
        <path d="M7 12 L24 12 C24 23 13 25 7 20 Z" />
        <path d="M45 12 L28 12 C28 23 39 25 45 20 Z" />
        <path d="M24 14 L28 14" stroke="${glassesColor}" stroke-width="3" />
        <path d="M10 15 L18 21" stroke="#ffffff" stroke-width="1.8" stroke-linecap="round" opacity="0.7" />
        <path d="M31 15 L39 21" stroke="#ffffff" stroke-width="1.8" stroke-linecap="round" opacity="0.7" />
      </g>
    `;
  } else if (glassesStyle === 'cat_eye') {
    inner = `
      <g stroke="${glassesColor}" stroke-width="2.5" fill="none" stroke-linejoin="round">
        <path d="M6 13 C11 10 21 12 24 16 C24 24 12 25 7 19 Z" fill="#ffffff" fill-opacity="0.3" />
        <path d="M46 13 C41 10 31 12 28 16 C28 24 40 25 45 19 Z" fill="#ffffff" fill-opacity="0.3" />
        <path d="M24 16 L28 16" />
      </g>
    `;
  } else {
    // none: crossed circle
    return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 52 36" width="52" height="36">
      <circle cx="26" cy="18" r="12" fill="none" stroke="#e5e7eb" stroke-width="2" />
      <line x1="17" y1="27" x2="35" y2="9" stroke="#ef4444" stroke-width="2.5" stroke-linecap="round" />
    </svg>`;
  }

  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 52 36" width="52" height="36">
    ${inner}
  </svg>`;
}

export function renderHatSampleSvg(hatStyle: string, hatColor = '#881337'): string {
  let inner = '';
  if (hatStyle === 'beret') {
    inner = `
      <ellipse cx="26" cy="22" rx="20" ry="8" fill="${hatColor}" transform="rotate(-8 26 22)" />
      <circle cx="26" cy="20" r="14" fill="${hatColor}" opacity="0.9" />
      <rect x="25" y="9" width="2" height="4" rx="1" fill="${hatColor}" />
    `;
  } else if (hatStyle === 'party_hat') {
    inner = `
      <polygon points="26,6 12,32 40,32" fill="${hatColor}" />
      <polygon points="26,6 20,32 32,32" fill="#fde047" opacity="0.8" />
      <circle cx="26" cy="6" r="3.5" fill="#ffffff" />
      <circle cx="26" cy="6" r="2" fill="#fde047" />
    `;
  } else if (hatStyle === 'bowler') {
    inner = `
      <ellipse cx="26" cy="18" rx="16" ry="12" fill="${hatColor}" />
      <ellipse cx="26" cy="25" rx="22" ry="6" fill="${hatColor}" />
      <path d="M12 23 C18 25 34 25 40 23" stroke="#f59e0b" stroke-width="2" />
    `;
  } else if (hatStyle === 'beanie') {
    inner = `
      <ellipse cx="26" cy="20" rx="17" ry="12" fill="${hatColor}" />
      <rect x="9" y="24" width="34" height="8" rx="3.5" fill="${hatColor}" stroke="#ffffff" stroke-opacity="0.3" stroke-width="1" />
      <circle cx="26" cy="8" r="4.5" fill="#ffffff" />
    `;
  } else if (hatStyle === 'crown') {
    inner = `
      <polygon points="12,28 12,14 18,20 26,11 34,20 40,14 40,28" fill="#eab308" stroke="#ca8a04" stroke-width="1.5" />
      <rect x="11" y="26" width="30" height="4" rx="1" fill="#ca8a04" />
      <circle cx="12" cy="14" r="1.8" fill="#e11d48" />
      <circle cx="26" cy="11" r="2.2" fill="#0284c7" />
      <circle cx="40" cy="14" r="1.8" fill="#e11d48" />
    `;
  } else if (hatStyle === 'cap') {
    inner = `
      <ellipse cx="26" cy="19" rx="18" ry="9" fill="${hatColor}" />
      <circle cx="26" cy="15" r="2" fill="#f59e0b" />
      <path d="M12 24 C18 27 34 27 40 24 C36 28 16 28 12 24 Z" fill="#18181b" />
    `;
  } else {
    // none: crossed circle
    return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 52 40" width="52" height="40">
      <circle cx="26" cy="20" r="12" fill="none" stroke="#e5e7eb" stroke-width="2" />
      <line x1="17" y1="29" x2="35" y2="11" stroke="#ef4444" stroke-width="2.5" stroke-linecap="round" />
    </svg>`;
  }

  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 52 40" width="52" height="40">
    ${inner}
  </svg>`;
}
