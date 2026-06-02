// Timestamp: 2026-06-02 15:05
import { getServerSession } from "next-auth";
import { notFound } from "next/navigation";
import { BackLink } from "@/app/components/web/BackLink";
import { SiteHeader } from "@/app/components/web/SiteHeader";
import { getAuthOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { LecturaReadStatus } from "../LecturaReadStatus";
import { LecturaReader } from "../LecturaReader";
import { getLecturaStory, lecturaStories, type LecturaLevel } from "@/../content/lectura";

export const dynamic = "force-dynamic";

const levelStyle: Record<LecturaLevel, string> = {
  A1: "bg-brand-50 dark:bg-brand-950/30 text-brand-700 dark:text-brand-400 border border-brand-200/30 dark:border-brand-800/20",
  A2: "bg-zinc-100 dark:bg-zinc-800 text-zinc-700 dark:text-zinc-300 border border-zinc-200/50 dark:border-zinc-700/50",
  B1: "bg-amber-50 dark:bg-amber-950/20 text-amber-700 dark:text-amber-400 border border-amber-200/30 dark:border-amber-800/20"
};

export function generateStaticParams() {
  return lecturaStories.map((story) => ({ slug: story.slug }));
}

type LecturaReadPageProps = {
  params: { slug: string };
};

export default async function LecturaReadPage({ params }: LecturaReadPageProps) {
  const story = getLecturaStory(params.slug);

  if (!story) {
    notFound();
  }

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
        select: { id: true }
      })
    : null;
  const isRead = Boolean(read);

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

        <h1 className="mt-6 text-2xl font-bold tracking-tight text-zinc-900 dark:text-zinc-50 md:mt-8 md:text-3xl lg:text-4xl">
          {story.title}
        </h1>
        <p className="mt-1.5 text-sm text-zinc-500 dark:text-zinc-400 font-normal">{story.titleZh}</p>

        <div className="mt-4 flex flex-wrap items-center gap-3 text-sm text-gray-500 dark:text-zinc-400">
          <span
            className={`inline-flex items-center rounded-full px-2 py-0.5 text-[10px] font-semibold ${levelStyle[story.level]}`}
          >
            {story.level}
          </span>
          <span>·</span>
          <span>{story.durationMin} min</span>
          <span>·</span>
          <span className="text-[12px] text-gray-400 dark:text-zinc-500">{story.source}</span>
        </div>

        <div className="mt-10">
          <LecturaReader story={story} isRead={isRead} />
        </div>

        <footer className="mt-16 border-t border-gray-100 dark:border-zinc-800/60 pt-6 text-center text-xs text-gray-400 dark:text-zinc-500">
          <p>约 {story.durationMin} 分钟 · 点任意单词查义</p>
          {!userId ? <p className="mt-2">登录后可保存阅读记录</p> : null}
        </footer>
      </article>
    </main>
  );
}
