import { readFile } from "node:fs/promises";
import path from "node:path";
import {
  tryConjugateVerb,
  type VerbConjugations
} from "@/lib/conjugate";
import { reportLookupFailure } from "@/lib/monitor";
import { redis } from "@/lib/redis";

export type DictionaryExample = {
  es: string;
  zh: string;
};

export type DictionaryEntry = {
  word: string;
  lemma: string;
  partOfSpeech: string | null;
  meanings: string[];
  examples: DictionaryExample[];
  phonetic: string | null;
  morphInfo: string | null;
  conjugations?: VerbConjugations;
  nounForms?: {
    singular: string;
    plural: string;
    gender: "m" | "f" | "mf";
  };
  adjectiveForms?: {
    ms: string;
    fs: string;
    mp: string;
    fp: string;
  };
  cached?: boolean;
  degraded?: boolean;
};

type LemmaEntry = {
  lemma: string;
  morphInfo: string;
  translation: string;
  partOfSpeech?: string;
};

type RawAIEntry = {
  lemma?: string;
  morphInfo?: string;
  pos?: string;
  meanings?: string[];
  example?: { es?: string; zh?: string };
  forms?: unknown;
};

let lemmaDictPromise: Promise<Record<string, LemmaEntry>> | null = null;

async function loadLemmaDict() {
  if (!lemmaDictPromise) {
    const dictPath = path.join(process.cwd(), "extension", "lemma-dict.json");
    lemmaDictPromise = readFile(dictPath, "utf8").then(
      (contents) => JSON.parse(contents) as Record<string, LemmaEntry>
    );
  }
  return lemmaDictPromise;
}

function normalizeWord(word: string) {
  return word
    .trim()
    .toLowerCase()
    .replace(/^[^\p{L}áéíóúüñ]+|[^\p{L}áéíóúüñ]+$/giu, "");
}

function isPlaceholder(value: string | undefined | null) {
  return !value || value.includes("?") || value.includes("�");
}

function inferLemma(form: string, dictEntry?: LemmaEntry) {
  if (dictEntry?.lemma && !isPlaceholder(dictEntry.lemma)) {
    return dictEntry.lemma;
  }
  if (form === "vivían") return "vivir";
  if (form.endsWith("ían")) return `${form.slice(0, -3)}ir`;
  if (form.endsWith("aban")) return `${form.slice(0, -4)}ar`;
  if (form.endsWith("aron")) return `${form.slice(0, -4)}ar`;
  if (form.endsWith("ieron")) return `${form.slice(0, -5)}er`;
  return form;
}

function normalizePartOfSpeech(value: unknown) {
  return typeof value === "string" && value.trim() ? value.trim() : null;
}

function normalizeMeanings(value: unknown) {
  return Array.isArray(value)
    ? value.filter((item): item is string => typeof item === "string" && item.trim().length > 0)
    : [];
}

function normalizeExample(value: unknown) {
  if (!value || typeof value !== "object") {
    return [];
  }

  const es = typeof (value as { es?: unknown }).es === "string"
    ? (value as { es: string }).es.trim()
    : "";
  const zh = typeof (value as { zh?: unknown }).zh === "string"
    ? (value as { zh: string }).zh.trim()
    : "";

  return es && zh ? [{ es, zh }] : [];
}

function normalizeFormValue(value: unknown) {
  if (typeof value !== "string") return null;
  const trimmed = value.trim();
  return trimmed.length > 0 && trimmed.length < 50 ? trimmed : null;
}

function getNounGender(partOfSpeech: string | null) {
  if (!partOfSpeech) return null;

  const normalized = partOfSpeech.toLowerCase();
  if (normalized.includes("n.mf")) return "mf";
  if (normalized.includes("n.m")) return "m";
  if (normalized.includes("n.f")) return "f";
  return null;
}

function isVerbPos(partOfSpeech: string | null) {
  return Boolean(partOfSpeech?.toLowerCase().startsWith("v"));
}

