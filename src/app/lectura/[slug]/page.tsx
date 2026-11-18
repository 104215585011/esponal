// Timestamp: 2026-11-18 11:25
import { getServerSession } from "next-auth";
import { notFound } from "next/navigation";
import { BackLink } from "@/app/components/web/BackLink";
import { SiteHeader } from "@/app/components/web/SiteHeader";
import { getAuthOptions } from "@/lib/auth";
import {
  getCatalogStoryBySlug,
  getNextRecommendationAfterRead
} from "@/lib/lectura/catalog";
import { prisma } from "@/lib/prisma";
import { LecturaReadStatus } from "../LecturaReadStatus";
import { LecturaReader } from "../LecturaReader";
import { getLecturaStory, lecturaStories, type LecturaLevel } from "@/../content/lectura";

export const dynamic = "force-dynamic";

const levelStyle: Record<LecturaLevel | "UNCONFIRMED", string> = {
  A1: "bg-brand-50 dark:bg-brand-950/30 text-brand-700 dark:text-brand-400 border border-brand-200/30 dark:border-brand-800/20",
  A2: "bg-zinc-100 dark:bg-zinc-800 text-zinc-700 dark:text-zinc-300 border border-zinc-200/50 dark:border-zinc-700/50",
  B1: "bg-amber-50 dark:bg-amber-950/20 text-amber-700 dark:text-amber-400 border border-amber-200/30 dark:border-amber-800/20",
  UNCONFIRMED: "bg-zinc-100 dark:bg-zinc-800 text-zinc-500 dark:text-zinc-400 border border-zinc-200/50 dark:border-zinc-700/50"
};

export function generateStaticParams() {
  return lecturaStories.map((story) => ({ slug: story.slug }));
}

type LecturaReadPageProps = {
  params: { slug: string };
  searchParams?: { p?: string };
};

export default async function LecturaReadPage({ params, searchParams }: LecturaReadPageProps) {
  const staticStory = getLecturaStory(params.slug);
  const catalogStory = await getCatalogStoryBySlug(params.slug);
  const resolved = catalogStory ?? (staticStory ? {
    slug: staticStory.slug,
    language: (staticStory.language ?? "es") as "es" | "de" | "en" | "fr" | "ja",
    contentKind: "story" as const,
    sourceId: "esponal-curated",
    sourceLabel: staticStory.source,
    title: staticStory.title,
    titleZh: staticStory.titleZh,
    summaryZh: staticStory.summaryZh,
    topic: "生活文化",
    level: staticStory.level,
    durationMin: staticStory.durationMin,
    paragraphs: staticStory.paragraphs,
    paragraphCount: staticStory.paragraphs.length,
    isFullText: true,
    bodyStatus: "ready" as const,
    glossary: staticStory.glossary ?? [],
    audioUrl: null,
    audioType: "tts" as const
  } : null);

  if (!resolved) {
    notFound();
  }

  const story = {
    slug: resolved.slug,
    language: resolved.language,
    title: resolved.title,
    titleZh: resolved.titleZh,
    level: (resolved.level ?? "A2") as LecturaLevel,
    source: resolved.sourceLabel,
    durationMin: resolved.durationMin,
    summaryZh: resolved.summaryZh,
    paragraphs: resolved.paragraphs,
    glossary: resolved.glossary
  };

  const session = await getServerSession(getAuthOptions());
  const userId =
    session?.user && "id" in session.user && typeof session.user.id === "string"
      ? session.user.id
      : null;
  const read = userId
    ? await prisma.lecturaRead.findUnique({
        where: {
          userId_slug: {
            userId,
            slug: story.slug
          }
        },
        select: { id: true, completed: true, lastParagraphIndex: true }
      }).catch(() => null)
    : null;
  const isRead = Boolean(read?.completed);

  const queryPara = Number.parseInt(searchParams?.p ?? "", 10);
  const initialParagraphIndex =
    Number.isFinite(queryPara) && queryPara >= 0
      ? queryPara
      : read?.lastParagraphIndex ?? 0;

  const nextRecommendation = await getNextRecommendationAfterRead({
    current: resolved,
    userId
  });

  const badgeKey = resolved.level ?? "UNCONFIRMED";

  return (
    <main className="min-h-screen bg-app">
      <SiteHeader />
      <article className="mx-auto max-w-3xl px-5 pb-32 pt-6 md:px-6 md:pt-10">
        <div className="flex items-center justify-between gap-4">
          <BackLink href="/lectura" label="阅读" />
          <div className="hidden md:block">
            {userId ? <LecturaReadStatus isRead={isRead} slug={story.slug} /> : null}
          </div>
        </div>

        <h1 className="mt-5 text-[28px] font-bold leading-[1.12] tracking-tight text-zinc-900 dark:text-zinc-50 md:mt-8 md:text-3xl lg:text-4xl">
          {resolved.titleZh}
        </h1>
        <p className="mt-2 text-sm font-medium text-zinc-500 dark:text-zinc-400">{resolved.title}</p>
        <p className="mt-1.5 text-sm text-zinc-600 dark:text-zinc-300">{resolved.summaryZh}</p>

        <div className="mt-3 flex flex-wrap items-center gap-2 text-xs text-gray-500 dark:text-zinc-400">
          <span
            className={`inline-flex items-center rounded-full px-2.5 py-0.5 text-[10px] font-semibold ${levelStyle[badgeKey]}`}
          >
            {resolved.level ?? "难度待确认"}
          </span>
          <span>·</span>
          <span>{resolved.topic}</span>
          <span>·</span>
          <span>约 {resolved.durationMin} 分钟</span>
          <span>·</span>
          <span>{resolved.isFullText ? "全文" : "节选"}</span>
          <span>·</span>
          <span>{resolved.audioType === "native" ? "🎧 原声" : "🔊 合成朗读"}</span>
          <span>·</span>
          <span className="text-[12px] text-gray-400 dark:text-zinc-500">{resolved.sourceLabel}</span>
        </div>

        {resolved.audioUrl ? (
          <div className="mt-5 rounded-2xl border border-brand-200/50 bg-brand-50/40 p-4 dark:border-brand-800/30 dark:bg-brand-950/20">
            <p className="mb-2 text-xs font-semibold text-brand-700 dark:text-brand-300">
              🎧 博客原声音频（边听原声边跟读全文）
            </p>
            <audio controls className="w-full" preload="metadata" src={resolved.audioUrl} />
          </div>
        ) : null}

        <div className="mt-8 md:mt-10">
          <LecturaReader story={story} isRead={isRead} initialParagraphIndex={initialParagraphIndex} nextRecommendation={nextRecommendation} />
        </div>

        <footer className="mt-12 border-t border-gray-100 pt-6 text-center text-xs text-gray-400 dark:border-zinc-800/60 dark:text-zinc-500">
          <p>约 {resolved.durationMin} 分钟 · 点任意单词查义</p>
          {!userId ? <p className="mt-2">登录后可保存续读位置与读完记录</p> : null}
        </footer>
      </article>
    </main>
  );
}
