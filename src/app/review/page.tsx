// Timestamp: 2026-11-15 02:35
import Link from "next/link";
import { getServerSession } from "next-auth";
import { getAuthOptions } from "@/lib/auth";
import { getDueReviewCount, getVocabStats } from "@/lib/vocab";

export const dynamic = "force-dynamic";

type SessionUserWithId = {
  id?: string;
};

export default async function MobileReviewPage() {
  const session = await getServerSession(getAuthOptions());
  const userId = (session?.user as SessionUserWithId | undefined)?.id;

  const [dueCount, stats] = userId
    ? await Promise.all([
        getDueReviewCount(userId).catch(() => 0),
        getVocabStats(userId).catch(() => null),
      ])
    : [0, null];

  return (
    <main className="px-4 pb-6 pt-5">
      <h1 className="text-[22px] font-extrabold tracking-tight text-zinc-950 dark:text-zinc-50">复习</h1>
      <p className="mt-1.5 text-[12.5px] leading-6 text-zinc-500 dark:text-zinc-400">
        {userId
          ? "从你收藏的视频、短文和课程里巩固生词，按自己的节奏来。"
          : "登录后可同步个人生词本并开始复习。"}
      </p>

      {userId ? (
        <div className="mt-4 rounded-2xl border border-zinc-200/70 bg-white p-5 shadow-card dark:border-zinc-800/70 dark:bg-zinc-900">
          <div className="text-xs text-zinc-500 dark:text-zinc-400">当前待复习</div>
          <div className="mt-2 flex items-baseline gap-2">
            <span className="font-display text-4xl font-extrabold text-zinc-950 dark:text-zinc-50">
              {dueCount}
            </span>
            <span className="text-sm text-zinc-500 dark:text-zinc-400">
              词{stats ? ` · 已累计收藏 ${stats.totalSaved} 词` : ""}
            </span>
          </div>
          <Link
            href="/vocab/review"
            className="mt-4 flex w-full items-center justify-center rounded-full bg-brand-500 py-3 text-sm font-semibold text-white transition active:scale-[0.99] hover:bg-brand-600"
          >
            {dueCount > 0 ? "开始复习 →" : "去看看生词本 →"}
          </Link>
        </div>
      ) : (
        <Link
          href="/auth/sign-in?callbackUrl=/review"
          className="mt-4 flex w-full items-center justify-center rounded-full bg-brand-500 py-3 text-sm font-semibold text-white transition active:scale-[0.99] hover:bg-brand-600"
        >
          登录后开始复习 →
        </Link>
      )}

      <div className="mt-4 grid gap-2">
        <Link
          className="flex items-center justify-between rounded-2xl border border-zinc-200/70 bg-white px-4 py-3.5 dark:border-zinc-800/70 dark:bg-zinc-900"
          href="/vocab/review"
        >
          <span className="text-[15px] font-semibold text-zinc-900 dark:text-zinc-50">复习队列</span>
          <span className="text-[12px] font-semibold text-brand-600 dark:text-brand-400">进入 →</span>
        </Link>
        <Link
          className="flex items-center justify-between rounded-2xl border border-zinc-200/70 bg-white px-4 py-3.5 dark:border-zinc-800/70 dark:bg-zinc-900"
          href="/vocab"
        >
          <span className="text-[15px] font-semibold text-zinc-900 dark:text-zinc-50">我的语料库</span>
          <span className="text-[12px] text-zinc-400">→</span>
        </Link>
      </div>
    </main>
  );
}
