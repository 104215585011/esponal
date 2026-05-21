import Link from "next/link";
import { SiteHeader } from "@/app/components/web/SiteHeader";
import { foundationLessons } from "@/content/foundation";

export default function FoundationOverviewPage() {
  return (
    <main className="min-h-screen bg-app text-gray-900">
      <SiteHeader />
      <div className="mx-auto max-w-app-shell px-4 py-10 sm:px-6 lg:px-8">
        <section className="max-w-3xl">
          <p className="text-sm font-semibold uppercase tracking-[0.18em] text-amber-700">
            Spanish Skeleton Words
          </p>
          <h1 className="mt-3 text-3xl font-semibold tracking-tight text-gray-950 sm:text-4xl">
            7 天讲透西语骨架词
          </h1>
          <p className="mt-4 text-base leading-8 text-gray-600">
            这组课不急着塞新单词，而是先把代词、冠词、介词、连词、指示词和关系词这些高频小词讲清楚。它们像句子的骨架，先看懂骨架，再查内容词，阅读会轻很多。
          </p>
        </section>

        <section className="mt-8 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {foundationLessons.map((lesson) => (
            <Link
              className={`group rounded-surface border border-gray-100 bg-surface p-6 shadow-card transition hover:-translate-y-0.5 hover:border-amber-300 hover:shadow-elevated ${
                lesson.day === 1 ? "lg:col-span-2" : ""
              }`}
              href={`/learn/foundation/day-${lesson.day}`}
              key={lesson.day}
            >
              <div className="flex items-start justify-between gap-4">
                <p className="text-xs font-semibold uppercase tracking-[0.2em] text-amber-700">
                  DAY {lesson.day}
                </p>
                {lesson.day === 1 ? (
                  <span className="rounded-full bg-amber-100 px-2 py-0.5 text-xs font-medium text-amber-800">
                    推荐先读
                  </span>
                ) : null}
              </div>
              <h2 className="mt-3 text-xl font-semibold text-gray-950">{lesson.title}</h2>
              <p className="mt-3 text-sm leading-6 text-gray-500">{lesson.subtitle}</p>
              <p className="mt-5 text-xs text-gray-400">阅读约 {lesson.duration}</p>
            </Link>
          ))}
        </section>
      </div>
    </main>
  );
}
