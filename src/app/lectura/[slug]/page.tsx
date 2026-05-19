import Link from "next/link";
import { notFound } from "next/navigation";
import { SiteHeader } from "@/app/components/web/SiteHeader";
import { LecturaReader } from "../LecturaReader";
import { getLecturaStory, lecturaStories, type LecturaLevel } from "@/../content/lectura";

export const dynamic = "force-static";

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

export default function LecturaReadPage({ params }: LecturaReadPageProps) {
  const story = getLecturaStory(params.slug);

  if (!story) {
    notFound();
  }

  return (
    <main className="min-h-screen bg-app">
      <SiteHeader />
      <article className="mx-auto max-w-3xl px-6 pb-24 pt-10">
        <Link
          className="mb-8 inline-flex items-center gap-1 text-sm text-gray-500 transition hover:text-brand-600"
          href="/lectura"
        >
          ← 返回 Lectura
        </Link>

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
          <LecturaReader story={story} />
        </div>

        <footer className="mt-16 border-t border-gray-100 pt-6 text-center text-xs text-gray-400">
          ⌛ 大约 {story.durationMin} 分钟  ·  💡 点击任意单词查义
        </footer>
      </article>
    </main>
  );
}
