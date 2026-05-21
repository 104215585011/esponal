import Link from "next/link";
import { notFound } from "next/navigation";
import { BackLink } from "@/app/components/web/BackLink";
import { SiteHeader } from "@/app/components/web/SiteHeader";
import { foundationLessons, getFoundationLesson } from "@/content/foundation";

type FoundationDayPageProps = {
  params: {
    day: string;
  };
};

export function generateStaticParams() {
  return foundationLessons.map((lesson) => ({ day: `day-${lesson.day}` }));
}

export default function FoundationDayPage({ params }: FoundationDayPageProps) {
  const lesson = getFoundationLesson(params.day);

  if (!lesson) {
    notFound();
  }

  const previousLesson = lesson.day > 1 ? lesson.day - 1 : null;
  const nextLesson = lesson.day < 7 ? lesson.day + 1 : null;

  return (
    <main className="min-h-screen bg-app text-gray-900">
      <SiteHeader />
      <article className="mx-auto max-w-3xl px-4 py-10 sm:px-6 lg:px-8">
        <BackLink href="/learn/foundation" label="7 天总览" />
        <p className="mt-4 text-sm text-gray-400">Day {lesson.day} / 7</p>
        <h1 className="mt-2 text-3xl font-semibold tracking-tight text-gray-950">
          {lesson.title}
        </h1>
        <p className="mt-3 text-base leading-8 text-gray-600">{lesson.subtitle}</p>

        <section className="mt-10 space-y-4">
          <h2 className="text-xl font-semibold text-gray-950">引入</h2>
          {lesson.sections.引入.map((paragraph) => (
            <p className="text-base leading-8 text-gray-700" key={paragraph}>
              {paragraph}
            </p>
          ))}
        </section>

        <section className="mt-10">
          <h2 className="text-xl font-semibold text-gray-950">对照表</h2>
          <p className="mt-3 text-base leading-8 text-gray-700">{lesson.sections.对照表}</p>
          <div className="mt-5 overflow-hidden rounded-surface border border-gray-100 bg-surface shadow-card">
            {lesson.comparisonRows.map((row) => (
              <div
                className="border-b border-gray-100 p-4 last:border-b-0 sm:grid sm:grid-cols-[1fr_1fr_1.4fr] sm:gap-4"
                key={`${row.spanish}-${row.english}`}
              >
                <div>
                  <p className="text-base font-semibold text-gray-950">{row.spanish}</p>
                  <p className="mt-2 text-sm italic text-gray-600">{row.example.es}</p>
                </div>
                <div className="mt-3 sm:mt-0">
                  <p className="text-sm text-gray-500">{row.english}</p>
                  <p className="mt-2 text-sm italic text-gray-500">{row.example.en}</p>
                </div>
                <div className="mt-3 sm:mt-0">
                  <p className="text-sm text-gray-700">{row.chinese}</p>
                  <p className="mt-2 text-sm text-gray-600">{row.example.zh}</p>
                </div>
              </div>
            ))}
          </div>
        </section>

        <section className="mt-10 space-y-4">
          <h2 className="text-xl font-semibold text-gray-950">西英差异</h2>
          {lesson.sections.西英差异.map((paragraph) => (
            <p className="text-base leading-8 text-gray-700" key={paragraph}>
              {paragraph}
            </p>
          ))}
          <div className="space-y-4">
            {lesson.contrastBlocks.map((block) => (
              <blockquote
                className="border-l-2 border-brand-200 pl-3 text-sm leading-7 text-gray-700"
                key={block}
              >
                {block}
              </blockquote>
            ))}
          </div>
        </section>

        <section className="mt-10 space-y-4">
          <h2 className="text-xl font-semibold text-gray-950">真实使用</h2>
          {lesson.sections.真实使用.map((paragraph) => (
            <p className="text-base leading-8 text-gray-700" key={paragraph}>
              {paragraph}
            </p>
          ))}
          <div className="space-y-4">
            {lesson.usageExamples.map((example) => (
              <blockquote
                className="border-l-2 border-brand-200 pl-3 text-sm leading-7 text-gray-700"
                key={example.es}
              >
                <p className="font-medium text-gray-900">{example.es}</p>
                <p className="text-gray-500">{example.en}</p>
                <p>{example.zh}</p>
              </blockquote>
            ))}
          </div>
        </section>

        <nav className="mt-12 flex items-center justify-between gap-3 border-t border-gray-100 pt-6 text-sm font-medium">
          {previousLesson ? (
            <Link
              className="rounded-full bg-gray-100 px-4 py-2 text-gray-700 transition hover:bg-gray-200"
              href={`/learn/foundation/day-${previousLesson}`}
            >
              上一天
            </Link>
          ) : (
            <span aria-hidden="true" style={{ visibility: "hidden" }}>
              上一天
            </span>
          )}
          <Link
            className="rounded-full border border-gray-200 px-4 py-2 text-gray-700 transition hover:border-gray-300 hover:bg-gray-50"
            href="/learn/foundation"
          >
            返回总览
          </Link>
          {nextLesson ? (
            <Link
              className="rounded-full bg-brand-600 px-4 py-2 text-white transition hover:bg-brand-700"
              href={`/learn/foundation/day-${nextLesson}`}
            >
              下一天
            </Link>
          ) : (
            <span aria-hidden="true" style={{ visibility: "hidden" }}>
              下一天
            </span>
          )}
        </nav>
      </article>
    </main>
  );
}
