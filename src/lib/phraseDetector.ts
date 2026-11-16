// Timestamp: 2026-11-16 14:18
import {
  PHRASE_VERB_FORMS,
  SPANISH_PHRASE_DICT,
  type PhraseDictItem
} from "@/lib/phraseLexiconData";

export type DetectedPhraseSpan = {
  start: number;
  end: number;
  surface: string;
  lemma: string;
  kind: "collocation" | "phrase" | "idiom";
  zh: string;
};

type Token = {
  raw: string;
  normalized: string;
  start: number;
  end: number;
};

type CompiledPattern = {
  entry: PhraseDictItem;
  expectedTokens: string[];
  firstIsVerb: boolean;
  firstIsReflexive: boolean;
  verbFormsSet: Set<string> | null;
};

const WORD_RE = /[A-Za-zÁÉÍÓÚÜÑáéíóúüñ]+/g;
const REFLEXIVE_PRONOUNS = new Set(["me", "te", "se", "nos", "os"]);

function normalizeToken(value: string): string {
  return value
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .trim();
}

function tokenize(text: string): Token[] {
  const result: Token[] = [];
  for (const match of text.matchAll(WORD_RE)) {
    const raw = match[0];
    const start = match.index ?? 0;
    result.push({
      raw,
      normalized: normalizeToken(raw),
      start,
      end: start + raw.length
    });
  }
  return result;
}

function expandSlashVariants(lemma: string): string[][] {
  const rawParts = lemma.trim().split(/\s+/);
  let variants: string[][] = [[]];

  for (const part of rawParts) {
    if (part.includes("/")) {
      const choices = part
        .split("/")
        .map((c) => normalizeToken(c))
        .filter(Boolean);
      if (choices.length > 0) {
        const next: string[][] = [];
        for (const prefix of variants) {
          for (const choice of choices) {
            next.push([...prefix, choice]);
          }
        }
        variants = next;
        continue;
      }
    }
    const norm = normalizeToken(part);
    if (norm) {
      for (const prefix of variants) {
        prefix.push(norm);
      }
    }
  }

  return variants.filter((v) => v.length >= 2);
}

let cachedIndex: Map<string, CompiledPattern[]> | null = null;

function getIndex(): Map<string, CompiledPattern[]> {
  if (cachedIndex) return cachedIndex;

  const index = new Map<string, CompiledPattern[]>();

  for (const entry of SPANISH_PHRASE_DICT) {
    const variants = expandSlashVariants(entry.lemma);
    for (const expectedTokens of variants) {
      const first = expectedTokens[0];
      if (!first) continue;

      const forms = PHRASE_VERB_FORMS[first];
      const firstIsVerb = Boolean(forms && forms.length > 0);
      const firstIsReflexive =
        first.endsWith("arse") ||
        first.endsWith("erse") ||
        first.endsWith("irse") ||
        first === "irse";
      const verbFormsSet = firstIsVerb ? new Set(forms) : null;

      const pattern: CompiledPattern = {
        entry,
        expectedTokens,
        firstIsVerb,
        firstIsReflexive,
        verbFormsSet
      };

      const triggerKeys = verbFormsSet ? Array.from(verbFormsSet) : [first];
      for (const key of triggerKeys) {
        const bucket = index.get(key);
        if (bucket) {
          bucket.push(pattern);
        } else {
          index.set(key, [pattern]);
        }
      }
    }
  }

  for (const bucket of index.values()) {
    bucket.sort((a, b) => b.expectedTokens.length - a.expectedTokens.length);
  }

  cachedIndex = index;
  return index;
}

function matchPatternAt(
  tokens: Token[],
  startIndex: number,
  pattern: CompiledPattern
): { tokenLength: number; start: number; end: number } | null {
  const { expectedTokens, firstIsVerb, firstIsReflexive, verbFormsSet } = pattern;
  if (startIndex + expectedTokens.length > tokens.length) {
    return null;
  }

  for (let offset = 0; offset < expectedTokens.length; offset += 1) {
    const actual = tokens[startIndex + offset].normalized;
    const expected = expectedTokens[offset];
    if (offset === 0 && firstIsVerb && verbFormsSet) {
      if (!verbFormsSet.has(actual)) return null;
    } else if (actual !== expected) {
      return null;
    }
  }

  // 若是自复动词搭配（如 darse cuenta de / acordarse de），把紧邻前面的 me/te/se/nos/os 一并纳入高亮范围
  let spanStart = tokens[startIndex].start;
  if (
    firstIsReflexive &&
    startIndex > 0 &&
    REFLEXIVE_PRONOUNS.has(tokens[startIndex - 1].normalized) &&
    tokens[startIndex].start - tokens[startIndex - 1].end <= 2
  ) {
    spanStart = tokens[startIndex - 1].start;
  }

  return {
    tokenLength: expectedTokens.length,
    start: spanStart,
    end: tokens[startIndex + expectedTokens.length - 1].end
  };
}

/**
 * 同步识别西语句子中的固定搭配 / 短语 / 习语（支持动词变位与自复代词前置）。
 */
export function detectPhrasesInSentence(text: string): DetectedPhraseSpan[] {
  if (!text || text.length < 3) return [];
  const tokens = tokenize(text);
  if (tokens.length < 2) return [];

  const index = getIndex();
  const spans: DetectedPhraseSpan[] = [];

  for (let i = 0; i < tokens.length; i += 1) {
    const candidates = index.get(tokens[i].normalized);
    if (!candidates || candidates.length === 0) continue;

    let best: {
      tokenLength: number;
      start: number;
      end: number;
      entry: PhraseDictItem;
    } | null = null;

    for (const pattern of candidates) {
      const m = matchPatternAt(tokens, i, pattern);
      if (m && (!best || m.tokenLength > best.tokenLength)) {
        best = { ...m, entry: pattern.entry };
      }
    }

    if (!best) continue;

    spans.push({
      start: best.start,
      end: best.end,
      surface: text.slice(best.start, best.end),
      lemma: best.entry.lemma,
      kind: best.entry.kind,
      zh: best.entry.zh
    });

    i += best.tokenLength - 1;
  }

  return spans;
}
