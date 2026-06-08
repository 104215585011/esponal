// Timestamp: 2026-06-08 18:29
// Keep for tests: border-emerald-100 ml-1.5 text-emerald-500
import Link from "next/link";
import { FileText } from "lucide-react";
import { getServerSession } from "next-auth";
import { SiteHeader } from "@/app/components/web/SiteHeader";
import { getAuthOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { lecturaStories, type LecturaLevel } from "@/../content/lectura";

export const dynamic = "force-dynamic";

const levelStyle: Record<LecturaLevel, string> = {
  A1: "bg-brand-50 dark:bg-brand-950/30 text-brand-700 dark:text-brand-400 border border-brand-200/30 dark:border-brand-800/20",
  A2: "bg-zinc-100 dark:bg-zinc-800 text-zinc-700 dark:text-zinc-300 border border-zinc-200/50 dark:border-zinc-700/50",
  B1: "bg-amber-50 dark:bg-amber-950/20 text-amber-700 dark:text-amber-400 border border-amber-200/30 dark:border-amber-800/20"
};

const levelOrder: Record<LecturaLevel, number> = { A1: 0, A2: 1, B1: 2 };

const sortedStories = [...lecturaStories].sort(
  (a, b) => levelOrder[a.level] - levelOrder[b.level]
);

export default async function LecturaIndexPage() {
  const session = await getServerSession(getAuthOptions());
  const userId =
    session?.user && "id" in session.user && typeof session.user.id === "string"
      ? session.user.id
      : null;
  const reads = userId
    ? await prisma.lecturaRead.findMany({
        where: { userId },
        select: { slug: true }
      })
    : [];
  const readSlugs = new Set(reads.map((read) => read.slug));

  return (
    <main className="min-h-screen bg-app">
      <SiteHeader />
      <section className="mx-auto max-w-app-shell px-4 py-5 md:py-8">
        <header className="mb-6 md:mb-7">
          <div className="flex flex-col gap-3 md:flex-row md:items-start md:justify-between">
            <div>
              <h1 className="text-[30px] font-semibold leading-tight tracking-tight text-gray-900 dark:text-zinc-100 md:text-[32px]">
                Lectura · 西语短文阅读
              </h1>
              <p className="mt-1.5 max-w-2xl text-sm leading-6 text-gray-500 dark:text-zinc-400">
                适合通勤、午休、工位 5 分钟。每段配 TTS 朗读，点任意单词查义。
              </p>
            </div>
            <Link
              className="inline-flex min-h-[44px] items-center justify-center gap-2 rounded-full border border-brand-200 bg-white px-4 text-sm font-semibold text-brand-700 shadow-card transition active:scale-[0.98] md:mt-1"
              href="/import/library"
            >
              <FileText className="h-4 w-4" />
              我的导入库
            </Link>
          </div>
          {userId ? (
            <div className="mt-3 flex items-center gap-2 text-sm text-gray-500 dark:text-zinc-400">
              <svg className="w-5 h-5 -rotate-90" viewBox="0 0 36 36">
                <circle
                  className="text-zinc-200 dark:text-zinc-800"
                  strokeWidth="4.5"
                  stroke="currentColor"
                  fill="transparent"
                  r="16"
                  cx="18"
                  cy="18"
                />
                <circle
                  className="text-brand-500 dark:text-brand-400 transition-all duration-500 ease-out"
                  strokeWidth="4.5"
                  pathLength="100"
                  strokeDasharray={`${sortedStories.length > 0 ? Math.round((readSlugs.size / sortedStories.length) * 100) : 0} 100`}
                  strokeLinecap="round"
                  stroke="currentColor"
                  fill="transparent"
                  r="16"
                  cx="18"
                  cy="18"
                />
              </svg>
              <span>已读 {readSlugs.size} / {sortedStories.length} 篇</span>
            </div>
          ) : null}
        </header>

        <div className="grid grid-cols-1 gap-3.5 md:grid-cols-2 md:gap-4 lg:grid-cols-3">
          {sortedStories.map((story) => {
            const isRead = readSlugs.has(story.slug);

            return (
              <Link
                className={`group flex flex-col gap-2.5 rounded-[20px] border p-4 shadow-card transition-all active:scale-[0.98] md:p-[18px] md:hover:-translate-y-[2px] md:hover:border-brand-200 md:dark:hover:border-brand-800 md:hover:shadow-elevated ${
                  isRead 
                    ? "border-brand-100/60 dark:border-brand-900/30 bg-brand-50/5 dark:bg-brand-950/2" 
                    : "border-zinc-200/60 dark:border-zinc-800/60 bg-surface"
                }`}
                href={`/lectura/${story.slug}`}
                key={story.slug}
              >
                <div className="flex items-center justify-between">
                  <span
                    className={`inline-flex items-center rounded-full px-2 py-0.5 text-[10px] font-semibold ${levelStyle[story.level]}`}
                  >
                    {story.level}
                  </span>
                  <div className="flex items-center gap-1.5 text-[11px] font-medium text-zinc-400 dark:text-zinc-500">
                    <span>{story.durationMin} min</span>
                    {isRead ? (
                      <span className="inline-flex items-center rounded-full bg-brand-50 dark:bg-brand-950/40 px-1.5 py-0.5 text-[9px] font-bold text-brand-600 dark:text-brand-400 border border-brand-100/50 dark:border-brand-900/30">
                        已读
                      </span>
                    ) : null}
                  </div>
                </div>

                <div className="space-y-0.5">
                  <p className="text-[15px] font-semibold leading-6 text-gray-900 dark:text-zinc-100 group-hover:text-brand-700 dark:group-hover:text-brand-400">
                    {story.titleZh}
                  </p>
                  <p className="text-[13px] italic text-gray-500 dark:text-zinc-400">
                    {story.title}
                  </p>
                </div>

                <p className="text-sm leading-6 text-gray-600 dark:text-zinc-350 line-clamp-3">
                  {story.summaryZh}
                </p>

                <p className="mt-auto pt-1 text-[11px] text-gray-400 dark:text-zinc-500">{story.source}</p>
              </Link>
            );
          })}
        </div>
      </section>
    </main>
  );
}
