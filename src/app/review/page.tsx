// Timestamp: 2026-11-13 14:02
import Link from "next/link";

export default function MobileReviewPage() {
  return (
    <main className="px-4 pb-2 pt-5">
      <h1 className="text-[22px] font-extrabold tracking-tight text-zinc-950 dark:text-zinc-50">复习</h1>
      <p className="mt-1.5 text-[12.5px] leading-6 text-zinc-500">
        生词本、到期复习、学习数据。正式版在 P2 迁入。
      </p>

      <div className="mt-4 grid gap-2">
        <Link
          className="flex items-center justify-between rounded-2xl border border-zinc-200/70 bg-white px-4 py-3.5 dark:border-zinc-800/70 dark:bg-zinc-900"
          href="/vocab/review"
        >
          <span className="text-[15px] font-semibold text-zinc-900 dark:text-zinc-50">开始复习</span>
          <span className="text-[12px] font-semibold text-brand-600">进入 →</span>
        </Link>
        <Link
          className="flex items-center justify-between rounded-2xl border border-zinc-200/70 bg-white px-4 py-3.5 dark:border-zinc-800/70 dark:bg-zinc-900"
          href="/vocab"
        >
          <span className="text-[15px] font-semibold text-zinc-900 dark:text-zinc-50">生词本</span>
          <span className="text-[12px] text-zinc-400">→</span>
        </Link>
      </div>
    </main>
  );
}
