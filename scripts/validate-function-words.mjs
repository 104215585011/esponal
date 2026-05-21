import { readFile } from "node:fs/promises";

const DICTIONARY_PATH = new URL("../data/function-words.json", import.meta.url);

const VALID_CATEGORIES = new Set([
  "subject_pronoun",
  "reflexive",
  "object_pronoun",
  "article_definite",
  "article_indefinite",
  "preposition",
  "conjunction",
  "demonstrative",
  "possessive",
  "relative_interrogative"
]);

function assertString(value, label, errors) {
  if (typeof value !== "string" || value.trim() === "") {
    errors.push(`${label} must be a non-empty string`);
  }
}

function validateEntry(lemma, entry, errors) {
  if (!VALID_CATEGORIES.has(entry?.category)) {
    errors.push(`${lemma}.category must be one of ${Array.from(VALID_CATEGORIES).join(", ")}`);
  }

  assertString(entry?.english, `${lemma}.english`, errors);
  assertString(entry?.esEnContrast, `${lemma}.esEnContrast`, errors);

  if (!Array.isArray(entry?.chinese) || entry.chinese.length === 0) {
    errors.push(`${lemma}.chinese must be a non-empty array`);
  } else {
    entry.chinese.forEach((value, index) => assertString(value, `${lemma}.chinese[${index}]`, errors));
  }

  if (!Array.isArray(entry?.examples) || entry.examples.length < 2) {
    errors.push(`${lemma}.examples must contain at least 2 examples`);
  } else {
    entry.examples.forEach((example, index) => {
      assertString(example?.es, `${lemma}.examples[${index}].es`, errors);
      assertString(example?.en, `${lemma}.examples[${index}].en`, errors);
      assertString(example?.zh, `${lemma}.examples[${index}].zh`, errors);
    });
  }

  if (!Number.isInteger(entry?.frequencyRank) || entry.frequencyRank <= 0) {
    errors.push(`${lemma}.frequencyRank must be a positive integer`);
  }
}

const raw = await readFile(DICTIONARY_PATH, "utf8");
const dictionary = JSON.parse(raw);
const errors = [];

assertString(dictionary?._meta?.source, "_meta.source", errors);
assertString(dictionary?._meta?.license, "_meta.license", errors);
assertString(dictionary?._meta?.lastUpdated, "_meta.lastUpdated", errors);

const entries = dictionary?.entries;
if (!entries || typeof entries !== "object" || Array.isArray(entries)) {
  errors.push("entries must be an object");
} else {
  for (const [lemma, entry] of Object.entries(entries)) {
    validateEntry(lemma, entry, errors);
  }
}

if (errors.length > 0) {
  console.error(errors.join("\n"));
  process.exit(1);
}

console.log(`Function-word dictionary valid: ${Object.keys(entries).length} entries`);
