// Timestamp: 2026-11-17 23:12
import type { LearningLanguage } from "@/lib/preferences";

export type WordTokenSegment = {
  raw: string;
  clean?: string;
};

type SegmenterInstance = {
  segment(input: string): Iterable<{ segment: string; isWordLike?: boolean }>;
};

let jaSegmenter: SegmenterInstance | null | undefined;

function getJaSegmenter(): SegmenterInstance | null {
  if (jaSegmenter !== undefined) return jaSegmenter;
  try {
    const IntlAny = Intl as unknown as {
      Segmenter?: new (
        locales?: string | string[],
        options?: { granularity?: "grapheme" | "word" | "sentence" }
      ) => SegmenterInstance;
    };
    jaSegmenter =
      typeof IntlAny?.Segmenter === "function"
        ? new IntlAny.Segmenter("ja", { granularity: "word" })
        : null;
  } catch {
    jaSegmenter = null;
  }
  return jaSegmenter;
}

const JA_KANA_RE = /[\u3040-\u30ff]/;
const JA_FALLBACK_RE =
  /([\u4e00-\u9faf\u3005]+[\u3041-\u3096]*|[\u30a1-\u30fc]+|[\u3041-\u309f]+|[A-Za-z0-9]+)/g;

function tokenizeJapaneseChunk(chunk: string): WordTokenSegment[] {
  const segmenter = getJaSegmenter();
  if (segmenter) {
    const out: WordTokenSegment[] = [];
    for (const part of segmenter.segment(chunk)) {
      const seg = part.segment;
      if (!seg) continue;
      if (part.isWordLike && /\p{L}/u.test(seg)) {
        out.push({ raw: seg, clean: seg.trim() });
      } else {
        out.push({ raw: seg });
      }
    }
    return out;
  }

  const out: WordTokenSegment[] = [];
  let cursor = 0;
  JA_FALLBACK_RE.lastIndex = 0;
  let match: RegExpExecArray | null;
  while ((match = JA_FALLBACK_RE.exec(chunk)) !== null) {
    if (match.index > cursor) {
      out.push({ raw: chunk.slice(cursor, match.index) });
    }
    const word = match[0];
    out.push({ raw: word, clean: word });
    cursor = match.index + word.length;
  }
  if (cursor < chunk.length) {
    out.push({ raw: chunk.slice(cursor) });
  }
  return out;
}

function cleanWordEdge(part: string): string {
  return part.replace(/^[^\p{L}]+|[^\p{L}]+$/gu, "").trim();
}

/**
 * 跨语种分词器：
 * - 日语 / 含假名文本：使用 Intl.Segmenter("ja")（并在无 Segmenter 运行时退化到汉字+假名正则分词），确保点词只选中单个词而非整句
 * - 西/德/英/法语：按空白切分并剥离首尾标点，额外拆分法语省音前缀（l'/d'/qu' 等）便于精确查词
 */
export function tokenizeTextChunk(
  chunk: string,
  language: LearningLanguage = "es"
): WordTokenSegment[] {
  if (!chunk) return [];

  if (language === "ja" || JA_KANA_RE.test(chunk)) {
    return tokenizeJapaneseChunk(chunk);
  }

  const parts = chunk.split(/(\s+)/);
  const out: WordTokenSegment[] = [];
  for (const part of parts) {
    if (!part) continue;

    if (language === "fr") {
      const elision = /^([^A-Za-zÀ-ÿ]*(?:qu|[cdjlmnst])[’'])([A-Za-zÀ-ÿ].*)$/i.exec(part);
      if (elision && !/^aujourd[’']hui/i.test(part)) {
        out.push({ raw: elision[1] });
        const tailClean = cleanWordEdge(elision[2]);
        if (tailClean) {
          out.push({ raw: elision[2], clean: tailClean });
        } else {
          out.push({ raw: elision[2] });
        }
        continue;
      }
    }

    if (/\p{L}/u.test(part)) {
      const clean = cleanWordEdge(part);
      if (clean) {
        out.push({ raw: part, clean });
        continue;
      }
    }
    out.push({ raw: part });
  }
  return out;
}
