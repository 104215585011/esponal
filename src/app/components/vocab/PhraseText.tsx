"use client";

import { useEffect, useMemo, useState } from "react";

export type PhraseSpan = {
  start: number;
  end: number;
  surface: string;
  lemma: string;
  kind: "collocation" | "phrase" | "idiom";
  lexiconEntryId: string;
};

export type TextToken = {
  text: string;
  isWord: boolean;
};

export type PositionedToken = TextToken & {
  start: number;
  end: number;
};

export type PhraseSegment =
  | {
      type: "text";
      token: PositionedToken;
    }
  | {
      type: "phrase";
      span: PhraseSpan;
      tokens: PositionedToken[];
    };

export const PHRASE_HIGHLIGHT_CLASSES =
  "phrase-highlight inline bg-amber-100/50 dark:bg-amber-950/30 border-b border-amber-200/40 dark:border-amber-900/30 rounded px-1 py-0.5 mx-0.5 transition-colors duration-150 hover:bg-amber-200/50 dark:hover:bg-amber-900/45 cursor-pointer";

export function usePhraseSpans(text: string, enabled: boolean) {
  const [spans, setSpans] = useState<PhraseSpan[]>([]);
  const trimmedText = text.trim();

  useEffect(() => {
    let cancelled = false;
    const controller = new AbortController();

    async function detectPhrases() {
      if (!enabled || !trimmedText) {
        setSpans([]);
        return;
      }

      try {
        const response = await fetch("/api/lexicon/detect-phrases", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ text }),
          signal: controller.signal
        });

        if (!response.ok) {
          throw new Error(`Phrase detection failed: ${response.status}`);
        }

        const payload = (await response.json()) as { spans?: PhraseSpan[] };
        if (!cancelled) {
          setSpans(Array.isArray(payload.spans) ? payload.spans : []);
        }
      } catch (error) {
        if (!cancelled) {
          console.warn("Phrase detection failed", error);
          setSpans([]);
        }
      }
    }

    void detectPhrases();

    return () => {
      cancelled = true;
      controller.abort();
    };
  }, [enabled, text, trimmedText]);

  return spans;
}

export function positionTokens(tokens: TextToken[]) {
  let cursor = 0;
  return tokens.map((token) => {
    const positioned = {
      ...token,
      start: cursor,
      end: cursor + token.text.length
    };
    cursor = positioned.end;
    return positioned;
  });
}

export function buildPhraseSegments(tokens: TextToken[], spans: PhraseSpan[]): PhraseSegment[] {
  const positionedTokens = positionTokens(tokens);
  const sortedSpans = spans
    .slice()
    .sort((left, right) => left.start - right.start || right.end - left.end);
  const segments: PhraseSegment[] = [];
  let tokenIndex = 0;

  for (const span of sortedSpans) {
    while (tokenIndex < positionedTokens.length && positionedTokens[tokenIndex].end <= span.start) {
      segments.push({ type: "text", token: positionedTokens[tokenIndex] });
      tokenIndex += 1;
    }

    const phraseTokens: PositionedToken[] = [];
    while (
      tokenIndex < positionedTokens.length &&
      positionedTokens[tokenIndex].start >= span.start &&
      positionedTokens[tokenIndex].end <= span.end
    ) {
      phraseTokens.push(positionedTokens[tokenIndex]);
      tokenIndex += 1;
    }

    if (phraseTokens.some((token) => token.isWord)) {
      segments.push({ type: "phrase", span, tokens: phraseTokens });
    } else {
      for (const token of phraseTokens) {
        segments.push({ type: "text", token });
      }
    }
  }

  while (tokenIndex < positionedTokens.length) {
    segments.push({ type: "text", token: positionedTokens[tokenIndex] });
    tokenIndex += 1;
  }

  return segments;
}

export function usePhraseSegments(tokens: TextToken[], spans: PhraseSpan[]) {
  return useMemo(() => buildPhraseSegments(tokens, spans), [tokens, spans]);
}
