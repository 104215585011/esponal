// Timestamp: 2026-05-26 16:01
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
      <div className="mx-auto flex max-w-app-shell gap-8 px-4 py-8 sm:px-6 lg:px-8">
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

          <section className="overflow-hidden rounded-hero bg-gradient-to-br from-brand-600 via-brand-500 to-brand-400 px-6 py-8 text-white shadow-hero sm:px-8">
            <div className="flex flex-wrap items-start justify-between gap-4">
              <div className="max-w-2xl">
                <div className="flex items-center gap-3">
                  <span className="rounded-full bg-white/10 px-3 py-1 text-xs font-semibold uppercase tracking-[0.18em] text-brand-50 font-display">
                    {unit.level}
                  </span>
                  <span className="text-sm text-brand-50">Unidad {unit.number}</span>
                </div>
                <h1 className="mt-4 text-3xl font-semibold sm:text-4xl font-display tracking-tight leading-tight">{unit.title}</h1>
                <p className="mt-2 text-lg text-brand-50 font-light">{unit.titleEs}</p>
              </div>

              <div className="grid min-w-[220px] grid-cols-1 gap-3 rounded-hero bg-white/10 dark:bg-black/20 p-4 text-sm text-brand-50 backdrop-blur sm:grid-cols-3">
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

          <section className="mt-8 rounded-hero border border-zinc-200/50 dark:border-zinc-800/50 bg-white/70 dark:bg-zinc-900/70 p-6 shadow-sm glass-card" id="goals">
            <p className="text-xs font-semibold uppercase tracking-[0.2em] text-brand-600 dark:text-brand-400 font-display">Goals</p>
            <h2 className="mt-2 text-2xl font-semibold text-zinc-900 dark:text-zinc-50 font-display">学习目标</h2>
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

          <section className="mt-8" id="vocab">
            <p className="text-xs font-semibold uppercase tracking-[0.2em] text-brand-600 dark:text-brand-400 font-display">Vocabulary</p>
            <h2 className="mt-2 text-2xl font-semibold text-zinc-900 dark:text-zinc-50 font-display">核心词汇</h2>
            <div className="mt-6 space-y-8">
              {content.vocabGroups.map((group) => (
                <section key={group.title}>
                  <h3 className="text-lg font-semibold text-zinc-900 dark:text-zinc-100 font-display">{group.title}</h3>
                  <div className="mt-4 grid gap-4 md:grid-cols-2 xl:grid-cols-3">
                    {group.items.map((item) => (
                      <article
                        className="group rounded-surface border border-zinc-200/50 dark:border-zinc-800/50 bg-white/70 dark:bg-zinc-900/70 p-5 glass-card card-hover-lift shadow-sm"
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

          <section className="mt-10" id="phrases">
            <p className="text-xs font-semibold uppercase tracking-[0.2em] text-brand-600 dark:text-brand-400 font-display">Phrases</p>
            <h2 className="mt-2 text-2xl font-semibold text-zinc-900 dark:text-zinc-50 font-display">句型</h2>
            <div className="mt-6 space-y-6">
              {content.phrases.map((group) => (
                <section className="rounded-hero border border-zinc-200/50 dark:border-zinc-800/50 bg-white/70 dark:bg-zinc-900/70 p-6 glass-card shadow-sm" key={group.category}>
                  <h3 className="text-lg font-semibold text-zinc-900 dark:text-zinc-50 font-display border-b border-zinc-100 dark:border-zinc-800/50 pb-3 mb-4">{group.category}</h3>
                  <div className="divide-y divide-zinc-100 dark:divide-zinc-800/60">
                    {group.items.map((item) => (
                      <div className="grid gap-3 py-4 md:grid-cols-[1.1fr_1fr_auto]" key={`${group.category}-${item.es}`}>
                        <div className="text-base font-semibold text-zinc-900 dark:text-zinc-50 font-display">
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
                        <div className="text-sm leading-relaxed text-zinc-600 dark:text-zinc-400">{item.zh}</div>
                        <div className="md:justify-self-end">
                          <AudioButton label={item.es} src={item.audioSrc} />
                        </div>
                      </div>
                    ))}
                  </div>
                </section>
              ))}
            </div>
          </section>

          <section className="mt-10" id="dialogues">
            <p className="text-xs font-semibold uppercase tracking-[0.2em] text-brand-600 dark:text-brand-400 font-display">Dialogues</p>
            <h2 className="mt-2 text-2xl font-semibold text-zinc-900 dark:text-zinc-50 font-display">对话</h2>
            <div className="mt-6 space-y-6">
              {content.dialogues.map((dialogue) => (
                <article className="rounded-hero border border-zinc-200/50 dark:border-zinc-800/50 bg-white/70 dark:bg-zinc-900/70 glass-card p-6 shadow-sm" key={dialogue.title}>
                  <div className="flex flex-wrap items-center justify-between gap-4 border-b border-zinc-100 dark:border-zinc-800/50 pb-4 mb-4">
                    <div>
                      <h3 className="text-xl font-semibold text-zinc-900 dark:text-zinc-50 font-display">{dialogue.title}</h3>
                      <p className="mt-1.5 text-sm leading-relaxed text-zinc-500 dark:text-zinc-400">{dialogue.scene}</p>
                    </div>
                    <button
                      className="rounded-full border border-brand-300 dark:border-brand-700 px-4 py-2 text-sm font-semibold text-brand-600 dark:text-brand-400 transition hover:bg-brand-50/50 dark:hover:bg-brand-950/30"
                      type="button"
                    >
                      播放全部
                    </button>
                  </div>
                  <div className="space-y-4">
                    {dialogue.lines.map((line, index) => (
                      <div className="rounded-surface bg-zinc-50 dark:bg-zinc-950/40 border border-zinc-100 dark:border-zinc-800/50 px-4 py-4" key={`${dialogue.title}-${index}`}>
                        <div className="flex items-start justify-between gap-3">
                          <div className="min-w-0">
                            <span
                              className={`inline-flex rounded-full px-3 py-1 text-xs font-semibold ${
                                line.speakerVariant === "a"
                                  ? "bg-brand-100 dark:bg-brand-950/60 text-brand-700 dark:text-brand-400"
                                  : "bg-sky-100 dark:bg-sky-950/60 text-sky-700 dark:text-sky-400"
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

          <section className="mt-10" id="grammar">
            <p className="text-xs font-semibold uppercase tracking-[0.2em] text-brand-600 dark:text-brand-400 font-display">Grammar</p>
            <h2 className="mt-2 text-2xl font-semibold text-zinc-900 dark:text-zinc-50 font-display">语法</h2>
            <div className="mt-6 space-y-6">
              {content.grammarCards.map((card) => (
                <article className="rounded-hero border border-zinc-200/50 dark:border-zinc-800/50 bg-white/70 dark:bg-zinc-900/70 glass-card p-6 shadow-sm" key={card.verb}>
                  <h3 className="text-2xl font-semibold text-zinc-900 dark:text-zinc-50 font-display">
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

          <section className="mt-10" id="compare">
            <p className="text-xs font-semibold uppercase tracking-[0.2em] text-sky-700 dark:text-sky-400 font-display">Compare</p>
            <h2 className="mt-2 text-2xl font-semibold text-zinc-900 dark:text-zinc-50 font-display">中西对比</h2>
            <div className="mt-6 grid gap-4">
              {content.compareCards.map((card) => (
                <article
                  className="rounded-hero border border-sky-100 bg-sky-50/80 dark:bg-sky-950/20 p-6 text-sm leading-relaxed text-zinc-700 dark:text-zinc-300 shadow-sm"
                  key={card.title}
                >
                  <h3 className="text-lg font-bold text-zinc-900 dark:text-zinc-50 font-display">{card.title}</h3>
                  <div
                    className="mt-3 overflow-x-auto [&_table]:min-w-full [&_table]:border-collapse [&_td]:border-b [&_td]:border-sky-100 dark:[&_td]:border-sky-950 [&_td]:px-3 [&_td]:py-2 [&_th]:border-b [&_th]:border-sky-100 dark:[&_th]:border-sky-950 [&_th]:px-3 [&_th]:py-2 [&_th]:text-left dark:[&_th]:text-zinc-300 dark:[&_td]:text-zinc-400"
                    dangerouslySetInnerHTML={{ __html: card.body }}
                  />
                </article>
              ))}
            </div>
          </section>

          <section className="mt-10" id="exercises">
            <p className="text-xs font-semibold uppercase tracking-[0.2em] text-brand-600 dark:text-brand-400 font-display">Practice</p>
            <h2 className="mt-2 text-2xl font-semibold text-zinc-900 dark:text-zinc-50 font-display">练习</h2>
            <div className="mt-6 space-y-4">
              {content.exercises.map((exercise) => (
                <details
                  className="group rounded-hero border border-zinc-200/50 dark:border-zinc-800/50 bg-white/70 dark:bg-zinc-900/70 glass-card p-6 shadow-sm"
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

          <section className="mt-10 rounded-hero border border-zinc-200/50 dark:border-zinc-800/50 bg-white/70 dark:bg-zinc-900/70 glass-card p-6 shadow-sm">
            <p className="text-xs font-semibold uppercase tracking-[0.2em] text-brand-600 dark:text-brand-400 font-display">Video</p>
            <h2 className="mt-2 text-2xl font-semibold text-zinc-900 dark:text-zinc-50 font-display">本单元推荐视频</h2>
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
                  className="inline-flex w-fit items-center rounded-full bg-brand-500 hover:bg-brand-600 px-6 py-3 text-sm font-semibold text-white shadow-lg shadow-brand-500/20 transition-all duration-300"
                  href={`/watch?v=${content.recommendedVideo.videoId}`}
                >
                  去观看 →
                </Link>
              </div>
            </div>
          </section>

          <section className="mt-10 flex flex-col gap-3 border-t border-zinc-200 dark:border-zinc-800 pt-6 sm:flex-row sm:items-center sm:justify-between">
            {prevUnit ? (
              <Link
                className="rounded-full border border-zinc-200 dark:border-zinc-800 px-6 py-3 text-sm font-semibold text-zinc-700 dark:text-zinc-300 transition hover:bg-zinc-50 dark:hover:bg-zinc-800 hover:border-brand-500"
                href={`/learn/${prevUnit.slug}`}
              >
                ← 上一个单元
              </Link>
            ) : (
              <span className="rounded-full border border-zinc-100 dark:border-zinc-900 px-6 py-3 text-sm text-zinc-300 dark:text-zinc-700 cursor-not-allowed">
                ← 上一个单元
              </span>
            )}

            {nextUnit ? (
              <Link
                className="rounded-full bg-zinc-900 dark:bg-zinc-100 hover:bg-zinc-800 dark:hover:bg-zinc-200 px-6 py-3 text-sm font-semibold text-white dark:text-zinc-950 transition-all duration-300"
                href={`/learn/${nextUnit.slug}`}
              >
                下一个单元 →
              </Link>
            ) : (
              <span className="rounded-full bg-zinc-100 dark:bg-zinc-800 px-6 py-3 text-sm text-zinc-400 dark:text-zinc-500 cursor-not-allowed">
                下一个单元 →
              </span>
            )}
          </section>
        </div>
      </div>
    </main>
  );
}
