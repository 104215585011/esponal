import { getServerSession } from "next-auth";
import { NextResponse } from "next/server";
import { getAuthOptions } from "@/lib/auth";
import { type DictionaryEntry, lookupDictionary } from "@/lib/dictionary";
import {
  deriveScoreSignals,
  findLexiconLookupEntry,
  findConstructionEntry,
  findRelatedPhraseEntries,
  incrementLookupCount,
  scoreLexiconEntry,
  upsertLexiconEntry
} from "@/lib/lexicon";
import { isLemmaInDict } from "@/lib/dictionary";
import { reportLookupFailure } from "@/lib/monitor";
import { getWordWithEncounters } from "@/lib/vocab";
import {
  checkRateLimit,
  getRetryAfterSec,
  lookupLimiter
} from "@/lib/ratelimit";
import type { LexiconEntry } from "@prisma/client";

type RelatedPhrase = {
  lemma: string;
  translationZh: string | null;
  kind: string;
};

function elapsedMs(startedAt: number) {
  return String(Math.max(0, Math.round(performance.now() - startedAt)));
}

function lexiconHeaders(hit: boolean, source: "lexicon" | "external", startedAt: number) {
  return {
    "X-Lexicon-Hit": hit ? "1" : "0",
    "X-Lookup-Source": source,
    "X-Lookup-Latency-Ms": elapsedMs(startedAt)
  };
}

function isJsonObject(value: unknown): value is Record<string, unknown> {
  return Boolean(value && typeof value === "object" && !Array.isArray(value));
}

function getExamples(value: unknown) {
  return Array.isArray(value)
    ? value.filter(
        (example): example is { es: string; zh: string } =>
          isJsonObject(example) &&
          typeof example.es === "string" &&
          typeof example.zh === "string"
      )
    : [];
}

function getMeanings(entry: LexiconEntry) {
  return [
    entry.translationZh,
    entry.explanationZh
  ].filter((value): value is string => Boolean(value?.trim()));
}

function mapMorphology(entry: LexiconEntry) {
  return isJsonObject(entry.morphology) ? entry.morphology : null;
}

function nounForms(entry: LexiconEntry) {
  const morphology = mapMorphology(entry);
  const singular = typeof morphology?.singular === "string" ? morphology.singular : null;
  const plural = typeof morphology?.plural === "string" ? morphology.plural : null;
  if (!singular || !plural) return undefined;

  const pos = entry.partOfSpeech?.toLowerCase() ?? "";
  const gender = pos.includes("noun_mf") ? "mf" : pos.includes("noun_f") ? "f" : "m";
  return { singular, plural, gender };
}

function adjectiveForms(entry: LexiconEntry) {
  const morphology = mapMorphology(entry);
  const ms = typeof morphology?.masc_sg === "string" ? morphology.masc_sg : null;
  const fs = typeof morphology?.fem_sg === "string" ? morphology.fem_sg : null;
  const mp = typeof morphology?.masc_pl === "string" ? morphology.masc_pl : null;
  const fp = typeof morphology?.fem_pl === "string" ? morphology.fem_pl : null;
  return ms && fs && mp && fp ? { ms, fs, mp, fp } : undefined;
}

function mapLexiconEntryToLookupPayload(entry: LexiconEntry, word: string, relatedPhrases: RelatedPhrase[]) {
  const meanings = getMeanings(entry);
  const morphology = mapMorphology(entry);
  const isVerb = entry.partOfSpeech === "verb" || entry.partOfSpeech?.startsWith("v");

  return {
    word,
    lemma: entry.lemma,
    partOfSpeech: entry.partOfSpeech,
    meanings,
    examples: getExamples(entry.examples),
    phonetic: entry.ipa,
    morphInfo: entry.explanationZh,
    usageNote: entry.kind === "construction" ? entry.explanationZh : null,
    conjugations: isVerb && morphology ? morphology : undefined,
    nounForms: entry.partOfSpeech?.startsWith("noun") ? nounForms(entry) : undefined,
    adjectiveForms: entry.partOfSpeech?.startsWith("adj") ? adjectiveForms(entry) : undefined,
    relatedPhrases
  };
}

