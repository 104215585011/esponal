// Timestamp: 2026-06-04 11:09
import Link from "next/link";
import { notFound } from "next/navigation";
import AudioButton from "@/app/components/audio/AudioButton";
import { SpanishText } from "@/app/components/vocab/SpanishText";
import { BackLink } from "@/app/components/web/BackLink";
import { SiteHeader } from "@/app/components/web/SiteHeader";
import { getAllUnits, getUnitPageData } from "@/lib/curriculum";

type UnitDetailPageProps = {
  params: {
    slug: string;
  };
};

const sectionAnchors = [
  { id: "goals", label: "学习目标" },
  { id: "vocab", label: "核心词汇" },
  { id: "phrases", label: "句型" },
  { id: "dialogues", label: "对话" },
  { id: "grammar", label: "语法" },
  { id: "compare", label: "中西对比" },
  { id: "exercises", label: "练习" }
];

export function generateStaticParams() {
  return getAllUnits().map((unit) => ({ slug: unit.slug }));
}

export default function UnitDetailPage({ params }: UnitDetailPageProps) {
  const units = getAllUnits();

  if (!units.some((unit) => unit.slug === params.slug)) {
    notFound();
  }

  const { unit, content, prevUnit, nextUnit } = getUnitPageData(params.slug);

  return (
    <main className="min-h-screen bg-app">
      <SiteHeader />
      <div className="mx-auto flex max-w-app-shell gap-8 px-4 pt-4 pb-[calc(3.5rem+env(safe-area-inset-bottom)+16px)] sm:px-6 md:py-8 lg:px-8">
        <aside className="sticky top-24 hidden h-fit w-56 shrink-0 rounded-hero border border-zinc-200/50 dark:border-zinc-800/50 bg-white/70 dark:bg-zinc-900/70 p-5 shadow-sm glass-card lg:block">
          <p className="text-xs font-semibold uppercase tracking-[0.22em] text-brand-600 dark:text-brand-400 font-display">
            Unidad {unit.number}
          </p>
          <nav className="mt-4 space-y-1 text-sm text-zinc-600 dark:text-zinc-400">
            {sectionAnchors.map((section) => (
              <a
                className="flex items-center rounded-xl border-l-2 border-transparent px-3 py-2 transition hover:border-brand-500 hover:bg-zinc-100/50 dark:hover:bg-zinc-800/50 hover:text-brand-600 dark:hover:text-brand-400"
                href={`#${section.id}`}
                key={section.id}
              >
                {section.label}
              </a>
            ))}
          </nav>
        </aside>

        <div className="min-w-0 flex-1">
          <BackLink href="/learn" label="课程" />

          <section className="overflow-hidden rounded-hero bg-gradient-to-br from-brand-600 via-brand-500 to-brand-400 px-5 py-6 text-white shadow-card sm:px-8 md:py-8 md:shadow-hero">
            <div className="flex flex-wrap items-start justify-between gap-4">
              <div className="max-w-2xl">
                <div className="flex items-center gap-3">
                  <span className="rounded-full bg-white/10 px-3 py-1 text-xs font-semibold uppercase tracking-[0.18em] text-brand-50 font-display">
                    {unit.level}
                  </span>
                  <span className="text-sm text-brand-50">Unidad {unit.number}</span>
                </div>
                <h1 className="mt-4 text-2xl font-semibold leading-snug sm:text-4xl font-display tracking-tight">{unit.title}</h1>
                <p className="mt-2 text-lg text-brand-50 font-light">{unit.titleEs}</p>
              </div>

              <div className="mt-4 grid w-full grid-cols-3 gap-3 rounded-hero bg-white/10 p-3 text-sm text-brand-50 backdrop-blur dark:bg-black/20 sm:mt-0 sm:min-w-[220px] sm:grid-cols-3 md:p-4">
                <div>
                  <div className="text-xl font-bold text-white font-display">{unit.durationMin} min</div>
                  <div className="text-xs opacity-80">时长</div>
                </div>
                <div>
                  <div className="text-xl font-bold text-white font-display">{content.vocabGroups.length}</div>
                  <div className="text-xs opacity-80">词汇组</div>
                </div>
                <div>
                  <div className="text-xl font-bold text-white font-display">Audio</div>
                  <div className="text-xs opacity-80">跟读</div>
                </div>
              </div>
            </div>
          </section>

          <nav
            aria-label="章节导航"
            className="-mx-4 mt-4 flex gap-2 overflow-x-auto px-4 pb-1 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden lg:hidden"
          >
            {sectionAnchors.map((section) => (
              <a
                className="shrink-0 rounded-full border border-zinc-200/70 bg-white/70 px-3.5 py-2 text-xs font-medium text-zinc-600 transition active:scale-95 dark:border-zinc-800/60 dark:bg-zinc-900/70 dark:text-zinc-400"
                href={`#${section.id}`}
                key={section.id}
              >
                {section.label}
              </a>
            ))}
          </nav>

          <section className="mt-6 rounded-hero border border-zinc-200/50 bg-white/70 p-4 shadow-sm glass-card dark:border-zinc-800/50 dark:bg-zinc-900/70 md:mt-8 md:p-6" id="goals">
            <p className="text-xs font-semibold uppercase tracking-[0.2em] text-brand-600 dark:text-brand-400 font-display">Goals</p>
            <h2 className="mt-2 text-xl font-semibold text-zinc-900 dark:text-zinc-50 font-display md:text-2xl">学习目标</h2>
            <div className="mt-6 grid gap-3 sm:grid-cols-2">
              {unit.communicativeGoals.map((goal) => (
                <div
                  className="flex items-start gap-3 rounded-2xl bg-brand-50/40 dark:bg-brand-950/20 border border-zinc-100/50 dark:border-zinc-800/20 px-4 py-3 text-sm leading-relaxed text-zinc-700 dark:text-zinc-300"
                  key={goal}
                >
                  <span className="mt-0.5 flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-white dark:bg-zinc-800 text-xs font-semibold text-brand-600 dark:text-brand-400 shadow-sm">
                    ✓
                  </span>
                  <span>{goal}</span>
                </div>
              ))}
            </div>
          </section>

          <section className="mt-7" id="vocab">
            <p className="text-xs font-semibold uppercase tracking-[0.2em] text-brand-600 dark:text-brand-400 font-display">Vocabulary</p>
            <h2 className="mt-2 text-xl font-semibold text-zinc-900 dark:text-zinc-50 font-display md:text-2xl">核心词汇</h2>
            <div className="mt-6 space-y-6 md:space-y-8">
              {content.vocabGroups.map((group) => (
                <section key={group.title}>
                  <h3 className="text-lg font-semibold text-zinc-900 dark:text-zinc-100 font-display">{group.title}</h3>
                  <div className="mt-4 grid gap-3 md:grid-cols-2 md:gap-4 xl:grid-cols-3">
                    {group.items.map((item) => (
                      <article
                        className="group rounded-surface border border-zinc-200/50 bg-white/70 p-4 glass-card shadow-sm dark:border-zinc-800/50 dark:bg-zinc-900/70 md:p-5 md:card-hover-lift"
                        key={`${group.title}-${item.es}`}
                      >
                        <div className="flex items-start justify-between gap-3">
                          <div className="min-w-0">
                            <h4 className="text-lg font-semibold text-zinc-900 dark:text-zinc-50 font-display">
                              <SpanishText
                                source={{
                                  type: "course",
                                  url: `/learn/${unit.slug}#vocab`,
                                  courseRef: `unidad-${unit.number} / ${group.title} / ${item.es}`,
                                  sentence: item.es
                                }}
                                text={item.es}
                                translation={item.zh}
                              />
                            </h4>
                            <p className="mt-1 text-sm text-zinc-500 dark:text-zinc-400">{item.zh}</p>
                          </div>
                          <AudioButton label={item.es} src={item.audioSrc} />
                        </div>
                        {item.note ? <p className="mt-3 text-sm leading-relaxed text-zinc-600 dark:text-zinc-400 font-light">{item.note}</p> : null}
                      </article>
                    ))}
                  </div>
                </section>
              ))}
            </div>
          </section>

          <section className="mt-7 md:mt-10" id="phrases">
            <p className="text-xs font-semibold uppercase tracking-[0.2em] text-brand-600 dark:text-brand-400 font-display">Phrases</p>
            <h2 className="mt-2 text-xl font-semibold text-zinc-900 dark:text-zinc-50 font-display md:text-2xl">句型</h2>
            <div className="mt-6 space-y-5 md:space-y-6">
              {content.phrases.map((group) => (
                <section className="rounded-hero border border-zinc-200/50 bg-white/70 p-4 glass-card shadow-sm dark:border-zinc-800/50 dark:bg-zinc-900/70 md:p-6" key={group.category}>
                  <h3 className="text-lg font-semibold text-zinc-900 dark:text-zinc-50 font-display border-b border-zinc-100 dark:border-zinc-800/50 pb-3 mb-4">{group.category}</h3>
                  <div className="divide-y divide-zinc-100 dark:divide-zinc-800/60">
                    {group.items.map((item) => (
                      <div className="flex flex-col gap-2 py-4 md:grid md:grid-cols-[1.1fr_1fr_auto] md:gap-3 md:items-center" key={`${group.category}-${item.es}`}>
                        <div className="flex items-start justify-between gap-3 md:contents">
                          <div className="min-w-0 text-base font-semibold text-zinc-900 dark:text-zinc-50 font-display">
                            <SpanishText
                              source={{
                                type: "course",
                                url: `/learn/${unit.slug}#phrases`,
                                courseRef: `unidad-${unit.number} / ${group.category} / 句型`,
                                sentence: item.es
                              }}
                              text={item.es}
                              translation={item.zh}
                            />
                          </div>
                          <div className="shrink-0 md:order-last md:justify-self-end">
                            <AudioButton label={item.es} src={item.audioSrc} />
                          </div>
                        </div>
                        <div className="text-sm leading-relaxed text-zinc-600 dark:text-zinc-400">{item.zh}</div>
                      </div>
                    ))}
                  </div>
                </section>
              ))}
            </div>
          </section>

          <section className="mt-7 md:mt-10" id="dialogues">
            <p className="text-xs font-semibold uppercase tracking-[0.2em] text-brand-600 dark:text-brand-400 font-display">Dialogues</p>
            <h2 className="mt-2 text-xl font-semibold text-zinc-900 dark:text-zinc-50 font-display md:text-2xl">对话</h2>
            <div className="mt-6 space-y-5 md:space-y-6">
              {content.dialogues.map((dialogue) => (
                <article className="rounded-hero border border-zinc-200/50 bg-white/70 glass-card p-4 shadow-sm dark:border-zinc-800/50 dark:bg-zinc-900/70 md:p-6" key={dialogue.title}>
                  <div className="flex flex-wrap items-center justify-between gap-4 border-b border-zinc-100 dark:border-zinc-800/50 pb-4 mb-4">
                    <div className="min-w-0">
                      <h3 className="text-xl font-semibold text-zinc-900 dark:text-zinc-50 font-display">{dialogue.title}</h3>
                      <p className="mt-1.5 text-sm leading-relaxed text-zinc-500 dark:text-zinc-400">{dialogue.scene}</p>
                    </div>
                    <button
                      className="shrink-0 rounded-full border border-brand-300 px-4 py-2.5 text-sm font-semibold text-brand-600 transition hover:bg-brand-50/50 active:scale-95 dark:border-brand-700 dark:text-brand-400 dark:hover:bg-brand-950/30 md:py-2 md:active:scale-100"
                      type="button"
                    >
                      播放全部
                    </button>
                  </div>
                  <div className="space-y-5 md:space-y-6">
                    {dialogue.lines.map((line, index) => (
                      <div className="rounded-surface bg-zinc-50 dark:bg-zinc-950/40 border border-zinc-100 dark:border-zinc-800/50 px-4 py-4" key={`${dialogue.title}-${index}`}>
                        <div className="flex items-start justify-between gap-3">
                          <div className="min-w-0">
                            <span
                              className={`inline-flex rounded-full px-3 py-1 text-xs font-semibold ${
                                line.speakerVariant === "a"
                                  ? "bg-brand-100 dark:bg-brand-950/60 text-brand-700 dark:text-brand-400"
                                  : "bg-zinc-100 dark:bg-zinc-800/60 text-zinc-600 dark:text-zinc-300"
                              }`}
                            >
                              {line.speaker}
                            </span>
                            <p className="mt-3 text-base font-semibold text-zinc-900 dark:text-zinc-50 font-display">
                              <SpanishText
                                source={{
                                  type: "course",
                                  url: `/learn/${unit.slug}#dialogues`,
                                  courseRef: `unidad-${unit.number} / ${dialogue.title} / 第${index + 1}行`,
                                  sentence: line.es
                                }}
                                text={line.es}
                                translation={line.zh}
                              />
                            </p>
                            <p className="mt-2 text-sm leading-relaxed text-zinc-600 dark:text-zinc-400">{line.zh}</p>
                          </div>
                          <AudioButton label={line.es} src={line.audioSrc} />
                        </div>
                      </div>
                    ))}
                  </div>
                </article>
              ))}
            </div>
          </section>

          <section className="mt-7 md:mt-10" id="grammar">
            <p className="text-xs font-semibold uppercase tracking-[0.2em] text-brand-600 dark:text-brand-400 font-display">Grammar</p>
            <h2 className="mt-2 text-xl font-semibold text-zinc-900 dark:text-zinc-50 font-display md:text-2xl">语法</h2>
            <div className="mt-6 space-y-5 md:space-y-6">
              {content.grammarCards.map((card) => (
                <article className="rounded-hero border border-zinc-200/50 bg-white/70 glass-card p-4 shadow-sm dark:border-zinc-800/50 dark:bg-zinc-900/70 md:p-6" key={card.verb}>
                  <h3 className="text-xl font-semibold text-zinc-900 dark:text-zinc-50 font-display md:text-2xl">
                    {card.verb}
                    <span className="ml-3 text-base font-medium text-zinc-500 dark:text-zinc-400 font-sans">{card.titleZh}</span>
                  </h3>
                  <p className="mt-3 max-w-3xl text-sm leading-relaxed text-zinc-600 dark:text-zinc-400 font-light">{card.lead}</p>
                  {card.tip ? (
                    <div className="mt-4 rounded-2xl border-l-4 border-brand-300 dark:border-brand-700 bg-brand-50/40 dark:bg-brand-950/20 p-4 text-sm leading-relaxed text-zinc-700 dark:text-zinc-300 border border-zinc-100/50 dark:border-zinc-800/20">
                      {card.tip}
                    </div>
                  ) : null}
                  <div className="mt-5 overflow-x-auto rounded-xl border border-zinc-200/50 dark:border-zinc-800/50 bg-zinc-50/50 dark:bg-zinc-950/20">
                    <table className="min-w-full text-left text-sm border-collapse">
                      <thead className="bg-zinc-100 dark:bg-zinc-800/60 text-zinc-600 dark:text-zinc-400">
                        <tr>
                          <th className="px-4 py-3 font-semibold font-display">人称</th>
                          <th className="px-4 py-3 font-semibold font-display">变位</th>
                          <th className="px-4 py-3 font-semibold font-display">例句</th>
                        </tr>
                      </thead>
                      <tbody>
                        {card.conjugation.map((row) => (
                          <tr className="border-b border-zinc-100 dark:border-zinc-800/50 hover:bg-zinc-50/50 dark:hover:bg-zinc-800/30 transition-colors" key={`${card.verb}-${row.pronoun}`}>
                            <td className="px-4 py-3 text-zinc-500 dark:text-zinc-400">{row.pronoun}</td>
                            <td className="px-4 py-3 font-semibold text-zinc-900 dark:text-zinc-100 font-display">{row.form}</td>
                            <td className="px-4 py-3 text-zinc-600 dark:text-zinc-400">{row.example ?? "—"}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </article>
              ))}
            </div>
          </section>

          <section className="mt-7 md:mt-10" id="compare">
            <p className="text-xs font-semibold uppercase tracking-[0.2em] text-zinc-500 dark:text-zinc-400 font-display">Compare</p>
            <h2 className="mt-2 text-xl font-semibold text-zinc-900 dark:text-zinc-50 font-display md:text-2xl">中西对比</h2>
            <div className="mt-6 grid gap-4">
              {content.compareCards.map((card) => (
                <article
                  className="rounded-hero border border-zinc-200/50 bg-zinc-50/70 p-4 text-sm leading-relaxed text-zinc-700 shadow-sm dark:border-zinc-800/50 dark:bg-zinc-900/40 dark:text-zinc-300 md:p-6"
                  key={card.title}
                >
                  <h3 className="text-lg font-bold text-zinc-900 dark:text-zinc-50 font-display">{card.title}</h3>
                  <div
                    className="mt-3 overflow-x-auto [&_table]:min-w-full [&_table]:border-collapse [&_td]:border-b [&_td]:border-zinc-200 dark:[&_td]:border-zinc-800 [&_td]:px-3 [&_td]:py-2 [&_th]:border-b [&_th]:border-zinc-200 dark:[&_th]:border-zinc-800 [&_th]:px-3 [&_th]:py-2 [&_th]:text-left dark:[&_th]:text-zinc-300 dark:[&_td]:text-zinc-400"
                    dangerouslySetInnerHTML={{ __html: card.body }}
                  />
                </article>
              ))}
            </div>
          </section>

          <section className="mt-7 md:mt-10" id="exercises">
            <p className="text-xs font-semibold uppercase tracking-[0.2em] text-brand-600 dark:text-brand-400 font-display">Practice</p>
            <h2 className="mt-2 text-xl font-semibold text-zinc-900 dark:text-zinc-50 font-display md:text-2xl">练习</h2>
            <div className="mt-6 space-y-4">
              {content.exercises.map((exercise) => (
                <details
                  className="group rounded-hero border border-zinc-200/50 bg-white/70 glass-card p-5 shadow-sm dark:border-zinc-800/50 dark:bg-zinc-900/70 md:p-6"
                  key={exercise.title}
                >
                  <summary className="cursor-pointer list-none text-lg font-semibold text-zinc-900 dark:text-zinc-50 font-display flex justify-between items-center">
                    <span>{exercise.title}</span>
                    <span className="text-zinc-400 group-open:rotate-180 transition-transform duration-200">↓</span>
                  </summary>
                  <div className="mt-4 space-y-3 text-sm leading-relaxed text-zinc-700 dark:text-zinc-300 border-t border-zinc-100 dark:border-zinc-800/80 pt-4">
                    {exercise.questions.map((question, index) => (
                      <p key={`${exercise.title}-${index}`}>
                        <span className="mr-2 font-semibold text-brand-600 dark:text-brand-400">{index + 1}.</span>
                        {question}
                      </p>
                    ))}
                  </div>
                  <div className="mt-5 rounded-2xl bg-brand-50/40 dark:bg-brand-950/20 p-4 text-sm leading-relaxed text-zinc-700 dark:text-zinc-300 border border-zinc-200/20 dark:border-zinc-800/20">
                    <p className="font-semibold text-brand-600 dark:text-brand-400">答案</p>
                    <div className="mt-2 space-y-2">
                      {exercise.answers.map((answer, index) => (
                        <p key={`${exercise.title}-answer-${index}`}>
                          <span className="mr-2 font-semibold text-brand-600 dark:text-brand-400">{index + 1}.</span>
                          {answer}
                        </p>
                      ))}
                    </div>
                  </div>
                </details>
              ))}
            </div>
          </section>

          <section className="mt-7 rounded-hero border border-zinc-200/50 bg-white/70 glass-card p-5 shadow-sm dark:border-zinc-800/50 dark:bg-zinc-900/70 md:mt-10 md:p-6">
            <p className="text-xs font-semibold uppercase tracking-[0.2em] text-brand-600 dark:text-brand-400 font-display">Video</p>
            <h2 className="mt-2 text-xl font-semibold text-zinc-900 dark:text-zinc-50 font-display md:text-2xl">本单元推荐视频</h2>
            <p className="mt-2 text-sm leading-relaxed text-zinc-500 dark:text-zinc-400">在真实西语对话中巩固本单元内容</p>
            <div className="mt-6 grid gap-5 md:grid-cols-[280px_1fr]">
              <div className="overflow-hidden rounded-surface bg-zinc-100 dark:bg-zinc-800 aspect-video relative">
                <img
                  alt={content.recommendedVideo.title}
                  className="h-full w-full object-cover"
                  src={`https://img.youtube.com/vi/${content.recommendedVideo.videoId}/hqdefault.jpg`}
                />
              </div>
              <div className="flex flex-col justify-between gap-4">
                <div>
                  <h3 className="text-xl font-semibold text-zinc-900 dark:text-zinc-50 font-display">{content.recommendedVideo.title}</h3>
                  <p className="mt-3 text-sm leading-relaxed text-zinc-500 dark:text-zinc-400 font-light">
                    {content.recommendedVideo.description}
                  </p>
                </div>
                <Link
                  className="inline-flex w-full items-center justify-center rounded-full bg-brand-500 px-6 py-3 text-sm font-semibold text-white shadow-lg shadow-brand-500/20 transition-all duration-300 hover:bg-brand-600 active:scale-[0.98] md:w-fit md:justify-start md:active:scale-100"
                  href={`/watch?v=${content.recommendedVideo.videoId}`}
                >
                  去观看 →
                </Link>
              </div>
            </div>
          </section>

          <section className="mt-7 flex flex-col gap-3 border-t border-zinc-200 pt-6 dark:border-zinc-800 md:mt-10 sm:flex-row sm:items-center sm:justify-between">
            {prevUnit ? (
              <Link
                className="w-full rounded-full border border-zinc-200 px-6 py-3 text-center text-sm font-semibold text-zinc-700 transition hover:bg-zinc-50 hover:border-brand-500 active:scale-[0.98] dark:border-zinc-800 dark:text-zinc-300 dark:hover:bg-zinc-800 sm:w-auto sm:active:scale-100"
                href={`/learn/${prevUnit.slug}`}
              >
                ← 上一个单元
              </Link>
            ) : (
              <span className="w-full rounded-full border border-zinc-100 px-6 py-3 text-center text-sm text-zinc-300 cursor-not-allowed dark:border-zinc-900 dark:text-zinc-700 sm:w-auto">
                ← 上一个单元
              </span>
            )}

            {nextUnit ? (
              <Link
                className="w-full rounded-full bg-zinc-900 px-6 py-3 text-center text-sm font-semibold text-white transition-all duration-300 hover:bg-zinc-800 active:scale-[0.98] dark:bg-zinc-100 dark:text-zinc-950 dark:hover:bg-zinc-200 sm:w-auto sm:active:scale-100"
                href={`/learn/${nextUnit.slug}`}
              >
                下一个单元 →
              </Link>
            ) : (
              <span className="w-full rounded-full bg-zinc-100 px-6 py-3 text-center text-sm text-zinc-400 cursor-not-allowed dark:bg-zinc-800 dark:text-zinc-500 sm:w-auto">
                下一个单元 →
              </span>
            )}
          </section>
        </div>
      </div>
    </main>
  );
}
