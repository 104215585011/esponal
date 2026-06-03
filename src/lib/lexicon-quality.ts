// Timestamp: 2026-06-03 13:00
// LEX-007 quality gate (pure, dependency-free so it is unit-testable).
//
// Confidence is scored from deterministic, zero-cost local signals only.
// No second model / authoritative-dictionary call (would double AI cost and
// fight the cost-reduction goal). Deterministic fields (conjugation / gender)
// still come from the rule engine upstream; AI only supplies soft fields.
import type { LexiconStatus } from "@prisma/client";

export const LEXICON_CANDIDATE_THRESHOLD = 60;

export type LexiconScoreSignals = {
  lemmaInDict: boolean;
  morphologyResolved: boolean;
  hasRealExample: boolean;
  meaningsClean: boolean;
  hasPartOfSpeech: boolean;
  degraded: boolean;
};

export type LexiconScoreResult = {
  score: number;
  status: Extract<LexiconStatus, "candidate" | "review">;
  reasons: string[];
};

const SCORE_WEIGHTS = {
  lemmaInDict: 25,
  morphologyResolved: 25,
  hasRealExample: 20,
  meaningsClean: 20,
  hasPartOfSpeech: 10
} as const;

function hasPlaceholder(value: string) {
  return value.includes("?") || value.includes("\uFFFD");
}

export function scoreLexiconEntry(signals: LexiconScoreSignals): LexiconScoreResult {
  const reasons: string[] = [];
  let score = 0;
  for (const key of Object.keys(SCORE_WEIGHTS) as (keyof typeof SCORE_WEIGHTS)[]) {
    if (signals[key]) {
      score += SCORE_WEIGHTS[key];
      reasons.push(key);
    }
  }

  // A degraded entry never auto-serves, no matter how the local signals add up.
  const status =
    !signals.degraded && score >= LEXICON_CANDIDATE_THRESHOLD ? "candidate" : "review";
  if (signals.degraded) reasons.push("degraded");

  return { score, status, reasons };
}

type DictionaryEntryLike = {
  partOfSpeech: string | null;
  meanings: string[];
  examples: { es: string; zh: string }[];
  conjugations?: unknown;
  nounForms?: unknown;
  adjectiveForms?: unknown;
  degraded?: boolean;
};

export function deriveScoreSignals(
  entry: DictionaryEntryLike,
  lemmaInDict: boolean
): LexiconScoreSignals {
  const meanings = Array.isArray(entry.meanings) ? entry.meanings : [];
  const meaningsClean =
    meanings.length > 0 &&
    meanings.every((m) => typeof m === "string" && m.trim() && !hasPlaceholder(m));
  const hasRealExample = Array.isArray(entry.examples)
    ? entry.examples.some((ex) => Boolean(ex?.es?.trim()) && Boolean(ex?.zh?.trim()))
    : false;

  return {
    lemmaInDict,
    morphologyResolved: Boolean(entry.conjugations || entry.nounForms || entry.adjectiveForms),
    hasRealExample,
    meaningsClean,
    hasPartOfSpeech: Boolean(entry.partOfSpeech?.trim()),
    degraded: Boolean(entry.degraded)
  };
}
