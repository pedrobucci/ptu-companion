// Canonical semantic color data (canvas note "pokemon-ui-design-compliance",
// sections 2-6). This is the single source of truth for text-color
// selection at render time (see color.ts); the CSS custom properties in
// styles/pokemon-tokens.css carry the same values for actual painting, and
// a test (src/styles/__tests__/pokemonTokens.test.ts) asserts the two never
// drift apart.

export interface Triad {
  light: string;
  base: string;
  dark: string;
}

export const TYPES: Record<string, Triad> = {
  normal: { light: "#c1c2c1", base: "#9fa19f", dark: "#676967" },
  fire: { light: "#ef7374", base: "#e62829", dark: "#961a1b" },
  water: { light: "#74acf5", base: "#2980ef", dark: "#1b539b" },
  electric: { light: "#fcd659", base: "#fac000", dark: "#a37d00" },
  grass: { light: "#82c274", base: "#3fa129", dark: "#29691b" },
  ice: { light: "#81dff7", base: "#3dcef3", dark: "#28869e" },
  fighting: { light: "#ffac59", base: "#ff8000", dark: "#a65300" },
  poison: { light: "#b884dd", base: "#9141cb", dark: "#5e2a84" },
  ground: { light: "#b88e6f", base: "#915121", dark: "#5e3515" },
  flying: { light: "#add2f5", base: "#81b9ef", dark: "#54789b" },
  psychic: { light: "#f584a8", base: "#ef4179", dark: "#9b2a4f" },
  bug: { light: "#b8c26a", base: "#91a119", dark: "#5e6910" },
  rock: { light: "#cbc7ad", base: "#afa981", dark: "#726e54" },
  ghost: { light: "#a284a2", base: "#704170", dark: "#492a49" },
  dragon: { light: "#8d98ec", base: "#5060e1", dark: "#343e92" },
  dark: { light: "#998b8c", base: "#624d4e", dark: "#403233" },
  steel: { light: "#98c2d1", base: "#60a1b8", dark: "#3e6978" },
  fairy: { light: "#f5a2f5", base: "#ef70ef", dark: "#9b499b" },
  // A7: optional, only rendered when the resolved definition actually
  // reports a "stellar" type — never assumed present.
  stellar: { light: "#83cfc5", base: "#40b5a5", dark: "#2a766b" },
};

export const ITEM_CATEGORIES: Record<string, Triad> = {
  general: { light: "#d89db7", base: "#c86890", dark: "#82445e" },
  medicine: { light: "#eba27e", base: "#e07038", dark: "#924924" },
  pokeball: { light: "#dbb26e", base: "#c88820", dark: "#825815" },
  tm: { light: "#acc66e", base: "#80a820", dark: "#536d15" },
  berry: { light: "#6ec188", base: "#20a048", dark: "#15682f" },
  battle: { light: "#78a2eb", base: "#3070e0", dark: "#1f4992" },
  key: { light: "#b788e6", base: "#9048d8", dark: "#5e2f8c" },
  mail: { light: "#69b7cc", base: "#1890b0", dark: "#105e72" },
  treasure: { light: "#f7db8c", base: "#f2c74e", dark: "#9d8133" },
  ingredient: { light: "#ca8263", base: "#ad3f0f", dark: "#70290a" },
  zcrystal: { light: "#ceb38a", base: "#b48a4b", dark: "#755a31" },
  apricorn: { light: "#f5c169", base: "#f0a018", dark: "#9c6810" },
  cologne: { light: "#d2ccdc", base: "#bab1c9", dark: "#797383" },
};

/** Maps loose/plain-English category strings (as they may appear in
 * authored item definitions) onto the 13 canonical token keys above. */
export const ITEM_CATEGORY_ALIASES: Record<string, keyof typeof ITEM_CATEGORIES> = {
  item: "general",
  items: "general",
  general: "general",
  medicine: "medicine",
  "poke ball": "pokeball",
  "poke balls": "pokeball",
  pokeball: "pokeball",
  pokeballs: "pokeball",
  tm: "tm",
  hm: "tm",
  "tms/hms": "tm",
  "tm/hm": "tm",
  berry: "berry",
  berries: "berry",
  "battle item": "battle",
  "battle items": "battle",
  battle: "battle",
  "key item": "key",
  "key items": "key",
  key: "key",
  mail: "mail",
  treasure: "treasure",
  treasures: "treasure",
  ingredient: "ingredient",
  ingredients: "ingredient",
  "z-crystal": "zcrystal",
  "z-crystals": "zcrystal",
  zcrystal: "zcrystal",
  apricorn: "apricorn",
  apricorns: "apricorn",
  cologne: "cologne",
};

export const STATS: Record<string, Triad> = {
  hp: { light: "#9ee865", base: "#69dc12", dark: "#448f0c" },
  attack: { light: "#f5de69", base: "#efcc18", dark: "#9b8510" },
  defense: { light: "#f09a65", base: "#e86412", dark: "#97410c" },
  special_attack: { light: "#66d8f6", base: "#14c3f1", dark: "#0d7f9d" },
  special_defense: { light: "#899eea", base: "#4a6adf", dark: "#304591" },
  speed: { light: "#e46cca", base: "#d51dad", dark: "#8b1370" },
};

export const MOVE_CATEGORIES: Record<string, Triad> = {
  physical: { light: "#f29173", base: "#eb5628", dark: "#99381a" },
  special: { light: "#7d94cd", base: "#375ab2", dark: "#243b74" },
  status: { light: "#aeaeae", base: "#828282", dark: "#555555" },
};

export function normalizeKey(value: string): string {
  return value
    .trim()
    .toLowerCase()
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, ""); // fold diacritics: "Poké" -> "poke"
}
