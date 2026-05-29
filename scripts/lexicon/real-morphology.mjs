// Timestamp: 2026-05-29 23:28
import { loadEnvFiles } from "./env-loader.mjs";
import { normalizeLexiconPartOfSpeech } from "./pos-normalize.mjs";

const PEOPLE = ["yo", "tu", "el", "nosotros", "vosotros", "ellos"];
const SUBJECT_PREFIX = /^(yo|tú|él|nosotros|vosotros|ellos)\s+/i;
const REFLEXIVE_PREFIX = /^(me|te|se|nos|os)\s+/i;
const REQUIRED_VERB_FORMS = new Map([
  ["poder", ["puedo", "puedes", "pude", "pudo", "pudiendo", "podré"]],
  ["querer", ["quiero", "quieres", "quise", "querré"]],
  ["estar", ["estoy", "está", "estuvo"]],
  ["tener", ["tengo", "tienes", "tuve", "tendrá"]],
  ["ir", ["voy", "vas", "fui", "irá", "yendo"]],
  ["ser", ["soy", "eres", "fui", "será"]],
  ["hacer", ["hago", "hice", "hizo", "haré"]]
]);

export function normalizeText(value) {
  return String(value ?? "").trim().toLowerCase().normalize("NFC").replace(/\s+/g, " ");
}

export function unique(values) {
  return [...new Set(values.map(normalizeText).filter(Boolean))];
}

export function expandLookupForms(values) {
  const expanded = [];
  for (const value of values) {
    const normalized = normalizeText(value);
    if (!normalized) continue;
    expanded.push(normalized);
    const withoutSubject = normalized.replace(SUBJECT_PREFIX, "");
    const bare = withoutSubject.replace(REFLEXIVE_PREFIX, "");
    if (bare && bare !== normalized) expanded.push(bare);
  }
  return unique(expanded);
}

export function parseJsonContent(content) {
  const trimmed = String(content ?? "").trim().replace(/^```(?:json)?\s*/i, "").replace(/\s*```$/i, "");
  return JSON.parse(trimmed);
}

export function flattenVerbForms(morphology) {
  if (!morphology || typeof morphology !== "object") return [];
  const values = [];
  for (const value of Object.values(morphology)) {
    if (typeof value === "string") {
      values.push(value);
      continue;
    }
    if (value && typeof value === "object") {
      values.push(...Object.values(value));
      for (const [person, form] of Object.entries(value)) {
        if (PEOPLE.includes(person) && typeof form === "string") {
          values.push(`${person === "tu" ? "tú" : person === "el" ? "él" : person} ${form}`);
        }
      }
    }
  }
  return unique(values);
}

function normalizePersonKey(key) {
  const normalized = normalizeText(key);
  if (/^[0-5]$/.test(normalized)) return PEOPLE[Number(normalized)];
  if (normalized === "tú") return "tu";
  if (normalized.includes("ellos") || normalized.includes("ellas") || normalized.includes("ustedes")) return "ellos";
  if (normalized === "él" || normalized.includes("ella") || normalized.includes("usted")) return "el";
  return normalized;
}

export function normalizeVerbMorphology(morphology) {
  if (!morphology || typeof morphology !== "object") return null;
  const normalized = {};
  for (const [tense, value] of Object.entries(morphology)) {
    if (typeof value === "string") {
      normalized[tense] = value;
      continue;
    }
    if (value && typeof value === "object") {
      normalized[tense] = Object.fromEntries(
        Object.entries(value).map(([person, form]) => [normalizePersonKey(person), form])
      );
    }
  }
  return normalized;
}

export function validateVerbMorphology(lemma, morphology) {
  const normalizedLemma = normalizeText(lemma);
  if (!morphology || typeof morphology !== "object") {
    throw new Error(`${normalizedLemma} missing verb morphology`);
  }
  const forms = flattenVerbForms(morphology);
  const required = REQUIRED_VERB_FORMS.get(normalizedLemma) ?? [];
  const missing = required.filter((form) => !forms.includes(form));
  if (missing.length > 0) {
    throw new Error(`${normalizedLemma} missing required forms: ${missing.join(", ")}`);
  }
  if (forms.length < 8) {
    throw new Error(`${normalizedLemma} verb morphology has too few forms`);
  }
  return forms;
}

