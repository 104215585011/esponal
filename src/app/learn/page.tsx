// Timestamp: 2026-06-04 11:05
import Link from "next/link";
import EmptyState from "@/app/components/ui/EmptyState";
import { SiteHeader } from "@/app/components/web/SiteHeader";
import { getAllUnits } from "@/lib/curriculum";

export default function LearnOverviewPage() {
  const units = getAllUnits();

  return (
    <main className="min-h-screen bg-app">
      <SiteHeader />
      <div className="mx-auto max-w-app-shell px-4 pt-5 pb-[calc(3.5rem+env(safe-area-inset-bottom)+16px)] sm:px-6 md:py-10 lg:px-8">
        <section className="rounded-hero bg-gradient-to-br from-brand-600 via-brand-500 to-brand-400 px-5 py-6 text-white shadow-card sm:px-8 md:py-8 md:shadow-hero">
          <p className="text-sm font-medium uppercase tracking-[0.18em] text-brand-100 font-display">
            Esponal Curriculum
          </p>
          <div className="mt-4 flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
            <div className="max-w-2xl">
              <h1 className="text-2xl font-semibold leading-snug sm:text-4xl font-display tracking-tight">9 个单元，从打招呼一路走到真实交流。</h1>
              <p className="mt-3 max-w-xl text-sm leading-relaxed text-brand-50 font-light line-clamp-3 md:line-clamp-none sm:text-base">
                每个单元都按真实课堂节奏整理成词汇、句型、对话、语法和练习，学习时可以直接跳到站内播放器继续听继续看。
              </p>
            </div>
            <div className="mt-4 grid grid-cols-3 gap-3 rounded-2xl bg-white/10 p-3 text-sm text-brand-50 backdrop-blur dark:bg-black/20 md:mt-0 md:p-4">
              <div>
                <div className="text-2xl font-bold text-white font-display">{units.length}</div>
                <div className="text-xs opacity-80">单元</div>
              </div>
              <div>
                <div className="text-2xl font-bold text-white font-display">A1-A2</div>
                <div className="text-xs opacity-80">难度</div>
              </div>
              <div>
                <div className="text-2xl font-bold text-white font-display">Audio</div>
                <div className="text-xs opacity-80">跟读</div>
              </div>
            </div>
          </div>
        </section>

        <Link
          className="mt-5 flex flex-col gap-4 rounded-hero border border-amber-200 bg-amber-50/60 p-5 transition active:scale-[0.99] hover:border-amber-300 hover:shadow-card dark:bg-amber-950/20 md:mt-6 md:active:scale-100 sm:flex-row sm:items-center"
          href="/learn/foundation"
        >
          <span className="flex h-12 w-12 shrink-0 items-center justify-center rounded-full bg-amber-100 dark:bg-amber-900/50 text-lg font-bold text-amber-800 dark:text-amber-300 font-display">
            7
          </span>
          <div className="flex-1">
            <p className="text-base font-semibold text-zinc-950 dark:text-zinc-100 font-display">
              新手起步 · 7 天讲透西语骨架词
            </p>
            <p className="mt-1 text-sm leading-relaxed text-zinc-600 dark:text-zinc-400">
              先认清代词、冠词、介词、连词这些高频小词，再进入单元内容。每天 5-8 分钟。
            </p>
          </div>
          <span className="self-end text-sm font-semibold text-amber-700 dark:text-amber-400 sm:self-auto">
            开始 →
          </span>
        </Link>

        {units.length === 0 ? (
          <EmptyState
            description="请稍后刷新"
            kind="empty"
            title="课程内容加载中"
          />
        ) : (
          <section className="mt-7 grid grid-cols-1 gap-3 md:mt-8 md:grid-cols-2 md:gap-5 xl:grid-cols-3">
            {units.map((unit) => (
              <Link
                className="group flex flex-col rounded-card border border-brand-100 bg-white/70 p-4 glass-card shadow-sm transition-transform active:scale-[0.99] hover:border-brand-300 dark:border-brand-900/40 dark:bg-zinc-900/70 dark:hover:border-brand-700/50 md:rounded-hero md:p-5 md:card-hover-lift md:active:scale-100"
                href={`/learn/${unit.slug}`}
                key={unit.id}
              >
                <div className="flex items-start justify-between gap-4">
                  <div>
                    <p className="text-xs font-semibold uppercase tracking-[0.2em] text-brand-600 dark:text-brand-400">
                      Unidad {unit.number}
                    </p>
                    <h2 className="mt-2 text-xl font-semibold text-zinc-900 dark:text-zinc-50 font-display md:text-2xl">{unit.title}</h2>
                    <p className="mt-1 truncate text-sm text-zinc-400 dark:text-zinc-500">{unit.titleEs}</p>
                  </div>
                  <span className="rounded-full bg-brand-50 dark:bg-brand-950/50 px-3 py-1 text-xs font-semibold text-brand-700 dark:text-brand-400">
                    {unit.level}
                  </span>
                </div>

                <div className="mt-3 flex items-center gap-2 text-sm text-zinc-500 dark:text-zinc-400 md:mt-5">
                  <span className="font-semibold text-zinc-700 dark:text-zinc-300">{unit.durationMin} min</span>
                  <span className="text-zinc-300 dark:text-zinc-700">•</span>
                  <span className="line-clamp-1">{unit.recommendedVideoTitle}</span>
                </div>

                <div className="mt-5 hidden flex-wrap gap-2 md:flex">
                  {unit.coreVerbs.map((verb) => (
                    <span
                      className="rounded-full bg-zinc-100 dark:bg-zinc-800 px-3 py-1 text-xs font-medium text-zinc-700 dark:text-zinc-300"
                      key={verb}
                    >
                      {verb}
                    </span>
                  ))}
                </div>

                <ul className="mt-3 space-y-2 text-sm leading-relaxed text-zinc-600 dark:text-zinc-400 md:mt-5">
                  {unit.communicativeGoals.slice(0, 3).map((goal, i) => (
                    <li className={`items-start gap-2 ${i === 0 ? "flex" : "hidden md:flex"}`} key={goal}>
                      <span className="mt-2 h-1.5 w-1.5 shrink-0 rounded-full bg-brand-400 dark:bg-brand-600" />
                      <span className="line-clamp-1 md:line-clamp-none">{goal}</span>
                    </li>
                  ))}
                </ul>

                <div className="mt-4 flex items-center justify-between text-sm font-semibold text-brand-500 hover:text-brand-600 dark:hover:text-brand-400 md:mt-6">
                  <span>进入单元</span>
                  <span className="transition group-hover:translate-x-1 duration-300 transform">→</span>
                </div>
              </Link>
            ))}
          </section>
        )}
      </div>
    </main>
  );
}