function validateNounForms(
  lemma: string,
  partOfSpeech: string | null,
  forms: unknown
): DictionaryEntry["nounForms"] | undefined {
  const gender = getNounGender(partOfSpeech);
  if (!gender || !forms || typeof forms !== "object") {
    return undefined;
  }

  const singular = normalizeFormValue((forms as { singular?: unknown }).singular);
  const plural = normalizeFormValue((forms as { plural?: unknown }).plural);
  if (!singular || !plural) {
    return undefined;
  }

  const normalizedLemma = lemma.toLowerCase();
  const normalizedSingular = singular.toLowerCase();
  const normalizedPlural = plural.toLowerCase();
  if (
    normalizedSingular !== normalizedLemma &&
    normalizedSingular !== `${normalizedLemma}s` &&
    normalizedSingular !== `${normalizedLemma}es`
  ) {
    return undefined;
  }

  if (
    normalizedPlural !== `${normalizedSingular}s` &&
    normalizedPlural !== `${normalizedSingular}es` &&
    normalizedPlural !== normalizedSingular
  ) {
    return undefined;
  }

  return { singular, plural, gender };
}

function validateAdjectiveForms(forms: unknown): DictionaryEntry["adjectiveForms"] | undefined {
  if (!forms || typeof forms !== "object") {
    return undefined;
  }

  const ms = normalizeFormValue((forms as { ms?: unknown }).ms);
  const fs = normalizeFormValue((forms as { fs?: unknown }).fs);
  const mp = normalizeFormValue((forms as { mp?: unknown }).mp);
  const fp = normalizeFormValue((forms as { fp?: unknown }).fp);

  if (!ms || !fs || !mp || !fp) {
    return undefined;
  }

  return { ms, fs, mp, fp };
}

async function safeCacheGet(key: string) {
  try {
    const cached = await redis.get(key);
    return typeof cached === "string" ? cached : null;
  } catch {
    return null;
  }
}

async function safeCacheSet(key: string, value: DictionaryEntry) {
  try {
    await redis.set(key, JSON.stringify(value), "EX", 60 * 60 * 24 * 30);
  } catch {
    // Cache unavailable, degrade silently.
  }
}

