// Timestamp: 2026-05-26 16:08
import Link from "next/link";
import { notFound } from "next/navigation";
import { SpanishText } from "@/app/components/vocab/SpanishText";
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
  const courseRef = `foundation-day-${lesson.day}`;
  const sourceUrl = `/learn/foundation/day-${lesson.day}`;

  return (
    <main className="min-h-screen bg-app">
      <SiteHeader />
      <article className="mx-auto max-w-3xl px-4 py-10 sm:px-6 lg:px-8">
        <BackLink href="/learn/foundation" label="7 天总览" />
        <p className="mt-4 text-sm text-zinc-400 dark:text-zinc-500 font-display">Day {lesson.day} / 7</p>
        <h1 className="mt-2 text-3xl font-semibold tracking-tight text-zinc-950 dark:text-zinc-50 sm:text-4xl font-display">
          {lesson.title}
        </h1>
        <p className="mt-3 text-base leading-relaxed text-zinc-600 dark:text-zinc-400 font-light">{lesson.subtitle}</p>

        <section className="mt-10 space-y-4">
          <h2 className="text-xl font-semibold text-zinc-900 dark:text-zinc-50 font-display">引入</h2>
          {lesson.sections.引入.map((paragraph) => (
            <p className="text-base leading-relaxed text-zinc-600 dark:text-zinc-400 font-light" key={paragraph}>
              {paragraph}
            </p>
          ))}
        </section>

        <section className="mt-10">
          <h2 className="text-xl font-semibold text-zinc-900 dark:text-zinc-50 font-display">对照表</h2>
          <p className="mt-3 text-base leading-relaxed text-zinc-600 dark:text-zinc-400 font-light">{lesson.sections.对照表}</p>
          <div className="mt-5 overflow-hidden rounded-hero border border-zinc-200/50 dark:border-zinc-800/50 bg-white/70 dark:bg-zinc-900/70 shadow-sm glass-card">
            {lesson.comparisonRows.map((row) => (
              <div
                className="border-b border-zinc-100 dark:border-zinc-800/50 p-4 last:border-b-0 sm:grid sm:grid-cols-[1fr_1fr_1.4fr] sm:gap-4"
                key={`${row.spanish}-${row.english}`}
              >
                <div>
                  <p className="text-base font-semibold text-zinc-900 dark:text-zinc-50 font-display">{row.spanish}</p>
                  <SpanishText
                    className="mt-2 block text-sm italic text-zinc-500 dark:text-zinc-400"
                    enableKeyboard={true}
                    source={{
                      type: "course",
                      url: sourceUrl,
                      courseRef,
                      sentence: row.example.es
                    }}
                    text={row.example.es}
                    translation={row.example.zh}
                  />
                </div>
                <div className="mt-3 sm:mt-0">
                  <p className="text-sm text-zinc-500 dark:text-zinc-500 font-light">{row.english}</p>
                  <p className="mt-2 text-sm italic text-zinc-400 dark:text-zinc-500">{row.example.en}</p>
                </div>
                <div className="mt-3 sm:mt-0">
                  <p className="text-sm text-zinc-700 dark:text-zinc-300 font-light">{row.chinese}</p>
                  <p className="mt-2 text-sm text-zinc-600 dark:text-zinc-400 font-light">{row.example.zh}</p>
                </div>
              </div>
            ))}
          </div>
        </section>

        <section className="mt-10 space-y-4">
          <h2 className="text-xl font-semibold text-zinc-900 dark:text-zinc-50 font-display">西英差异</h2>
          {lesson.sections.西英差异.map((paragraph) => (
            <p className="text-base leading-relaxed text-zinc-600 dark:text-zinc-400 font-light" key={paragraph}>
              {paragraph}
            </p>
          ))}
          <div className="space-y-4">
            {lesson.contrastBlocks.map((block) => (
              <blockquote
                className="border-l-2 border-brand-200 pl-3 text-sm leading-relaxed text-zinc-600 dark:text-zinc-400 font-light bg-zinc-50/50 dark:bg-zinc-950/20 py-2.5 pr-4 rounded-r-xl"
                key={block}
              >
                {block}
              </blockquote>
            ))}
          </div>
        </section>

        <section className="mt-10 space-y-4">
          <h2 className="text-xl font-semibold text-zinc-900 dark:text-zinc-50 font-display">真实使用</h2>
          {lesson.sections.真实使用.map((paragraph) => (
            <p className="text-base leading-relaxed text-zinc-600 dark:text-zinc-400 font-light" key={paragraph}>
              {paragraph}
            </p>
          ))}
          <div className="space-y-4">
            {lesson.usageExamples.map((example) => (
              <blockquote
                className="border-l-2 border-brand-200 pl-3 text-sm leading-relaxed text-zinc-600 dark:text-zinc-400 font-light bg-zinc-50/50 dark:bg-zinc-950/20 py-2.5 pr-4 rounded-r-xl"
                key={example.es}
              >
                <SpanishText
                  className="block font-medium text-zinc-900 dark:text-zinc-50 font-display"
                  enableKeyboard={true}
                  source={{
                    type: "course",
                    url: sourceUrl,
                    courseRef,
                    sentence: example.es
                  }}
                  text={example.es}
                  translation={example.zh}
                />
                <p className="text-zinc-400 dark:text-zinc-500 font-light">{example.en}</p>
                <p className="text-zinc-700 dark:text-zinc-300 font-light">{example.zh}</p>
              </blockquote>
            ))}
          </div>
        </section>

        <nav className="mt-12 flex items-center justify-between gap-3 border-t border-zinc-200 dark:border-zinc-800/80 pt-6 text-sm font-medium">
          {previousLesson ? (
            <Link
              className="rounded-full bg-zinc-100 dark:bg-zinc-800 hover:bg-zinc-200 dark:hover:bg-zinc-700 px-5 py-2.5 text-zinc-700 dark:text-zinc-300 transition-all duration-300"
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
            className="rounded-full border border-zinc-200 dark:border-zinc-800 hover:border-brand-500 px-5 py-2.5 text-zinc-700 dark:text-zinc-300 transition-all duration-300"
            href="/learn/foundation"
          >
            返回总览
          </Link>
          {nextLesson ? (
            <Link
              className="rounded-full bg-brand-500 hover:bg-brand-600 px-5 py-2.5 text-white transition-all duration-300 shadow-md shadow-brand-500/10"
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
