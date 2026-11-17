// Timestamp: 2026-11-17 23:02
import { readFile } from "node:fs/promises";
import path from "node:path";
import {
  tryConjugateVerb,
  type VerbConjugations
} from "@/lib/conjugate";
import {
  lookupCuratedGermanEntry,
  resolveGermanSeparableVerb
} from "@/lib/german-lexicon";
import {
  LANGUAGE_LABELS,
  normalizeLanguage,
  type LearningLanguage
} from "@/lib/languages";
import { reportLookupFailure } from "@/lib/monitor";
import { redis } from "@/lib/redis";

export type DictionaryExample = {
  es: string;
  zh: string;
};

export type DictionaryEntry = {
  language?: LearningLanguage;
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
    gender: "m" | "f" | "n" | "mf";
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
  phonetic?: unknown;
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
    .replace(/^[^\p{L}áéíóúüñäöüß]+|[^\p{L}áéíóúüñäöüß]+$/giu, "");
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
  if (normalized.includes("n.n")) return "n";
  return null;
}

function isVerbPos(partOfSpeech: string | null) {
  return Boolean(partOfSpeech?.toLowerCase().startsWith("v"));
}

function validateNounForms(
  lemma: string,
  partOfSpeech: string | null,
  forms: unknown,
  language: LearningLanguage = "es"
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

  if (language === "de" || language === "fr") {
    return { singular, plural, gender };
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
  morphInfo: string | null,
  language: LearningLanguage = "es",
  context?: string
): Promise<DictionaryEntry | null> {
  const apiKey = process.env.DASHSCOPE_API_KEY?.trim();
  const model = process.env.DASHSCOPE_MODEL?.trim() || "glm-5";
  if (!apiKey) return null;

  const langPromptName =
    language === "de"
      ? "German"
      : language === "en"
        ? "English"
        : language === "fr"
          ? "French"
          : language === "ja"
            ? "Japanese"
            : "Spanish";

  const promptLines = [
    `You are a ${langPromptName} (${LANGUAGE_LABELS[language]}) morphological analyzer and dictionary assistant.`,
    `The learner saw the word "${word}" in a ${langPromptName} text.`,
    context ? `Sentence context: "${context}"` : "",
    "Step 1: Identify its lemma (infinitive/dictionary base form for verbs, including German separable verbs like aufstehen and Japanese dictionary forms like 食べる/起きる; singular nominative for nouns/adjectives).",
    "Step 2: Generate a concise dictionary entry for that lemma in Chinese. Include phonetic (hiragana+romaji for Japanese e.g. おきる / okiru, or IPA for English/French when helpful).",
    "Return JSON only, no markdown fences.",
    "",
    language === "de"
      ? 'Verb example: {"lemma":"aufstehen","morphInfo":"可分动词 (stehe ... auf)","pos":"v.","meanings":["起床","站起来"],"example":{"es":"Ich stehe um sieben Uhr auf.","zh":"我七点钟起床。"}}'
      : language === "ja"
        ? 'Verb example: {"lemma":"起きる","phonetic":"おきる (okiru)","morphInfo":"一段动词 · ます形 (起きます)","pos":"v.","meanings":["起床","发生"],"example":{"es":"毎朝七時に起きます。","zh":"我每天早上七点起床。"}}'
        : language === "fr"
          ? 'Verb example: {"lemma":"prendre","phonetic":"/pʁɑ̃dʁ/","morphInfo":"présent (je prends)","pos":"v.","meanings":["拿","乘坐","喝/吃"],"example":{"es":"Je prends le train le matin.","zh":"我早上坐火车。"}}'
          : language === "es"
            ? 'Verb example: {"lemma":"tener","morphInfo":"yo presente indicativo","pos":"v.","meanings":["有","拥有","持有"],"example":{"es":"Tengo hambre.","zh":"我饿了。"}}'
            : 'Verb example: {"lemma":"commute","phonetic":"/kəˈmjuːt/","morphInfo":"past tense / base","pos":"v.","meanings":["通勤","往返"],"example":{"es":"I commute by train every morning.","zh":"我每天早上坐火车通勤。"}}',
    language === "de"
      ? 'Noun example (MUST use n.m./n.f./n.n. and include definite article + plural in forms): {"lemma":"Fahrrad","pos":"n.n.","meanings":["自行车"],"example":{"es":"Das Fahrrad ist neu.","zh":"这辆自行车是新的。"},"forms":{"singular":"das Fahrrad","plural":"die Fahrräder"}}'
      : language === "fr"
        ? 'Noun example (use n.m./n.f. and include article + plural in forms): {"lemma":"gare","phonetic":"/ɡaʁ/","pos":"n.f.","meanings":["火车站"],"example":{"es":"La gare est près du centre.","zh":"火车站在市中心附近。"},"forms":{"singular":"la gare","plural":"les gares"}}'
        : language === "ja"
          ? 'Noun/Adjective example: {"lemma":"コーヒー","phonetic":"コーヒー (kōhī)","pos":"n.","meanings":["咖啡"],"example":{"es":"朝にコーヒーを飲みます。","zh":"早上喝咖啡。"}}'
          : language === "es"
            ? 'Noun example: {"lemma":"libro","pos":"n.m.","meanings":["书"],"example":{"es":"Leo un libro.","zh":"我读一本书。"},"forms":{"singular":"libro","plural":"libros"}}'
            : 'Noun example: {"lemma":"platform","phonetic":"/ˈplætfɔːrm/","pos":"n.","meanings":["站台","平台"],"example":{"es":"Wait on platform two.","zh":"请在二号站台等候。"}}',
    language === "es"
      ? 'Adjective example: {"lemma":"rojo","pos":"adj.","meanings":["红色的"],"example":{"es":"La rosa es roja.","zh":"玫瑰是红色的。"},"forms":{"ms":"rojo","fs":"roja","mp":"rojos","fp":"rojas"}}'
      : "",
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

  const aiPhonetic =
    typeof parsed.phonetic === "string" && parsed.phonetic.trim().length > 0
      ? parsed.phonetic.trim()
      : null;

  return {
    language,
    word,
    lemma: aiLemma,
    partOfSpeech,
    meanings,
    examples: normalizeExample(parsed.example),
    phonetic: aiPhonetic,
    morphInfo: aiMorphInfo,
    nounForms:
      language === "es" || language === "de" || language === "fr"
        ? validateNounForms(aiLemma, partOfSpeech, parsed.forms, language)
        : undefined,
    adjectiveForms:
      language === "es" && partOfSpeech?.toLowerCase().startsWith("adj")
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

export async function lookupDictionary(
  wordInput: string,
  options?: { language?: string; context?: string }
): Promise<DictionaryEntry | null> {
  const language = normalizeLanguage(options?.language);
  const context = options?.context?.trim() || undefined;
  const word = normalizeWord(wordInput);
  if (!word) return null;

  if (language === "de") {
    const curated = lookupCuratedGermanEntry(wordInput, context);
    if (curated) {
      return {
        language: "de",
        word,
        lemma: curated.lemma,
        partOfSpeech: curated.partOfSpeech,
        meanings: curated.meanings,
        examples: [{ es: curated.example.de, zh: curated.example.zh }],
        phonetic: null,
        morphInfo: curated.morphInfo ?? null,
        nounForms: curated.nounForms
      };
    }

    const sepMatch = resolveGermanSeparableVerb(wordInput, context);
    const lookupKey = sepMatch ? sepMatch.lemma : word;
    const hintMorph = sepMatch?.morphHint ?? null;
    const cacheKey = `vocab:dict:v4:de:${lookupKey}`;
    const cached = await safeCacheGet(cacheKey);
    if (cached) {
      return { ...(JSON.parse(cached) as DictionaryEntry), language: "de", word, cached: true };
    }

    const aiEntry = await fetchAIEntry(word, lookupKey, hintMorph, "de", context).catch((error) => {
      reportLookupFailure(word, error);
      return null;
    });

    if (aiEntry) {
      await safeCacheSet(cacheKey, aiEntry);
      return aiEntry;
    }

    return {
      language: "de",
      word,
      lemma: lookupKey,
      partOfSpeech: sepMatch ? "v.sep." : null,
      meanings: [],
      examples: [],
      phonetic: null,
      morphInfo: hintMorph,
      degraded: true
    };
  }

  if (language !== "es") {
    const cacheKey = `vocab:dict:v3:${language}:${word}`;
    const cached = await safeCacheGet(cacheKey);
    if (cached) {
      return { ...(JSON.parse(cached) as DictionaryEntry), language, word, cached: true };
    }

    const aiEntry = await fetchAIEntry(word, word, null, language, context).catch((error) => {
      reportLookupFailure(word, error);
      return null;
    });

    if (aiEntry) {
      await safeCacheSet(cacheKey, aiEntry);
      return aiEntry;
    }

    return {
      language,
      word,
      lemma: word,
      partOfSpeech: null,
      meanings: [],
      examples: [],
      phonetic: null,
      morphInfo: null,
      degraded: true
    };
  }

  const lemmaDict = await loadLemmaDict();
  const dictEntry = lemmaDict[word];
  const hintLemma = inferLemma(word, dictEntry);
  const morphInfo = isPlaceholder(dictEntry?.morphInfo) ? null : (dictEntry?.morphInfo ?? null);
  const hintCacheKey = `vocab:dict:v3:${hintLemma}`;

  const hintCached = await safeCacheGet(hintCacheKey);
  if (hintCached) {
    return { ...(JSON.parse(hintCached) as DictionaryEntry), language: "es", word, cached: true };
  }

  const aiEntry = await fetchAIEntry(word, hintLemma, morphInfo, "es").catch((error) => {
    reportLookupFailure(word, error);
    return null;
  });

  if (aiEntry) {
    const aiLemma = aiEntry.lemma;
    const aiCacheKey = `vocab:dict:v3:${aiLemma}`;

    const aiCached = await safeCacheGet(aiCacheKey);
    if (aiCached) {
      return { ...(JSON.parse(aiCached) as DictionaryEntry), language: "es", word, cached: true };
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
    language: "es",
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
