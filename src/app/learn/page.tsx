import Link from "next/link";
import { SiteHeader } from "@/app/components/web/SiteHeader";
import { getAllUnits } from "@/lib/curriculum";

export default function LearnOverviewPage() {
  const units = getAllUnits();

  return (
    <main className="min-h-screen bg-app text-gray-900">
      <SiteHeader />
      <div className="mx-auto max-w-screen-xl px-4 py-10 sm:px-6 lg:px-8">
        <section className="rounded-hero bg-gradient-to-br from-brand-600 via-brand-500 to-lime-400 px-6 py-8 text-white shadow-hero sm:px-8">
          <p className="text-sm font-medium uppercase tracking-[0.18em] text-brand-100">
            Esponal Curriculum
          </p>
          <div className="mt-4 flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
            <div className="max-w-2xl">
              <h1 className="text-3xl font-semibold sm:text-4xl">9 个单元，从打招呼一路走到真实交流。</h1>
              <p className="mt-3 max-w-xl text-sm leading-7 text-brand-50 sm:text-base">
                每个单元都按真实课堂节奏整理成词汇、句型、对话、语法和练习，学习时可以直接跳到站内播放器继续听继续看。
              </p>
            </div>
            <div className="grid grid-cols-3 gap-3 rounded-2xl bg-surface/14 p-4 text-sm text-brand-50 backdrop-blur">
              <div>
                <div className="text-2xl font-semibold text-white">{units.length}</div>
                <div>单元</div>
              </div>
              <div>
                <div className="text-2xl font-semibold text-white">A1-A2</div>
                <div>难度</div>
              </div>
              <div>
                <div className="text-2xl font-semibold text-white">Audio</div>
                <div>跟读</div>
              </div>
            </div>
          </div>
        </section>

        <section className="mt-8 grid gap-5 md:grid-cols-2 xl:grid-cols-3">
          {units.map((unit) => (
            <Link
              className="group rounded-hero border border-brand-100 bg-surface p-5 shadow-card transition hover:-translate-y-0.5 hover:border-brand-300 hover:shadow-elevated"
              href={`/learn/${unit.slug}`}
              key={unit.id}
            >
              <div className="flex items-start justify-between gap-4">
                <div>
                  <p className="text-xs font-semibold uppercase tracking-[0.2em] text-brand-600">
                    Unidad {unit.number}
                  </p>
                  <h2 className="mt-2 text-2xl font-semibold text-gray-900">{unit.title}</h2>
                  <p className="mt-1 text-sm text-gray-500">{unit.titleEs}</p>
                </div>
                <span className="rounded-full bg-brand-50 px-3 py-1 text-xs font-semibold text-brand-700">
                  {unit.level}
                </span>
              </div>

              <div className="mt-5 flex items-center gap-2 text-sm text-gray-500">
                <span>{unit.durationMin} min</span>
                <span className="text-gray-300">•</span>
                <span>{unit.recommendedVideoTitle}</span>
              </div>

              <div className="mt-5 flex flex-wrap gap-2">
                {unit.coreVerbs.map((verb) => (
                  <span
                    className="rounded-full bg-lime-50 px-3 py-1 text-xs font-medium text-lime-700"
                    key={verb}
                  >
                    {verb}
                  </span>
                ))}
              </div>

              <ul className="mt-5 space-y-2 text-sm leading-6 text-gray-600">
                {unit.communicativeGoals.slice(0, 3).map((goal) => (
                  <li className="flex gap-2" key={goal}>
                    <span className="mt-1.5 h-1.5 w-1.5 shrink-0 rounded-full bg-brand-400" />
                    <span>{goal}</span>
                  </li>
                ))}
              </ul>

              <div className="mt-6 flex items-center justify-between text-sm font-medium text-brand-700">
                <span>进入单元</span>
                <span className="transition group-hover:translate-x-0.5">→</span>
              </div>
            </Link>
          ))}
        </section>
      </div>
    </main>
  );
}
