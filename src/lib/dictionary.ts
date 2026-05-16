import { readFile } from "node:fs/promises";
import path from "node:path";
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
  cached?: boolean;
  degraded?: boolean;
};

type LemmaEntry = {
  lemma: string;
  morphInfo: string;
  translation: string;
  partOfSpeech?: string;
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
    await redis.set(key, JSON.stringify(value));
  } catch {
    // Cache unavailable — degrade silently
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
        Authorization: `Bearer ${apiKey}`,
      },
      body: JSON.stringify({
        model,
        messages: [
          {
            role: "user",
            content: `你是西班牙语词典助手。请为单词"${lemma}"生成词典条目，只返回JSON，不要任何解释，格式：{"pos":"词性缩写","meanings":["中文义项1","中文义项2"],"example":{"es":"西语例句","zh":"中文翻译"}}`,
          },
        ],
        temperature: 0.1,
      }),
    }
  );

  if (!res.ok) return null;

  const data = (await res.json()) as { choices?: { message?: { content?: string } }[] };
  const raw = data.choices?.[0]?.message?.content;
  if (!raw) return null;

  const cleaned = raw.replace(/^```(?:json)?\s*/i, "").replace(/\s*```\s*$/, "").trim();
  const parsed = JSON.parse(cleaned) as {
    pos?: string;
    meanings?: string[];
    example?: { es: string; zh: string };
  };

  if (!parsed.meanings?.length) return null;

  return {
    word,
    lemma,
    partOfSpeech: parsed.pos ?? null,
    meanings: parsed.meanings,
    examples: parsed.example ? [parsed.example] : [],
    phonetic: null,
    morphInfo,
  };
}

export async function lookupDictionary(wordInput: string): Promise<DictionaryEntry | null> {
  const word = normalizeWord(wordInput);
  if (!word) return null;

  const lemmaDict = await loadLemmaDict();
  const dictEntry = lemmaDict[word];
  const lemma = inferLemma(word, dictEntry);
  const morphInfo = isPlaceholder(dictEntry?.morphInfo) ? null : (dictEntry?.morphInfo ?? null);
  const cacheKey = `vocab:dict:${lemma}`;

  const cached = await safeCacheGet(cacheKey);
  if (cached) {
    return { ...(JSON.parse(cached) as DictionaryEntry), word, cached: true };
  }

  const aiEntry = await fetchAIEntry(word, lemma, morphInfo).catch((error) => {
    reportLookupFailure(word, error);
    return null;
  });

  if (!aiEntry) {
    // Degrade: return whatever lemma-dict has (may be empty meanings)
    return {
      word,
      lemma,
      partOfSpeech: isPlaceholder(dictEntry?.partOfSpeech) ? null : (dictEntry?.partOfSpeech ?? null),
      meanings: isPlaceholder(dictEntry?.translation) ? [] : [dictEntry?.translation ?? ""].filter(Boolean),
      examples: [],
      phonetic: null,
      morphInfo,
      degraded: true,
    };
  }

  await safeCacheSet(cacheKey, aiEntry);
  return aiEntry;
}
