import { getServerSession } from "next-auth";
import { redirect } from "next/navigation";
import { SiteHeader } from "@/app/components/web/SiteHeader";
import VocabAccordion, {
  type VocabWord
} from "@/app/components/vocab/VocabAccordion";
import VocabDashboard from "@/app/vocab/VocabDashboard";
import { getAuthOptions } from "@/lib/auth";
import { getDueReviewCount, getVocabStats, getWordsByUser } from "@/lib/vocab";
import type { VerbConjugations } from "@/lib/conjugate";

// VOCAB-002 change timestamp: 2026-05-13 13:54
const getVideoTitle = (sourceUrl: string) => {
  try {
    const url = new URL(sourceUrl);
    return url.searchParams.get("title") ?? "YouTube 视频";
  } catch {
    return "YouTube 视频";
  }
};

const getMeanings = (dictData: unknown) => {
  if (!dictData || typeof dictData !== "object") return [];
  const meanings = (dictData as { meanings?: unknown }).meanings;
  return Array.isArray(meanings)
    ? meanings.filter((item): item is string => typeof item === "string")
    : [];
};

const getExamples = (dictData: unknown) => {
  if (!dictData || typeof dictData !== "object") return [];
  const examples = (dictData as { examples?: unknown }).examples;
  if (!Array.isArray(examples)) return [];

  return examples.filter(
    (item): item is { es: string; zh: string } =>
      typeof item === "object" &&
      item !== null &&
      typeof (item as { es?: unknown }).es === "string" &&
      typeof (item as { zh?: unknown }).zh === "string"
  );
};

const getConjugations = (dictData: unknown) => {
  if (!dictData || typeof dictData !== "object") return undefined;
  const conjugations = (dictData as { conjugations?: unknown }).conjugations;
  return conjugations && typeof conjugations === "object"
    ? (conjugations as VerbConjugations)
    : undefined;
};

const getNounForms = (dictData: unknown) => {
  if (!dictData || typeof dictData !== "object") return undefined;
  const nounForms = (dictData as { nounForms?: unknown }).nounForms;
  if (!nounForms || typeof nounForms !== "object") return undefined;

  const singular = (nounForms as { singular?: unknown }).singular;
  const plural = (nounForms as { plural?: unknown }).plural;
  const gender = (nounForms as { gender?: unknown }).gender;
  if (
    typeof singular !== "string" ||
    typeof plural !== "string" ||
    (gender !== "m" && gender !== "f" && gender !== "mf")
  ) {
    return undefined;
  }

  return {
    singular,
    plural,
    gender
  } as { singular: string; plural: string; gender: "m" | "f" | "mf" };
};

const getAdjectiveForms = (dictData: unknown) => {
  if (!dictData || typeof dictData !== "object") return undefined;
  const adjectiveForms = (dictData as { adjectiveForms?: unknown }).adjectiveForms;
  if (!adjectiveForms || typeof adjectiveForms !== "object") return undefined;

  const ms = (adjectiveForms as { ms?: unknown }).ms;
  const fs = (adjectiveForms as { fs?: unknown }).fs;
  const mp = (adjectiveForms as { mp?: unknown }).mp;
  const fp = (adjectiveForms as { fp?: unknown }).fp;
  if (
    typeof ms !== "string" ||
    typeof fs !== "string" ||
    typeof mp !== "string" ||
    typeof fp !== "string"
  ) {
    return undefined;
  }

  return { ms, fs, mp, fp } as {
    ms: string;
    fs: string;
    mp: string;
    fp: string;
  };
};

export default async function VocabPage() {
  const session = await getServerSession(getAuthOptions());

  if (
    !session?.user ||
    !("id" in session.user) ||
    typeof session.user.id !== "string"
  ) {
    redirect("/api/auth/signin");
  }

  const [words, dueCount, stats] = await Promise.all([
    getWordsByUser(session.user.id),
    getDueReviewCount(session.user.id),
    getVocabStats(session.user.id)
  ]);

  const serializedWords: VocabWord[] = words
    .map((word) => {
      const encounters = word.encounters.map((encounter) => ({
        id: encounter.id,
        sourceUrl: encounter.sourceUrl,
        timestampSec: encounter.timestampSec,
        sourceType: encounter.sourceType,
        courseRef: encounter.courseRef,
        originalSentence: encounter.originalSentence,
        translatedSentence: encounter.translatedSentence,
        createdAt: encounter.createdAt.toISOString(),
        videoTitle: getVideoTitle(encounter.sourceUrl)
      }));
      const recentEncounterAt = encounters[0]?.createdAt ?? null;

      return {
        id: word.id,
        lemma: word.lemma,
        translation: word.translation,
        partOfSpeech: word.partOfSpeech,
        meanings: getMeanings(word.dictData),
        examples: getExamples(word.dictData),
        conjugations: getConjugations(word.dictData),
        nounForms: getNounForms(word.dictData),
        adjectiveForms: getAdjectiveForms(word.dictData),
        encounterCount: encounters.length,
        recentEncounterAt,
        encounters
      };
    })
    .sort((a, b) => {
      const left = a.encounters[0]?.createdAt ?? "";
      const right = b.encounters[0]?.createdAt ?? "";

      return right.localeCompare(left);
    });

  return (
    <main className="min-h-screen bg-app text-gray-900">
      <SiteHeader />
      <section className="mx-auto max-w-2xl px-4 py-10 sm:px-6">
        <header className="mb-8">
          <div className="flex items-start justify-between gap-4">
            <div>
              <h1 className="text-2xl font-bold text-gray-900">我的词库</h1>
              <p className="mt-2 text-sm text-gray-400">
                按词根归类，记录你遭遇过的词
              </p>
            </div>
            {dueCount > 0 ? (
              <a
                href="/vocab/review"
                className="flex shrink-0 items-center gap-1.5 rounded-lg bg-brand-50 px-3 py-1.5 text-sm font-medium text-brand-600 hover:bg-brand-100"
              >
                <span>{dueCount} 词待复习</span>
                <span aria-hidden>{"->"}</span>
              </a>
            ) : null}
          </div>
        </header>
        <div className="border-b border-gray-100 mb-6 pb-6">
          <VocabDashboard stats={stats} />
        </div>
        <VocabAccordion words={serializedWords} />
      </section>
    </main>
  );
}
