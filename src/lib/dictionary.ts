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
  lemma: string,
  morphInfo: string | null
): Promise<DictionaryEntry | null> {
  const apiKey = process.env.DASHSCOPE_API_KEY?.trim();
  const model = process.env.DASHSCOPE_MODEL?.trim() || "glm-5";
  if (!apiKey) return null;

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
        messages: [
          {
            role: "user",
            content: [
              "You are a Spanish dictionary assistant.",
              `Generate a JSON dictionary entry for the lemma "${lemma}".`,
              "Return JSON only.",
              'Verb shape: {"pos":"v.","meanings":["..."],"example":{"es":"...","zh":"..."}}',
              'Noun shape: {"pos":"n.m." or "n.f.","meanings":["..."],"example":{"es":"...","zh":"..."},"forms":{"singular":"libro","plural":"libros"}}',
              'Adjective shape: {"pos":"adj.","meanings":["..."],"example":{"es":"...","zh":"..."},"forms":{"ms":"rojo","fs":"roja","mp":"rojos","fp":"rojas"}}',
              "Use concise Chinese meanings.",
              morphInfo ? `Morphology hint: ${morphInfo}` : "",
              `Observed surface form: ${word}`
            ]
              .filter(Boolean)
              .join("\n")
          }
        ],
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
  const partOfSpeech = normalizePartOfSpeech(parsed.pos);
  const meanings = normalizeMeanings(parsed.meanings);
  if (meanings.length === 0) {
    return null;
  }

  return {
    word,
    lemma,
    partOfSpeech,
    meanings,
    examples: normalizeExample(parsed.example),
    phonetic: null,
    morphInfo,
    nounForms: validateNounForms(lemma, partOfSpeech, parsed.forms),
    adjectiveForms:
      partOfSpeech?.toLowerCase().startsWith("adj")
        ? validateAdjectiveForms(parsed.forms)
        : undefined
  };
}

export async function lookupDictionary(wordInput: string): Promise<DictionaryEntry | null> {
  const word = normalizeWord(wordInput);
  if (!word) return null;

  const lemmaDict = await loadLemmaDict();
  const dictEntry = lemmaDict[word];
  const lemma = inferLemma(word, dictEntry);
  const morphInfo = isPlaceholder(dictEntry?.morphInfo) ? null : (dictEntry?.morphInfo ?? null);
  const cacheKey = `vocab:dict:v2:${lemma}`;

  const cached = await safeCacheGet(cacheKey);
  if (cached) {
    return { ...(JSON.parse(cached) as DictionaryEntry), word, cached: true };
  }

  const aiEntry = await fetchAIEntry(word, lemma, morphInfo).catch((error) => {
    reportLookupFailure(word, error);
    return null;
  });

  if (!aiEntry) {
    const partOfSpeech = isPlaceholder(dictEntry?.partOfSpeech)
      ? null
      : (dictEntry?.partOfSpeech ?? null);

    return {
      word,
      lemma,
      partOfSpeech,
      meanings: isPlaceholder(dictEntry?.translation)
        ? []
        : [dictEntry?.translation ?? ""].filter(Boolean),
      examples: [],
      phonetic: null,
      morphInfo,
      conjugations: isVerbPos(partOfSpeech) ? (tryConjugateVerb(lemma) ?? undefined) : undefined,
      degraded: true
    };
  }

  if (isVerbPos(aiEntry.partOfSpeech)) {
    aiEntry.conjugations = tryConjugateVerb(lemma) ?? undefined;
  }

  await safeCacheSet(cacheKey, aiEntry);
  return aiEntry;
}
