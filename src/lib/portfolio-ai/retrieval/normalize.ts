/**
 * Bilingual (English / Arabic) text normalization for Smart Mode retrieval (PIE spec §6).
 * Pure and dependency-free: used on both the knowledge records and the visitor's question so the
 * two sides always agree.
 *
 * - Unicode NFKC, lower case, Arabic-Indic digits → ASCII.
 * - Arabic: diacritics and tatweel removed; alef/hamza (أ إ آ ٱ → ا), ya (ى ی → ي), ta marbuta
 *   (ة → ه), hamza seats (ؤ → و, ئ → ي) unified.
 * - Identifiers survive tokenization: Next.js → nextjs, C++ → cpp, C# → csharp, .NET → dotnet.
 * - Words written across scripts ("بـDocker") are split at the script boundary.
 */

const DIACRITICS = /[ؐ-ًؚ-ٰٟۖ-ۜ۟-۪ۨ-ۭ]/g;
const TATWEEL = /ـ/g;
const ARABIC_CHAR = /[؀-ۿ]/;
const ARABIC_CHARS = /[؀-ۿ]/g;
const LATIN_CHARS = /[a-z]/gi;

const IDENTIFIERS: ReadonlyArray<readonly [RegExp, string]> = [
  [/\bnext\s*\.?\s*js\b/gi, ' nextjs '],
  [/\bnode\s*\.?\s*js\b/gi, ' nodejs '],
  [/\bvue\s*\.?\s*js\b/gi, ' vuejs '],
  [/\bnuxt\s*\.?\s*js\b/gi, ' nuxtjs '],
  [/\breact\s*\.?\s*js\b/gi, ' react '],
  [/\bthree\s*\.?\s*js\b/gi, ' threejs '],
  [/\bc\s*\+\+/gi, ' cpp '],
  [/\bc\s*#/gi, ' csharp '],
  [/(?:^|[^\w])\.net\b/gi, ' dotnet '],
  [/\bgpt\s*-\s*(\d)/gi, ' gpt$1 '],
];

/** Normalizes letters only (no tokenization). */
export function normalizeText(input: string): string {
  let s = input.normalize('NFKC');
  for (const [re, to] of IDENTIFIERS) s = s.replace(re, to);
  s = s
    .toLowerCase()
    .replace(DIACRITICS, '')
    .replace(TATWEEL, '')
    .replace(/[أإآٱ]/g, 'ا')
    .replace(/[ىی]/g, 'ي')
    .replace(/ک/g, 'ك')
    .replace(/ة/g, 'ه')
    .replace(/ؤ/g, 'و')
    .replace(/ئ/g, 'ي')
    .replace(/[٠-٩]/g, (d) => String(d.charCodeAt(0) - 0x0660))
    .replace(/[۰-۹]/g, (d) => String(d.charCodeAt(0) - 0x06f0))
    // Split words that switch script mid-token ("بdocker" → "ب docker").
    .replace(/([؀-ۿ])([a-z0-9])/g, '$1 $2')
    .replace(/([a-z0-9])([؀-ۿ])/g, '$1 $2');
  return s.replace(/\s+/g, ' ').trim();
}

/** Letters/digits runs after normalization; keeps "90%" as "90%" so numbers stay checkable. */
export function tokenize(input: string): string[] {
  return normalizeText(input).match(/[\p{L}\p{N}]+%?/gu) ?? [];
}

export function isArabicToken(token: string): boolean {
  return ARABIC_CHAR.test(token);
}

/** Approximate language of a question: Arabic when Arabic letters are a substantial share. */
export function detectLanguage(text: string): 'en' | 'ar' {
  const ar = text.match(ARABIC_CHARS)?.length ?? 0;
  const la = text.match(LATIN_CHARS)?.length ?? 0;
  return ar > 0 && ar * 2 >= la ? 'ar' : 'en';
}

const AR_PREFIXES = ['وبال', 'وال', 'بال', 'كال', 'فال', 'لل', 'ال'];
const AR_SUFFIXES = ['هما', 'هم', 'ها', 'كم', 'نا', 'ه', 'ك', 'ي'];

/**
 * Matching variants of one token (light, conservative stemming): English plural/-ing/-ed forms;
 * Arabic proclitics (و ب ل ف ك + ال) and pronoun suffixes. The original token is always first.
 */
export function variants(token: string): string[] {
  const out = new Set<string>([token]);
  if (isArabicToken(token)) {
    const bases = [token];
    if (token.length > 3 && /^[وفب]/.test(token)) bases.push(token.slice(1));
    for (const base of bases) {
      out.add(base);
      for (const p of AR_PREFIXES) {
        if (base.startsWith(p) && base.length - p.length >= 2) out.add(base.slice(p.length));
      }
    }
    for (const v of [...out]) {
      for (const suf of AR_SUFFIXES) {
        if (v.endsWith(suf) && v.length - suf.length >= 3) out.add(v.slice(0, -suf.length));
      }
      // "خبرته" (his experience) → "خبره"; "سيرته" → "سيره".
      if (v.length > 4 && v.endsWith('ته')) out.add(`${v.slice(0, -2)}ه`);
    }
    return [...out];
  }
  if (token.length > 4 && token.endsWith('ies')) out.add(`${token.slice(0, -3)}y`);
  if (token.length > 4 && /(?:ss|sh|ch|x)es$/.test(token)) out.add(token.slice(0, -2));
  if (token.length > 3 && token.endsWith('s') && !token.endsWith('ss')) out.add(token.slice(0, -1));
  if (token.length > 5 && token.endsWith('ing')) out.add(token.slice(0, -3));
  if (token.length > 4 && token.endsWith('ed')) out.add(token.slice(0, -2));
  return [...out];
}

const STOP_EN = new Set(
  (
    'a an the is are was were be been being am do does did done of in on at to for with about and or ' +
    'what which who whom whose how when where why his her he she him hers i me my mine you your yours ' +
    'it its this that these those can could would should will shall may might must please tell show ' +
    'give any some there here has have had from by as into than then so if not no yes all also just ' +
    'more most very really much many get got let lets us we our they them their s t d ll re ve m'
  ).split(' '),
);
const STOP_AR = new Set(
  (
    'في من على عن الى الي ما ماذا هل هو هي انا انت انتي ده دي دا ايه اللي الي و يا مع كان كانت لو او ' +
    'ثم بس كده عايز عاوز عاوزه ممكن اعرف قولي قول لي ليا بتاع بتاعه بتاعته اي كل هذا هذه ذلك تلك ' +
    'التي الذي لها له به بها انه انها ازاي كيف لماذا ليه امتي متى اين فين'
  ).split(' '),
);

export function isStopword(token: string): boolean {
  return STOP_EN.has(token) || STOP_AR.has(token);
}

/** Content tokens of a question (stopwords removed), for retrieval and claim checks. */
export function contentTokens(input: string): string[] {
  return tokenize(input).filter((t) => !isStopword(t));
}
