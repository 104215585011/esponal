import {
  lookupFunctionWord,
  normalizeSpanishToken,
  type FunctionWordEntry
} from "@/lib/functionWords";

export type DissectToken = {
  raw: string;
  normalized: string;
  isWhitespace: boolean;
  isPunctuation: boolean;
  entry: FunctionWordEntry | null;
  lemma: string | null;
};

export function tokenizeSentence(text: string): DissectToken[] {
  const parts = text.match(/\S+|\s+/g) ?? [];
  const tokens: DissectToken[] = [];

  for (const part of parts) {
    if (/^\s+$/.test(part)) {
      tokens.push({
        raw: part,
        normalized: "",
        isWhitespace: true,
        isPunctuation: false,
        entry: null,
        lemma: null
      });
      continue;
    }

    const normalized = normalizeSpanishToken(part);
    const isPunctuation = normalized.length === 0;
    const match = isPunctuation ? null : lookupFunctionWord(part);

    tokens.push({
      raw: part,
      normalized,
      isWhitespace: false,
      isPunctuation,
      entry: match?.entry ?? null,
      lemma: match?.lemma ?? null
    });
  }

  return tokens;
}

export function summarizeDissection(tokens: DissectToken[]) {
  const wordTokens = tokens.filter((token) => !token.isWhitespace && !token.isPunctuation);
  const skeletonTokens = wordTokens.filter((token) => token.entry);
  const totalWords = wordTokens.length;
  const skeletonCount = skeletonTokens.length;
  const skeletonPercent =
    totalWords === 0 ? 0 : Math.round((skeletonCount / totalWords) * 100);

  return {
    totalWords,
    skeletonCount,
    skeletonPercent
  };
}
