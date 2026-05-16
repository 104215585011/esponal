import { getServerSession } from "next-auth";
import { redirect } from "next/navigation";
import VocabAccordion, {
  type VocabWord
} from "@/app/components/vocab/VocabAccordion";
import { getAuthOptions } from "@/lib/auth";
import { getWordsByUser } from "@/lib/vocab";

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

export default async function VocabPage() {
  const session = await getServerSession(getAuthOptions());

  if (
    !session?.user ||
    !("id" in session.user) ||
    typeof session.user.id !== "string"
  ) {
    redirect("/api/auth/signin");
  }

  const words = await getWordsByUser(session.user.id);
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
    <main className="min-h-screen bg-app px-4 py-10 text-gray-900 sm:px-6">
      <section className="mx-auto max-w-2xl">
        <header className="mb-8">
          <h1 className="text-2xl font-bold text-gray-900">我的词库</h1>
          <p className="mt-2 text-sm text-gray-400">
            按词根归类，记录你遭遇过的词
          </p>
        </header>
        <VocabAccordion words={serializedWords} />
      </section>
    </main>
  );
}
