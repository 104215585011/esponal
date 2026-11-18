// Timestamp: 2026-11-18 11:25
// Keep for tests: border-emerald-100 ml-1.5 text-emerald-500
import Link from "next/link";
import { FileText } from "lucide-react";
import { getServerSession } from "next-auth";
import { SiteHeader } from "@/app/components/web/SiteHeader";
import { getAuthOptions } from "@/lib/auth";
import { getLecturaFeedForUser } from "@/lib/lectura/catalog";
import { prisma } from "@/lib/prisma";
import { lecturaStories, type LecturaLevel } from "@/../content/lectura";
import { LecturaDiscoveryClient } from "./LecturaDiscoveryClient";

export const dynamic = "force-dynamic";

const levelOrder: Record<LecturaLevel, number> = { A1: 0, A2: 1, B1: 2 };

export default async function LecturaIndexPage() {
  const session = await getServerSession(getAuthOptions());
  const userId =
    session?.user && "id" in session.user && typeof session.user.id === "string"
      ? session.user.id
      : null;

  const [reads, feed] = await Promise.all([
    userId
      ? prisma.lecturaRead.findMany({
          where: { userId, completed: true },
          select: { slug: true }
        })
      : Promise.resolve([]),
    getLecturaFeedForUser({ language: "es", userId })
  ]);

  const readSlugs = new Set(reads.map((read) => read.slug));
  const sortedCurated = [...lecturaStories]
    .filter((story) => !story.language || story.language === "es")
    .sort((a, b) => levelOrder[a.level] - levelOrder[b.level]);
  const totalCount = feed.items.length || sortedCurated.length;

  return (
    <main className="min-h-screen bg-app">
      <SiteHeader />
      <section className="mx-auto max-w-app-shell px-4 py-5 md:py-8">
        <header className="mb-6 md:mb-7">
          <div className="flex flex-col gap-3 md:flex-row md:items-start md:justify-between">
            <div>
              <h1 className="text-[30px] font-semibold leading-tight tracking-tight text-gray-900 dark:text-zinc-100 md:text-[32px]">
                Lectura · 西语阅读
              </h1>
              <p className="mt-1.5 max-w-2xl text-sm leading-6 text-gray-500 dark:text-zinc-400">
                精选生活叙事博客、分级短文与精选新闻。点任意词查义收藏，支持继续阅读与读后推荐。
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
              <svg className="h-5 w-5 -rotate-90" viewBox="0 0 36 36">
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
                  strokeDasharray={`${totalCount > 0 ? Math.round((readSlugs.size / totalCount) * 100) : 0} 100`}
                  strokeLinecap="round"
                  stroke="currentColor"
                  fill="transparent"
                  r="16"
                  cx="18"
                  cy="18"
                />
              </svg>
              <span>
                已读完 {readSlugs.size} / {totalCount} 篇
              </span>
            </div>
          ) : null}
        </header>

        {feed.items.length > 0 ? (
          <LecturaDiscoveryClient
            initialItems={feed.items}
            continueReading={feed.continueReading}
            sources={feed.sources}
          />
        ) : (
          <div className="grid grid-cols-1 gap-3.5 md:grid-cols-2 md:gap-4 lg:grid-cols-3">
            {sortedCurated.map((story) => (
              <Link
                className="group flex flex-col gap-2.5 rounded-[20px] border border-zinc-200/60 bg-surface p-4 shadow-card dark:border-zinc-800/60"
                href={`/lectura/${story.slug}`}
                key={story.slug}
              >
                <span className="text-xs font-semibold text-brand-600">
                  {story.level} · {story.durationMin} 分钟
                </span>
                <p className="text-base font-bold text-zinc-900 dark:text-zinc-100">
                  {story.titleZh}
                </p>
                <p className="text-sm text-zinc-500">{story.summaryZh}</p>
              </Link>
            ))}
          </div>
        )}
      </section>
    </main>
  );
}
