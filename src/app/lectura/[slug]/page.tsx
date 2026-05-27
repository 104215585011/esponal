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
  A1: "bg-brand-100 text-brand-700",
  A2: "bg-sky-100 text-sky-700",
  B1: "bg-purple-100 text-purple-700"
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
      <article className="mx-auto max-w-3xl px-6 pb-24 pt-10">
        <div className="flex items-center justify-between gap-4">
          <BackLink href="/lectura" label="阅读" />
          {userId ? <LecturaReadStatus isRead={isRead} slug={story.slug} /> : null}
        </div>

        <h1 className="text-3xl font-semibold tracking-tight text-gray-900 sm:text-4xl">
          {story.title}
        </h1>
        <p className="mt-1 text-base text-gray-500">{story.titleZh}</p>

        <div className="mt-3 flex flex-wrap items-center gap-3 text-sm text-gray-500">
          <span
            className={`inline-flex items-center rounded-full px-2.5 py-0.5 text-[11px] font-semibold ${levelStyle[story.level]}`}
          >
            {story.level}
          </span>
          <span>·</span>
          <span>{story.durationMin} min</span>
          <span>·</span>
          <span className="text-[12px] text-gray-400">{story.source}</span>
        </div>

        <div className="mt-10">
          <LecturaReader story={story} isRead={isRead} />
        </div>

        <footer className="mt-16 border-t border-gray-100 pt-6 text-center text-xs text-gray-400">
          <p>约 {story.durationMin} 分钟 · 点任意单词查义</p>
          {!userId ? <p className="mt-2">登录后可保存阅读记录</p> : null}
        </footer>
      </article>
    </main>
  );
}