function scheduleLexiconBackfill(entry: DictionaryEntry) {
  setTimeout(() => {
    void (async () => {
      const lemmaInDict = await isLemmaInDict(entry.lemma);
      const { score, status } = scoreLexiconEntry(deriveScoreSignals(entry, lemmaInDict));

      await upsertLexiconEntry({
        kind: "word",
        lemma: entry.lemma,
        displayForm: entry.lemma,
        forms: [entry.word, entry.lemma],
        partOfSpeech: entry.partOfSpeech,
        translationZh: entry.meanings[0] ?? null,
        explanationZh: entry.meanings.join("；") || null,
        examples: entry.examples,
        morphology: entry.conjugations ?? entry.nounForms ?? entry.adjectiveForms ?? null,
        sources: ["external-lookup"],
        licenseCode: "external-lookup",
        qualityScore: score,
        status
      });
    })().catch((error) => {
      console.warn("Lexicon backfill failed:", error instanceof Error ? error.message : error);
    });
  }, 0);
}

async function withSavedState<T extends { lemma: string }>(payload: T, userId: string | null) {
  const savedWord =
    userId && payload.lemma ? await getWordWithEncounters(userId, payload.lemma) : null;

  return {
    ...payload,
    isSaved: Boolean(savedWord),
    wordId: savedWord?.id ?? null,
    totalEncounters: savedWord ? savedWord.encounters.length : null
  };
}

export async function GET(request: Request) {
  const startedAt = performance.now();
  const session = await getServerSession(getAuthOptions()).catch(() => null);
  const rateLimit = await checkRateLimit(
    lookupLimiter,
    request,
    session?.user && "id" in session.user && typeof session.user.id === "string"
      ? session.user.id
      : null
  );

  if (!rateLimit.allowed) {
    const retryAfterSec = getRetryAfterSec(rateLimit.reset);

    return NextResponse.json(
      { error: "rate limited", retryAfterSec },
      {
        status: 429,
        headers: { "Retry-After": String(retryAfterSec) }
      }
    );
  }

  const { searchParams } = new URL(request.url);
  const word = searchParams.get("word")?.trim() ?? "";

  if (!word) {
    return NextResponse.json({ error: "word is required" }, { status: 400 });
  }

  try {
    const userId =
      session?.user && "id" in session.user && typeof session.user.id === "string"
        ? session.user.id
        : null;
    const relatedEntries = await findRelatedPhraseEntries(word);
    const constructionEntry = await findConstructionEntry(word);
    const relatedPhrases = relatedEntries.map((entry) => ({
      lemma: entry.lemma,
      translationZh: entry.translationZh,
      kind: entry.kind
    }));
    const lexiconEntry = await findLexiconLookupEntry(word);
    if (lexiconEntry) {
      await incrementLookupCount(lexiconEntry.id);
      const payload = {
        ...mapLexiconEntryToLookupPayload(lexiconEntry, word, relatedPhrases),
        usageNote:
          constructionEntry?.explanationZh ??
          (lexiconEntry.kind === "construction" ? lexiconEntry.explanationZh : null)
      };
      return NextResponse.json(
        await withSavedState(payload, userId),
        { headers: lexiconHeaders(true, "lexicon", startedAt) }
      );
    }

    const entry = await lookupDictionary(word);

    if (!entry) {
      reportLookupFailure(word, new Error("dictionary returned null"));
      return NextResponse.json({ error: "lookup failed" }, { status: 500 });
    }

    scheduleLexiconBackfill(entry);

    return NextResponse.json(
      await withSavedState({ ...entry, relatedPhrases }, userId),
      { headers: lexiconHeaders(false, "external", startedAt) }
    );
  } catch (error) {
    reportLookupFailure(word, error);
    return NextResponse.json({ error: "lookup failed" }, { status: 500 });
  }
}
