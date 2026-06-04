// Timestamp: 2026-06-04 13:24
import Link from "next/link";
import EmptyState from "@/app/components/ui/EmptyState";
import { SiteHeader } from "@/app/components/web/SiteHeader";
import { getAllUnits, type UnitManifestEntry } from "@/lib/curriculum";

const MOBILE_STARTED_UNIT_SLUGS = new Set(["unidad-1", "unidad-2"]);

function getMobileUnitSummary(unit: UnitManifestEntry) {
  return unit.communicativeGoals.slice(0, 2).join(" · ");
}

function MobileLearnOverview({ units }: { units: UnitManifestEntry[] }) {
  const startedCount = units.filter((unit) => MOBILE_STARTED_UNIT_SLUGS.has(unit.slug)).length;
  const kickerDot = <span className="h-[7px] w-[7px] rounded-full bg-brand-500 shadow-[0_0_0_4px_rgba(236,248,242,1)]" />;

  return (
    <div className="md:hidden">
      <section className="px-[22px] pt-7">
        <span className="inline-flex items-center gap-[7px] text-[12.5px] font-semibold tracking-[0.03em] text-brand-700">
          {kickerDot}
          9 个单元
        </span>
        <h1 className="mt-[10px] font-display text-[27px] font-bold leading-[1.36] tracking-[-0.01em] text-zinc-950">
          从打招呼，
          <br />
          一路走到真实交流。
        </h1>
        <p className="mt-[11px] max-w-[300px] text-[13.5px] font-light leading-[1.75] text-zinc-500">
          每个单元按真实课堂节奏，整理成词汇、句型、对话、语法和练习。
        </p>
      </section>

      <section className="mt-[18px] grid grid-cols-3 gap-[10px] px-[22px]">
        <div className="rounded-[14px] border border-zinc-200/70 bg-white px-[14px] py-[13px] shadow-card">
          <div className="font-display text-[20px] font-bold leading-none text-zinc-950">{units.length}</div>
          <div className="mt-1 text-[11px] text-zinc-500">单元</div>
        </div>
        <div className="rounded-[14px] border border-zinc-200/70 bg-white px-[14px] py-[13px] shadow-card">
          <div className="font-display text-[20px] font-bold leading-none text-zinc-950">{startedCount} / {units.length}</div>
          <div className="mt-1 text-[11px] text-zinc-500">已开始</div>
        </div>
        <div className="rounded-[14px] border border-zinc-200/70 bg-white px-[14px] py-[13px] shadow-card">
          <div className="font-display text-[20px] font-bold leading-none text-zinc-950">{units[0]?.level ?? "A1"}</div>
          <div className="mt-1 text-[11px] text-zinc-500">当前级别</div>
        </div>
      </section>

      <Link
        className="mx-[22px] mt-[22px] flex items-center gap-[14px] rounded-[20px] border border-brand-100 bg-gradient-to-b from-brand-50 to-white px-[18px] py-[18px] shadow-card active:scale-[0.99]"
        href="/learn/foundation"
      >
        <span className="grid h-[46px] w-[46px] shrink-0 place-items-center rounded-[14px] bg-brand-500 text-white shadow-[0_6px_14px_-6px_rgba(16,185,129,0.55)]">
          <svg aria-hidden className="h-[22px] w-[22px]" fill="none" stroke="currentColor" strokeWidth="1.9" viewBox="0 0 24 24">
            <path d="M12 3 4 7v6c0 4 3.5 6.5 8 8 4.5-1.5 8-4 8-8V7z" strokeLinecap="round" strokeLinejoin="round" />
          </svg>
        </span>
        <div className="min-w-0 flex-1">
          <h2 className="font-display text-[15px] font-semibold text-zinc-950">起步 · 高频小词</h2>
          <p className="mt-[3px] text-[11.5px] font-light leading-[1.5] text-zinc-500">
            先认清代词、冠词、介词、连词，再进入单元。每天 5 到 8 分钟。
          </p>
        </div>
        <span className="shrink-0 text-brand-700">
          <svg aria-hidden className="h-[18px] w-[18px]" fill="none" stroke="currentColor" strokeWidth="2.2" viewBox="0 0 24 24">
            <path d="M9 6l6 6-6 6" strokeLinecap="round" />
          </svg>
        </span>
      </Link>

      <section className="mt-[34px] px-[22px]">
        <div className="flex items-center justify-between">
          <h2 className="font-display text-[18px] font-bold text-zinc-950">单元</h2>
          <span className="text-[12px] text-zinc-500">共 {units.length} 个</span>
        </div>
        <div className="mt-[14px] flex flex-col gap-[11px] px-[22px]">
          {units.map((unit) => {
            const isStarted = MOBILE_STARTED_UNIT_SLUGS.has(unit.slug);
            return (
              <Link
                className="flex items-center gap-[14px] rounded-[18px] border border-zinc-200/70 bg-white px-4 py-[15px] shadow-card active:scale-[0.99]"
                href={`/learn/${unit.slug}`}
                key={unit.id}
              >
                <span
                  className={`grid h-[44px] w-[44px] rounded-[13px] shrink-0 place-items-center font-display text-base font-bold ${
                    isStarted
                      ? "bg-brand-500 text-white"
                      : "bg-brand-50 text-brand-700"
                  }`}
                >
                  {String(unit.number).padStart(2, "0")}
                </span>
                <div className="min-w-0 flex-1">
                  <div className="flex items-center gap-2">
                    <h3 className="truncate font-display text-[15.5px] font-semibold text-zinc-950">{unit.title}</h3>
                    <span className="shrink-0 rounded-full border border-zinc-200 px-[7px] py-[1px] text-[10px] font-medium text-zinc-500">
                      {unit.level}
                    </span>
                  </div>
                  <p className="mt-1 truncate text-[11.5px] font-light text-zinc-500">{getMobileUnitSummary(unit)}</p>
                </div>
                <span className={`shrink-0 ${isStarted ? "text-brand-600" : "text-zinc-300"}`}>
                  <svg aria-hidden className="h-[18px] w-[18px]" fill="none" stroke="currentColor" strokeWidth="2.2" viewBox="0 0 24 24">
                    <path d="M9 6l6 6-6 6" strokeLinecap="round" />
                  </svg>
                </span>
              </Link>
            );
          })}
        </div>
      </section>

      <div className="mt-[36px] px-[22px] text-[11px] tracking-[0.06em] text-zinc-300">Esponal</div>
    </div>
  );
}

