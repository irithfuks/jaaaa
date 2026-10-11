/**
 * Universal Multilingual Text Normalization & Search Utility
 * 
 * Provides robust diacritics, vowels, and script normalization for:
 * - Hebrew: Niqqud (vowels), Ta'amim (cantillation marks), Dagesh, Shin/Sin dots, Geresh/Gershayim
 * - Arabic: Harakat (short vowels), Tashkeel, Tanween, Shadda, Sukun, Dagger Alif, Quranic signs, Tatweel
 * - Persian / Farsi: Harakat/Erab, Tashdid, Tanvin, Yeh variants (ي/ى/ی), Kaf variants (ك/ک), ZWNJ (\u200C)
 * - Latin / European: Combining accents (é, è, ê, ü, ï, ñ, etc.)
 */

/**
 * Strips diacritics, vowels, cantillation, tatweel, and zero-width joiners across
 * Hebrew, Arabic, Persian, and Latin languages.
 */
export function stripDiacriticsAndVowels(text: string): string {
  if (!text) return '';
  return text
    // Decompose precomposed characters into base characters + combining marks
    .normalize('NFKD')
    // Hebrew Niqqud, Ta'amim, and points: U+0591 to U+05C7
    .replace(/[\u0591-\u05C7]/g, '')
    // Arabic & Persian diacritics, harakat, tashkeel, tanween, dagger alif, and Quranic signs
    // U+0610-U+061A, U+064B-U+065F, U+0670, U+06D6-U+06ED
    .replace(/[\u0610-\u061A\u064B-\u065F\u0670\u06D6-\u06ED]/g, '')
    // Arabic Tatweel / Kashida (elongation mark U+0640)
    .replace(/\u0640/g, '')
    // Zero-width characters (ZWNJ \u200C, ZWJ \u200D, ZWSP \u200B, LTR/RTL marks, BOM \uFEFF)
    .replace(/[\u200B-\u200F\uFEFF]/g, '')
    // European / Latin combining diacritical marks (accents U+0300 to U+036F)
    .replace(/[\u0300-\u036F]/g, '');
}

/**
 * Normalizes text for search indexing and matching:
 * - Strips vowels / diacritics
 * - Normalizes letter variants in Arabic/Persian (Alef variants, Yeh/Yaa variants, Kaf/Keheh variants, Taa marbuta)
 * - Normalizes Hebrew typography (geresh, gershayim, maqaf)
 * - Lowercases and trims
 */
export function normalizeScriptForSearch(text: string): string {
  if (!text) return '';
  return stripDiacriticsAndVowels(text)
    // Arabic / Persian Alef unification: [أ, إ, آ, ٱ] -> ا
    .replace(/[\u0622\u0623\u0625\u0671]/g, '\u0627')
    // Arabic / Persian Yaa unification: [ي, ى, ی] -> Persian Yeh ی (\u06CC)
    .replace(/[\u064A\u0649\u06CC]/g, '\u06CC')
    // Arabic / Persian Kaf unification: [ك, ک] -> Persian Keheh ک (\u06A9)
    .replace(/[\u0643\u06A9]/g, '\u06A9')
    // Arabic Taa marbuta -> Haa: ة -> ه
    .replace(/\u0629/g, '\u0647')
    // Persian Heh with Yeh above: ۀ -> ه
    .replace(/\u06C0/g, '\u0647')
    // Waw with Hamza -> Waw: ؤ -> و
    .replace(/\u0624/g, '\u0648')
    // Hebrew punctuation normalization: geresh / gershayim to ASCII quotes
    .replace(/\u05F3/g, "'")
    .replace(/\u05F4/g, '"')
    .replace(/\u05BE/g, '-')
    .toLowerCase()
    .trim();
}

/**
 * Checks whether a target string matches a search query, with or without diacritics/vowels.
 * Matches:
 * - Exact or case-insensitive substring
 * - Normalized substring (vowel-less and diacritic-insensitive)
 * - Space-collapsed substring (for compound words or words written with ZWNJ vs spaces)
 */
export function matchesSearchText(target?: string | null, query?: string | null): boolean {
  if (!target || !query) return false;
  const rawQ = query.toLowerCase().trim();
  if (!rawQ) return true;

  const rawT = target.toLowerCase();
  // 1. Direct lowercase substring check
  if (rawT.includes(rawQ)) return true;

  // 2. Normalized script check (strips nikud, harakat, accents, and unifies letter variants)
  const normT = normalizeScriptForSearch(target);
  const normQ = normalizeScriptForSearch(query);
  if (!normQ) return false;
  if (normT.includes(normQ)) return true;

  // 3. Space-collapsed check (e.g. Persian compound words or ZWNJ vs spaces)
  const noSpaceT = normT.replace(/\s+/g, '');
  const noSpaceQ = normQ.replace(/\s+/g, '');
  if (noSpaceT && noSpaceQ && noSpaceT.includes(noSpaceQ)) return true;

  return false;
}

/**
 * Word item interface matching vocabulary entries across the application.
 */
export interface SearchableWordItem {
  targetWord?: string;
  translation?: string;
  transliteration?: string;
  alternativeTranslations?: string[];
  exampleTarget?: string;
  exampleTranslation?: string;
  [key: string]: any;
}

/**
 * Evaluates whether a vocabulary word matches a search query across:
 * - targetWord (with/without vowels/nikudim/harakat)
 * - translation (Dutch/English/etc.)
 * - transliteration (Latin phonetic pronunciation)
 * - alternativeTranslations (all accepted synonyms)
 */
export function matchesWordItem(item: SearchableWordItem, searchQuery: string): boolean {
  if (!item || !searchQuery) return false;
  const q = searchQuery.trim();
  if (!q) return true;

  // 1. Target word match (Hebrew, Arabic, Persian, etc. with/without vowels)
  if (item.targetWord && matchesSearchText(item.targetWord, q)) {
    return true;
  }

  // 2. Primary translation match
  if (item.translation && matchesSearchText(item.translation, q)) {
    return true;
  }

  // 3. Transliteration / Phonetic match
  if (item.transliteration && matchesSearchText(item.transliteration, q)) {
    return true;
  }

  // 4. Alternative translations match
  if (item.alternativeTranslations && Array.isArray(item.alternativeTranslations)) {
    for (const alt of item.alternativeTranslations) {
      if (alt && matchesSearchText(alt, q)) {
        return true;
      }
    }
  }

  return false;
}
