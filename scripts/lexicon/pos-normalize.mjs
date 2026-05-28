// Timestamp: 2026-05-28 19:08
const ALIASES = new Map([
  ["adjective", "adj"],
  ["adjetivo", "adj"],
  ["adj.", "adj"],
  ["adverb", "adv"],
  ["adverbio", "adv"],
  ["adv.", "adv"],
  ["sustantivo", "noun_mf"],
  ["nombre", "noun_mf"],
  ["preposition", "prep"],
  ["preposicion", "prep"],
  ["preposición", "prep"],
  ["conjunction", "conj"],
  ["conjuncion", "conj"],
  ["conjunción", "conj"],
  ["determinante", "determiner"],
  ["determiner", "determiner"],
  ["determinante posesivo", "determiner"],
  ["possessive determiner", "determiner"],
  ["articulo", "article"],
  ["artículo", "article"],
  ["article", "article"],
  ["pronombre", "pronoun"],
  ["pronoun", "pronoun"],
  ["verbo", "verb"],
  ["verb", "verb"],
  ["interjeccion", "interjection"],
  ["interjección", "interjection"],
  ["interjection", "interjection"],
  ["numero", "numeral"],
  ["número", "numeral"],
  ["number", "numeral"],
  ["numeral", "numeral"]
]);

export const ALLOWED_WORD_PARTS_OF_SPEECH = new Set([
  "noun_m",
  "noun_f",
  "noun_mf",
  "verb",
  "adj",
  "adv",
  "pronoun",
  "prep",
  "article",
  "conj",
  "determiner",
  "interjection",
  "numeral"
]);

function clean(value) {
  return String(value ?? "")
    .trim()
    .toLowerCase()
    .normalize("NFC")
    .replace(/\s+/g, " ");
}

export function normalizeLexiconPartOfSpeech(value) {
  const raw = clean(value);
  if (!raw) return null;
  if (ALLOWED_WORD_PARTS_OF_SPEECH.has(raw)) return raw;
  if (ALIASES.has(raw)) return ALIASES.get(raw);

  const compact = raw.replace(/[._-]+/g, " ");
  if (ALIASES.has(compact)) return ALIASES.get(compact);

  const parts = compact
    .split(/\s*[/,;|]\s*/)
    .map((part) => ALIASES.get(part) ?? part)
    .filter((part) => ALLOWED_WORD_PARTS_OF_SPEECH.has(part));

  return parts[0] ?? null;
}