async function fetchAIEntry(
  word: string,
  hintLemma: string,
  morphInfo: string | null
): Promise<DictionaryEntry | null> {
  const apiKey = process.env.DASHSCOPE_API_KEY?.trim();
  const model = process.env.DASHSCOPE_MODEL?.trim() || "glm-5";
  if (!apiKey) return null;

  const promptLines = [
    "You are a Spanish morphological analyzer and dictionary assistant.",
    `The learner saw the word "${word}" in a Spanish text.`,
    "Step 1: Identify its lemma (infinitive for verbs; singular nominative for nouns/adjectives).",
    "Step 2: Generate a concise dictionary entry for that lemma in Chinese.",
    "Return JSON only, no markdown fences.",
    "",
    'Verb example: {"lemma":"tener","morphInfo":"yo presente indicativo","pos":"v.","meanings":["有","拥有","持有"],"example":{"es":"Tengo hambre.","zh":"我饿了。"}}',
    'Noun example: {"lemma":"libro","pos":"n.m.","meanings":["书"],"example":{"es":"Leo un libro.","zh":"我读一本书。"},"forms":{"singular":"libro","plural":"libros"}}',
    'Adjective example: {"lemma":"rojo","pos":"adj.","meanings":["红色的"],"example":{"es":"La rosa es roja.","zh":"玫瑰是红色的。"},"forms":{"ms":"rojo","fs":"roja","mp":"rojos","fp":"rojas"}}',
    morphInfo ? `Morphology context: ${morphInfo}` : ""
  ]
    .filter(Boolean)
    .join("\n");

  const res = await fetch(
    "https://dashscope.aliyuncs.com/compatible-mode/v1/chat/completions",
    {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${apiKey}`
      },
      body: JSON.stringify({
        model,
        messages: [{ role: "user", content: promptLines }],
        temperature: 0.1
      })
    }
  );

  if (!res.ok) return null;

  const data = (await res.json()) as { choices?: { message?: { content?: string } }[] };
  const raw = data.choices?.[0]?.message?.content;
  if (!raw) return null;

  const cleaned = raw.replace(/^```(?:json)?\s*/i, "").replace(/\s*```\s*$/, "").trim();
  const parsed = JSON.parse(cleaned) as RawAIEntry;

  const aiLemma =
    typeof parsed.lemma === "string" && parsed.lemma.trim().length > 0
      ? parsed.lemma.trim().toLowerCase()
      : hintLemma;

  const partOfSpeech = normalizePartOfSpeech(parsed.pos);
  const meanings = normalizeMeanings(parsed.meanings);
  if (meanings.length === 0) {
    return null;
  }

  const aiMorphInfo =
    typeof parsed.morphInfo === "string" && parsed.morphInfo.trim().length > 0
      ? parsed.morphInfo.trim()
      : morphInfo;

  return {
    word,
    lemma: aiLemma,
    partOfSpeech,
    meanings,
    examples: normalizeExample(parsed.example),
    phonetic: null,
    morphInfo: aiMorphInfo,
    nounForms: validateNounForms(aiLemma, partOfSpeech, parsed.forms),
    adjectiveForms:
      partOfSpeech?.toLowerCase().startsWith("adj")
        ? validateAdjectiveForms(parsed.forms)
        : undefined
  };
}

// LEX-007: whether a lemma (or form) is present in the bundled lemma dictionary.
// Used as a zero-cost confidence signal for the lexicon quality gate.
export async function isLemmaInDict(value: string): Promise<boolean> {
  const normalized = normalizeWord(value);
  if (!normalized) return false;
  const lemmaDict = await loadLemmaDict();
  if (lemmaDict[normalized]) return true;
  return Object.values(lemmaDict).some((entry) => entry.lemma === normalized);
}

export async function lookupDictionary(wordInput: string): Promise<DictionaryEntry | null> {
  const word = normalizeWord(wordInput);
  if (!word) return null;

  const lemmaDict = await loadLemmaDict();
  const dictEntry = lemmaDict[word];
  const hintLemma = inferLemma(word, dictEntry);
  const morphInfo = isPlaceholder(dictEntry?.morphInfo) ? null : (dictEntry?.morphInfo ?? null);
  const hintCacheKey = `vocab:dict:v3:${hintLemma}`;

  const hintCached = await safeCacheGet(hintCacheKey);
  if (hintCached) {
    return { ...(JSON.parse(hintCached) as DictionaryEntry), word, cached: true };
  }

  const aiEntry = await fetchAIEntry(word, hintLemma, morphInfo).catch((error) => {
    reportLookupFailure(word, error);
    return null;
  });

  if (aiEntry) {
    const aiLemma = aiEntry.lemma;
    const aiCacheKey = `vocab:dict:v3:${aiLemma}`;

    const aiCached = await safeCacheGet(aiCacheKey);
    if (aiCached) {
      return { ...(JSON.parse(aiCached) as DictionaryEntry), word, cached: true };
    }

    if (isVerbPos(aiEntry.partOfSpeech)) {
      aiEntry.conjugations = tryConjugateVerb(aiLemma) ?? undefined;
    }
    await safeCacheSet(aiCacheKey, aiEntry);
    return aiEntry;
  }

  const partOfSpeech = isPlaceholder(dictEntry?.partOfSpeech)
    ? null
    : (dictEntry?.partOfSpeech ?? null);

  return {
    word,
    lemma: hintLemma,
    partOfSpeech,
    meanings: isPlaceholder(dictEntry?.translation)
      ? []
      : [dictEntry?.translation ?? ""].filter(Boolean),
    examples: [],
    phonetic: null,
    morphInfo,
    conjugations: isVerbPos(partOfSpeech)
      ? (tryConjugateVerb(hintLemma) ?? undefined)
      : undefined,
    degraded: true
  };
}
