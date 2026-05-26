import Link from "next/link";
import { getServerSession } from "next-auth";
import { SiteHeader } from "@/app/components/web/SiteHeader";
import { getAuthOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { lecturaStories, type LecturaLevel } from "@/../content/lectura";

export const dynamic = "force-dynamic";

const levelStyle: Record<LecturaLevel, string> = {
  A1: "bg-brand-100 text-brand-700",
  A2: "bg-sky-100 text-sky-700",
  B1: "bg-purple-100 text-purple-700"
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
      <section className="mx-auto max-w-app-shell px-4 py-10">
        <header className="mb-8">
          <h1 className="text-3xl font-semibold tracking-tight text-gray-900">
            Lectura · 西语短文阅读
          </h1>
          <p className="mt-2 text-sm text-gray-500">
            适合通勤、午休、工位 5 分钟。每段配 TTS 朗读，点任意单词查义。
          </p>
          {userId ? (
            <p className="mt-3 text-sm text-gray-500">已读 {readSlugs.size} / {sortedStories.length} 篇</p>
          ) : null}
        </header>

        <div className="grid gap-5 sm:grid-cols-2 lg:grid-cols-3">
          {sortedStories.map((story) => {
            const isRead = readSlugs.has(story.slug);

            return (
              <Link
                className={`group flex flex-col gap-3 rounded-surface border bg-surface p-5 shadow-card transition hover:-translate-y-[2px] hover:border-brand-200 hover:shadow-elevated ${
                  isRead ? "border-emerald-100" : "border-gray-100"
                }`}
                href={`/lectura/${story.slug}`}
                key={story.slug}
              >
                <div className="flex items-center justify-between">
                  <span
                    className={`inline-flex items-center rounded-full px-2.5 py-0.5 text-[11px] font-semibold ${levelStyle[story.level]}`}
                  >
                    {story.level}
                  </span>
                  <span className="text-[11px] text-gray-400">
                    {story.durationMin} min
                    {isRead ? <span className="ml-1.5 text-emerald-500">✓</span> : null}
                  </span>
                </div>

                <div>
                  <p className="text-base font-semibold text-gray-900 group-hover:text-brand-700">
                    {story.titleZh}
                  </p>
                  <p className="mt-0.5 text-[13px] italic text-gray-500">
                    {story.title}
                  </p>
                </div>

                <p className="text-sm leading-6 text-gray-600 line-clamp-3">
                  {story.summaryZh}
                </p>

                <p className="mt-auto text-[11px] text-gray-400">{story.source}</p>
              </Link>
            );
          })}
        </div>
      </section>
    </main>
  );
}
