import type { LexiconKind } from "@prisma/client";
import { tryConjugateVerb } from "./conjugate.ts";
import { prisma } from "./prisma.ts";

export type PhraseSpan = {
  start: number;
  end: number;
  surface: string;
  lemma: string;
  kind: Extract<LexiconKind, "collocation" | "phrase" | "idiom">;
  lexiconEntryId: string;
};

type PhraseEntry = {
  id: string;
  lemma: string;
  kind: string;
};

type Token = {
  raw: string;
  normalized: string;
  start: number;
  end: number;
};

const WORD_RE = /\p{L}+/gu;
const PHRASE_KINDS = new Set(["collocation", "phrase", "idiom"]);
const conjugationCache = new Map<string, Set<string>>();
const IRREGULAR_VERB_FORMS: Record<string, string[]> = {
  ir: ["voy", "vas", "va", "vamos", "vais", "van"],
  tener: ["tengo", "tienes", "tiene", "tenemos", "teneis", "tienen"]
};

function normalizeToken(value: string) {
  return value
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .trim();
}

function tokenize(text: string): Token[] {
  return [...text.matchAll(WORD_RE)].map((match) => {
    const raw = match[0];
    const start = match.index ?? 0;
    return {
      raw,
      normalized: normalizeToken(raw),
      start,
      end: start + raw.length
    };
  });
}

function phraseTokens(lemma: string) {
  return tokenize(lemma).map((token) => token.normalized).filter(Boolean);
}

function flattenConjugations(lemma: string) {
  const cached = conjugationCache.get(lemma);
  if (cached) return cached;

  const forms = new Set([normalizeToken(lemma)]);
  for (const form of IRREGULAR_VERB_FORMS[lemma] ?? []) forms.add(normalizeToken(form));
  const conjugations = tryConjugateVerb(lemma);
  if (conjugations) {
    for (const value of Object.values(conjugations)) {
      if (typeof value === "string") {
        for (const token of phraseTokens(value)) forms.add(token);
      } else if (value && typeof value === "object") {
        for (const form of Object.values(value)) {
          if (typeof form === "string") forms.add(normalizeToken(form));
        }
      }
    }
  }

  conjugationCache.set(lemma, forms);
  return forms;
}

function isInfinitive(token: string) {
  return token.endsWith("ar") || token.endsWith("er") || token.endsWith("ir");
}

function tokenMatches(input: string, expected: string, allowVerbForm: boolean) {
  if (input === expected) return true;
  return allowVerbForm && isInfinitive(expected) && flattenConjugations(expected).has(input);
}

function matchAt(tokens: Token[], startIndex: number, entry: PhraseEntry) {
  const expectedTokens = phraseTokens(entry.lemma);
  if (expectedTokens.length === 0 || startIndex + expectedTokens.length > tokens.length) {
    return null;
  }

  for (let offset = 0; offset < expectedTokens.length; offset += 1) {
    const allowVerbForm = entry.kind === "collocation" && offset === 0;
    if (!tokenMatches(tokens[startIndex + offset].normalized, expectedTokens[offset], allowVerbForm)) {
      return null;
    }
  }

  return {
    tokenLength: expectedTokens.length,
    start: tokens[startIndex].start,
    end: tokens[startIndex + expectedTokens.length - 1].end
  };
}

function buildIndex(entries: PhraseEntry[]) {
  const index = new Map<string, PhraseEntry[]>();

  for (const entry of entries) {
    if (!PHRASE_KINDS.has(entry.kind)) continue;
    const tokens = phraseTokens(entry.lemma);
    const first = tokens[0];
    if (!first) continue;

    const keys = new Set([first]);
    if (entry.kind === "collocation" && isInfinitive(first)) {
      for (const form of flattenConjugations(first)) keys.add(form);
    }

    for (const key of keys) {
      const bucket = index.get(key) ?? [];
      bucket.push(entry);
      index.set(key, bucket);
    }
  }

  for (const bucket of index.values()) {
    bucket.sort((a, b) => phraseTokens(b.lemma).length - phraseTokens(a.lemma).length);
  }

  return index;
}

export function detectPhrasesFromEntries(text: string, entries: PhraseEntry[]): PhraseSpan[] {
  const tokens = tokenize(text);
  const index = buildIndex(entries);
  const spans: PhraseSpan[] = [];

  for (let tokenIndex = 0; tokenIndex < tokens.length; tokenIndex += 1) {
    const candidates = index.get(tokens[tokenIndex].normalized) ?? [];
    let best: (ReturnType<typeof matchAt> & { entry: PhraseEntry }) | null = null;

    for (const entry of candidates) {
      const match = matchAt(tokens, tokenIndex, entry);
      if (match && (!best || match.tokenLength > best.tokenLength)) {
        best = { ...match, entry };
      }
    }

    if (!best) continue;

    spans.push({
      start: best.start,
      end: best.end,
      surface: text.slice(best.start, best.end),
      lemma: best.entry.lemma,
      kind: best.entry.kind as PhraseSpan["kind"],
      lexiconEntryId: best.entry.id
    });
    tokenIndex += best.tokenLength - 1;
  }

  return spans;
}

export async function detectPhrasesInText(text: string): Promise<PhraseSpan[]> {
  // Only multi-token phrases qualify for highlighting. Single-token entries that
  // happen to live under kind=collocation/phrase/idiom (legacy data from Phase 3
  // seed where LLM mis-classified bare verbs like `poder`, `querer`, `gustar`)
  // would otherwise pollute the highlighted regions. Tracked for cleanup as
  // LEX-CLEANUP-001.
  const entries = await prisma.lexiconEntry.findMany({
    where: {
      kind: { in: ["collocation", "phrase", "idiom"] },
      lemma: { contains: " " }
    },
    select: {
      id: true,
      lemma: true,
      kind: true
    }
  });

  return detectPhrasesFromEntries(text, entries);
}
