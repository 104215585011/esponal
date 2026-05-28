// Timestamp: 2026-05-28 19:35
export const PHRASE_CSV_HEADER = ["lemma", "kind", "level", "category", "translation_zh", "keep"];
export const PHRASE_KINDS = new Set(["collocation", "phrase", "idiom"]);
export const PHRASE_LEVELS = new Set(["A1", "A2"]);

export function normalizeText(value) {
  return String(value ?? "").trim().replace(/\s+/g, " ");
}

export function normalizeLemma(value) {
  return normalizeText(value).toLowerCase();
}

export function slugCategory(value) {
  return normalizeText(value)
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "_")
    .replace(/^_+|_+$/g, "") || "general";
}

export function phrasePartOfSpeech(kind, category) {
  return `${kind}_${slugCategory(category)}`;
}

export function normalizePhraseCandidate(row) {
  const lemma = normalizeLemma(row.lemma);
  const kind = normalizeText(row.kind).toLowerCase();
  if (!lemma || !PHRASE_KINDS.has(kind)) return null;

  const level = PHRASE_LEVELS.has(normalizeText(row.level).toUpperCase())
    ? normalizeText(row.level).toUpperCase()
    : "A1";
  const category = slugCategory(row.category);
  return {
    lemma,
    kind,
    level,
    category,
    translation_zh: normalizeText(row.translation_zh ?? row.translationZh),
    keep: String(row.keep ?? "1").trim() === "0" ? "0" : "1"
  };
}

export function dedupePhraseCandidates(rows) {
  const byKey = new Map();
  for (const row of rows) {
    const candidate = normalizePhraseCandidate(row);
    if (!candidate) continue;
    const key = `${candidate.kind}:${candidate.lemma}`;
    if (!byKey.has(key)) byKey.set(key, candidate);
  }
  return [...byKey.values()];
}

export function parseCsv(text) {
  const rows = [];
  let field = "";
  let row = [];
  let quoted = false;

  for (let i = 0; i < text.length; i += 1) {
    const char = text[i];
    const next = text[i + 1];
    if (quoted) {
      if (char === "\"" && next === "\"") {
        field += "\"";
        i += 1;
      } else if (char === "\"") {
        quoted = false;
      } else {
        field += char;
      }
      continue;
    }

    if (char === "\"") quoted = true;
    else if (char === ",") {
      row.push(field);
      field = "";
    } else if (char === "\n") {
      row.push(field);
      rows.push(row);
      row = [];
      field = "";
    } else if (char !== "\r") {
      field += char;
    }
  }

  if (field || row.length > 0) {
    row.push(field);
    rows.push(row);
  }

  const [header = [], ...records] = rows.filter((item) => item.some((cell) => cell.trim()));
  return records.map((record) => Object.fromEntries(header.map((key, index) => [key, record[index] ?? ""])));
}

export function csvEscape(value) {
  const text = String(value ?? "");
  if (!/[",\r\n]/.test(text)) return text;
  return `"${text.replace(/"/g, "\"\"")}"`;
}

export function phraseCandidatesToCsv(rows) {
  return [
    PHRASE_CSV_HEADER.join(","),
    ...rows.map((row) => PHRASE_CSV_HEADER.map((key) => csvEscape(row[key])).join(","))
  ].join("\n") + "\n";
}