function DesktopUnitCard({ unit }: { unit: UnitManifestEntry }) {
  return (
    <Link
      className="group flex flex-col rounded-hero border border-brand-100 bg-white/70 p-5 glass-card shadow-sm transition-transform hover:border-brand-300 dark:border-brand-900/40 dark:bg-zinc-900/70 dark:hover:border-brand-700/50 md:card-hover-lift"
      href={`/learn/${unit.slug}`}
    >
      <div className="flex items-start justify-between gap-4">
        <div>
          <p className="text-xs font-semibold uppercase tracking-[0.2em] text-brand-600 dark:text-brand-400">
            Unidad {unit.number}
          </p>
          <h2 className="mt-2 text-2xl font-semibold text-zinc-900 dark:text-zinc-50 font-display">{unit.title}</h2>
          <p className="mt-1 truncate text-sm text-zinc-400 dark:text-zinc-500">{unit.titleEs}</p>
        </div>
        <span className="rounded-full bg-brand-50 dark:bg-brand-950/50 px-3 py-1 text-xs font-semibold text-brand-700 dark:text-brand-400">
          {unit.level}
        </span>
      </div>

      <div className="mt-5 flex items-center gap-2 text-sm text-zinc-500 dark:text-zinc-400">
        <span className="font-semibold text-zinc-700 dark:text-zinc-300">{unit.durationMin} min</span>
        <span className="text-zinc-300 dark:text-zinc-700">•</span>
        <span className="line-clamp-1">{unit.recommendedVideoTitle}</span>
      </div>

      <div className="mt-5 flex flex-wrap gap-2">
        {unit.coreVerbs.map((verb) => (
          <span
            className="rounded-full bg-zinc-100 dark:bg-zinc-800 px-3 py-1 text-xs font-medium text-zinc-700 dark:text-zinc-300"
            key={verb}
          >
            {verb}
          </span>
        ))}
      </div>

      <ul className="mt-5 space-y-2 text-sm leading-relaxed text-zinc-600 dark:text-zinc-400">
        {unit.communicativeGoals.slice(0, 3).map((goal) => (
          <li className="flex items-start gap-2" key={goal}>
            <span className="mt-2 h-1.5 w-1.5 shrink-0 rounded-full bg-brand-400 dark:bg-brand-600" />
            <span>{goal}</span>
          </li>
        ))}
      </ul>

      <div className="mt-6 flex items-center justify-between text-sm font-semibold text-brand-500 hover:text-brand-600 dark:hover:text-brand-400">
        <span>进入单元</span>
        <span className="transition duration-300 group-hover:translate-x-1 transform">→</span>
      </div>
    </Link>
  );
}

function DesktopLearnOverview({ units }: { units: UnitManifestEntry[] }) {
  return (
    <div className="hidden md:block">
      <section className="rounded-hero bg-gradient-to-br from-brand-600 via-brand-500 to-brand-400 px-5 py-6 text-white shadow-card sm:px-8 md:py-8 md:shadow-hero">
        <p className="text-sm font-medium uppercase tracking-[0.18em] text-brand-100 font-display">
          Esponal Curriculum
        </p>
        <div className="mt-4 flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
          <div className="max-w-2xl">
            <h1 className="text-2xl font-semibold leading-snug sm:text-4xl font-display tracking-tight">9 个单元，从打招呼一路走到真实交流。</h1>
            <p className="mt-3 max-w-xl text-sm leading-relaxed text-brand-50 font-light sm:text-base">
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
        className="mt-6 flex flex-col gap-4 rounded-hero border border-amber-200 bg-amber-50/60 p-5 transition hover:border-amber-300 hover:shadow-card dark:bg-amber-950/20 sm:flex-row sm:items-center"
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

      <section className="mt-8 grid grid-cols-1 gap-5 md:grid-cols-2 xl:grid-cols-3">
        {units.map((unit) => (
          <DesktopUnitCard key={unit.id} unit={unit} />
        ))}
      </section>
    </div>
  );
}

export default function LearnOverviewPage() {
  const units = getAllUnits();

  return (
    <main className="min-h-screen bg-app">
      <SiteHeader />
      <div className="mx-auto max-w-app-shell px-4 pt-5 pb-[calc(3.5rem+env(safe-area-inset-bottom)+16px)] sm:px-6 md:py-10 lg:px-8">
        {units.length === 0 ? (
          <EmptyState
            description="请稍后刷新"
            kind="empty"
            title="课程内容加载中"
          />
        ) : (
          <>
            <MobileLearnOverview units={units} />
            <DesktopLearnOverview units={units} />
          </>
        )}
      </div>
    </main>
  );
}