export function normalizeExamples(value) {
  if (!Array.isArray(value)) return [];
  return value
    .map((example) => ({
      es: String(example?.es ?? example?.spanish ?? example?.exampleEs ?? "").trim(),
      zh: String(example?.zh ?? example?.chinese ?? example?.exampleZh ?? "").trim(),
      source: example.source ? String(example.source).trim() : "llm-generated"
    }))
    .filter((example) => example.es && example.zh)
    .slice(0, 3);
}

export function normalizeCefr(value) {
  const level = String(value ?? "").trim().toUpperCase();
  return ["A1", "A2", "B1", "B2", "C1", "C2"].includes(level) ? level : null;
}

export function normalizeB1Payload(lemma, raw) {
  const canonicalLemma = normalizeText(raw.canonicalLemma || raw.lemma || lemma);
  const partOfSpeech = normalizeLexiconPartOfSpeech(raw.partOfSpeech);
  const level = normalizeCefr(raw.cefr || raw.level);
  const examples = normalizeExamples(raw.examples);
  const rawMorphology = raw.morphology && typeof raw.morphology === "object"
    ? raw.morphology
    : raw.forms && typeof raw.forms === "object" && !Array.isArray(raw.forms)
      ? raw.forms
      : null;
  const morphology = partOfSpeech === "verb" ? normalizeVerbMorphology(rawMorphology) : rawMorphology;
  const aiForms = unique(Array.isArray(raw.forms) ? raw.forms : []);
  let forms = expandLookupForms([canonicalLemma, ...aiForms]);

  if (partOfSpeech === "verb") {
    forms = expandLookupForms([canonicalLemma, ...validateVerbMorphology(canonicalLemma, morphology)]);
  }

  return {
    isSpanishWord: raw.isSpanishWord !== false,
    isProperNoun: raw.isProperNoun === true,
    skipReason: String(raw.skipReason ?? "").trim(),
    lemma: canonicalLemma,
    displayForm: String(raw.displayForm || canonicalLemma).trim(),
    forms,
    partOfSpeech,
    level,
    ipa: raw.ipa ?? null,
    translationZh: raw.translationZh ?? "",
    translationEn: raw.translationEn ?? "",
    explanationZh: raw.explanationZh ?? "",
    examples,
    morphology
  };
}

export async function callDeepSeekLexicon(lemma, context = {}) {
  const mock = process.env.LEXICON_B1_MOCK_RESPONSES;
  if (mock) return JSON.parse(mock)[lemma] ?? {};

  await loadEnvFiles();
  const apiKey = process.env.DEEPSEEK_API_KEY ?? "";
  const baseUrl = (process.env.DEEPSEEK_BASE_URL ?? "https://api.deepseek.com").replace(/\/+$/, "");
  const model = process.env.DEEPSEEK_MODEL ?? "deepseek-chat";
  if (!apiKey || apiKey.includes("your-") || apiKey.includes("placeholder")) {
    throw new Error("DEEPSEEK_API_KEY is required without LEXICON_B1_MOCK_RESPONSES");
  }

  const response = await fetch(`${baseUrl}/v1/chat/completions`, {
    method: "POST",
    headers: {
      authorization: `Bearer ${apiKey}`,
      "content-type": "application/json"
    },
    body: JSON.stringify({
      model,
      temperature: 0.1,
      response_format: { type: "json_object" },
      messages: [
        {
          role: "system",
          content:
            "Return strict JSON for a Spanish lexicon entry. Keys: isSpanishWord, isProperNoun, skipReason, canonicalLemma, partOfSpeech, cefr, translationZh, translationEn, explanationZh, ipa, examples, forms, morphology. examples must be an array of 2 objects with es and zh keys, never plain strings. Use partOfSpeech from noun_m,noun_f,noun_mf,verb,adj,adv,pronoun,prep,article,conj,determiner,interjection,numeral. If verb, morphology must contain real Spanish conjugations, not mechanically regularized fake forms, with presente, preteritoIndefinido, preteritoImperfecto, futuro, condicional, presenteSubjuntivo, participio, gerundio."
        },
        {
          role: "user",
          content: JSON.stringify({ lemma, ...context })
        }
      ]
    })
  });

  if (!response.ok) {
    throw new Error(`DeepSeek API ${response.status}: ${(await response.text()).slice(0, 300)}`);
  }
  const payload = await response.json();
  return parseJsonContent(payload.choices?.[0]?.message?.content ?? "{}");
}
