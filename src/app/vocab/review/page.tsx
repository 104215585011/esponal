import { redirect } from "next/navigation";
import { getServerSession } from "next-auth";
import { SiteHeader } from "@/app/components/web/SiteHeader";
import { getAuthOptions } from "@/lib/auth";
import { getDueReviewWords, getDueReviewCount } from "@/lib/vocab";
import { ReviewClient } from "./ReviewClient";

export const dynamic = "force-dynamic";

export default async function VocabReviewPage() {
  const session = await getServerSession(getAuthOptions());

  if (
    !session?.user ||
    !("id" in session.user) ||
    typeof session.user.id !== "string"
  ) {
    redirect("/api/auth/signin");
  }

  const userId = session.user.id;
  const now = new Date();

  const [dueWords, totalDue] = await Promise.all([
    getDueReviewWords(userId, now),
    getDueReviewCount(userId, now)
  ]);

  const words = dueWords.slice(0, 20).map((word) => ({
    id: word.id,
    lemma: word.lemma,
    translation: word.translation,
    partOfSpeech: word.partOfSpeech,
    dictData: word.dictData,
    srsDue: word.srsDue?.toISOString() ?? null,
    srsState: word.srsState
  }));

  return (
    <main className="min-h-screen bg-app text-gray-900">
      <SiteHeader />
      <section className="mx-auto max-w-2xl px-4 py-10 sm:px-6">
        <header className="mb-8 text-center">
          <h1 className="text-2xl font-bold text-gray-900">今日复习</h1>
          <p className="mt-1 text-sm text-gray-400">
            FSRS 间隔重复——把遭遇变成记忆
          </p>
        </header>
        {words.length === 0 ? (
          <div className="py-20 text-center">
            <p className="text-4xl">✅</p>
            <p className="mt-4 text-lg font-medium text-gray-700">今日无到期词</p>
            <p className="mt-1 text-sm text-gray-400">继续看视频或阅读，添加更多生词吧</p>
            <a
              href="/vocab"
              className="mt-6 inline-block rounded-lg bg-brand-50 px-5 py-2 text-sm font-medium text-brand-600 hover:bg-brand-100"
            >
              返回词库
            </a>
          </div>
        ) : (
          <ReviewClient initialWords={words} totalDue={totalDue} />
        )}
      </section>
    </main>
  );
}
