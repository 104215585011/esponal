// Timestamp: 2026-06-04 11:11
import Link from "next/link";
import { BackLink } from "@/app/components/web/BackLink";
import { SiteHeader } from "@/app/components/web/SiteHeader";
import { foundationLessons } from "@/content/foundation";

export default function FoundationOverviewPage() {
  return (
    <main className="min-h-screen bg-app">
      <SiteHeader />
      <div className="mx-auto max-w-app-shell px-4 pt-5 pb-[calc(3.5rem+env(safe-area-inset-bottom)+16px)] sm:px-6 md:py-10 lg:px-8">
        <BackLink href="/learn" label="课程" />
        <section className="mt-4 max-w-3xl">
          <p className="text-sm font-semibold uppercase tracking-[0.18em] text-amber-600 dark:text-amber-400 font-display">
            Spanish Skeleton Words
          </p>
          <h1 className="mt-3 text-3xl font-semibold tracking-tight text-zinc-950 dark:text-zinc-50 sm:text-4xl font-display">
            7 天讲透西语骨架词
          </h1>
          <p className="mt-4 text-base leading-relaxed text-zinc-600 dark:text-zinc-400 font-light">
            这组课不急着塞新单词，而是先把代词、冠词、介词、连词、指示词和关系词这些高频小词讲清楚。它们像句子的骨架，先看懂骨架，再查内容词，阅读会轻很多。
          </p>
        </section>

        <section className="mt-8 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {foundationLessons.map((lesson) => (
            <Link
              className={`group rounded-hero border border-zinc-200/50 bg-white/70 p-5 shadow-sm glass-card transition-transform active:scale-[0.99] hover:border-amber-300 dark:border-zinc-800/50 dark:bg-zinc-900/70 dark:hover:border-amber-700/50 md:p-6 md:card-hover-lift md:active:scale-100 ${
                lesson.day === 1 ? "lg:col-span-2" : ""
              }`}
              href={`/learn/foundation/day-${lesson.day}`}
              key={lesson.day}
            >
              <div className="flex items-start justify-between gap-4">
                <p className="text-xs font-semibold uppercase tracking-[0.2em] text-amber-600 dark:text-amber-400 font-display">
                  DAY {lesson.day}
                </p>
                {lesson.day === 1 ? (
                  <span className="rounded-full bg-amber-100 dark:bg-amber-950/50 px-2.5 py-0.5 text-xs font-semibold text-amber-800 dark:text-amber-300">
                    推荐先读
                  </span>
                ) : null}
              </div>
              <h2 className="mt-3 text-xl font-semibold text-zinc-900 dark:text-zinc-50 font-display">{lesson.title}</h2>
              <p className="mt-2 text-sm leading-relaxed text-zinc-600 dark:text-zinc-400 font-light">{lesson.subtitle}</p>
              <p className="mt-5 text-xs text-zinc-400 dark:text-zinc-500">阅读约 {lesson.duration}</p>
            </Link>
          ))}
        </section>

        <Link
          href="/dissect"
          className="mt-8 flex flex-col gap-4 rounded-hero border border-zinc-200/50 bg-white/70 p-5 glass-card shadow-sm transition-transform active:scale-[0.99] hover:border-brand-300 dark:border-zinc-800/50 dark:bg-zinc-900/70 md:card-hover-lift md:active:scale-100 sm:flex-row sm:items-center"
        >
          <span className="flex h-12 w-12 shrink-0 items-center justify-center rounded-full bg-brand-50 dark:bg-brand-950/50 text-2xl font-bold text-brand-600 dark:text-brand-400 font-display">
            📐
          </span>
          <div className="flex-1">
            <p className="text-base font-semibold text-zinc-950 dark:text-zinc-50 font-display">句子拆解器</p>
            <p className="mt-1 text-sm leading-relaxed text-zinc-600 dark:text-zinc-400 font-light">
              粘任意西语句子，自动按词性高亮骨架词。学完一天后立刻试一段，看是不是真的看穿了句子。
            </p>
          </div>
          <span className="self-end text-sm font-semibold text-brand-600 dark:text-brand-400 sm:self-auto">
            打开 →
          </span>
        </Link>
      </div>
    </main>
  );
}
