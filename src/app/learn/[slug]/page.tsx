import Link from "next/link";
import { notFound } from "next/navigation";
import AudioButton from "@/app/components/audio/AudioButton";
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
    <main className="min-h-screen bg-[#f4f7f1] text-gray-900">
      <SiteHeader />
      <div className="mx-auto flex max-w-screen-xl gap-8 px-4 py-8 sm:px-6 lg:px-8">
        <aside className="sticky top-24 hidden h-fit w-56 shrink-0 rounded-[24px] border border-emerald-100 bg-white p-5 shadow-[0_8px_30px_rgba(15,23,42,0.06)] lg:block">
          <p className="text-xs font-semibold uppercase tracking-[0.22em] text-emerald-600">
            Unidad {unit.number}
          </p>
          <nav className="mt-4 space-y-1 text-sm text-gray-600">
            {sectionAnchors.map((section) => (
              <a
                className="flex items-center rounded-xl border-l-2 border-transparent px-3 py-2 transition hover:border-emerald-400 hover:bg-emerald-50 hover:text-emerald-700"
                href={`#${section.id}`}
                key={section.id}
              >
                {section.label}
              </a>
            ))}
          </nav>
        </aside>

        <div className="min-w-0 flex-1">
          <section className="overflow-hidden rounded-[28px] bg-gradient-to-br from-emerald-600 via-emerald-500 to-lime-400 px-6 py-8 text-white shadow-[0_24px_70px_rgba(16,185,129,0.24)] sm:px-8">
            <div className="flex flex-wrap items-start justify-between gap-4">
              <div className="max-w-2xl">
                <div className="flex items-center gap-3">
                  <span className="rounded-full bg-white/16 px-3 py-1 text-xs font-semibold uppercase tracking-[0.18em] text-emerald-50">
                    {unit.level}
                  </span>
                  <span className="text-sm text-emerald-50">Unidad {unit.number}</span>
                </div>
                <h1 className="mt-4 text-3xl font-semibold sm:text-4xl">{unit.title}</h1>
                <p className="mt-2 text-lg text-emerald-50">{unit.titleEs}</p>
              </div>

              <div className="grid min-w-[220px] grid-cols-1 gap-3 rounded-[24px] bg-white/14 p-4 text-sm text-emerald-50 backdrop-blur sm:grid-cols-3">
                <div>
                  <div className="text-xl font-semibold text-white">{unit.durationMin} min</div>
                  <div>时长</div>
                </div>
                <div>
                  <div className="text-xl font-semibold text-white">{content.vocabGroups.length}</div>
                  <div>词汇组</div>
                </div>
                <div>
                  <div className="text-xl font-semibold text-white">Audio</div>
                  <div>跟读</div>
                </div>
              </div>
            </div>
          </section>

          <section className="mt-8 rounded-[24px] border border-emerald-100 bg-white p-6 shadow-[0_8px_30px_rgba(15,23,42,0.05)]" id="goals">
            <p className="text-xs font-semibold uppercase tracking-[0.2em] text-emerald-600">Goals</p>
            <h2 className="mt-2 text-2xl font-semibold text-gray-900">学习目标</h2>
            <div className="mt-6 grid gap-3 sm:grid-cols-2">
              {unit.communicativeGoals.map((goal) => (
                <div
                  className="flex items-start gap-3 rounded-2xl bg-emerald-50/70 px-4 py-3 text-sm leading-6 text-gray-700"
                  key={goal}
                >
                  <span className="mt-0.5 flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-white text-xs text-emerald-600">
                    ✓
                  </span>
                  <span>{goal}</span>
                </div>
              ))}
            </div>
          </section>

          <section className="mt-8" id="vocab">
            <p className="text-xs font-semibold uppercase tracking-[0.2em] text-emerald-600">Vocabulary</p>
            <h2 className="mt-2 text-2xl font-semibold text-gray-900">核心词汇</h2>
            <div className="mt-6 space-y-8">
              {content.vocabGroups.map((group) => (
                <section key={group.title}>
                  <h3 className="text-lg font-semibold text-gray-900">{group.title}</h3>
                  <div className="mt-4 grid gap-4 md:grid-cols-2 xl:grid-cols-3">
                    {group.items.map((item) => (
                      <article
                        className="rounded-[22px] border border-gray-100 bg-white p-4 shadow-[0_8px_24px_rgba(15,23,42,0.04)]"
                        key={`${group.title}-${item.es}`}
                      >
                        <div className="flex items-start justify-between gap-3">
                          <div>
                            <h4 className="text-lg font-semibold text-gray-900">{item.es}</h4>
                            <p className="mt-1 text-sm text-gray-500">{item.zh}</p>
                          </div>
                          <AudioButton label={item.es} src={item.audioSrc} />
                        </div>
                        {item.note ? <p className="mt-3 text-sm leading-6 text-gray-600">{item.note}</p> : null}
                      </article>
                    ))}
                  </div>
                </section>
              ))}
            </div>
          </section>

          <section className="mt-10" id="phrases">
            <p className="text-xs font-semibold uppercase tracking-[0.2em] text-emerald-600">Phrases</p>
            <h2 className="mt-2 text-2xl font-semibold text-gray-900">句型</h2>
            <div className="mt-6 space-y-6">
              {content.phrases.map((group) => (
                <section className="rounded-[24px] border border-gray-100 bg-white p-5" key={group.category}>
                  <h3 className="text-lg font-semibold text-gray-900">{group.category}</h3>
                  <div className="mt-4 divide-y divide-gray-100">
                    {group.items.map((item) => (
                      <div className="grid gap-3 py-4 md:grid-cols-[1.1fr_1fr_auto]" key={`${group.category}-${item.es}`}>
                        <div className="text-base font-medium text-gray-900">{item.es}</div>
                        <div className="text-sm leading-6 text-gray-600">{item.zh}</div>
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
            <p className="text-xs font-semibold uppercase tracking-[0.2em] text-emerald-600">Dialogues</p>
            <h2 className="mt-2 text-2xl font-semibold text-gray-900">对话</h2>
            <div className="mt-6 space-y-6">
              {content.dialogues.map((dialogue) => (
                <article className="rounded-[24px] border border-gray-100 bg-white p-6" key={dialogue.title}>
                  <div className="flex flex-wrap items-center justify-between gap-4">
                    <div>
                      <h3 className="text-xl font-semibold text-gray-900">{dialogue.title}</h3>
                      <p className="mt-2 text-sm leading-6 text-gray-500">{dialogue.scene}</p>
                    </div>
                    <button
                      className="rounded-full border border-emerald-200 px-4 py-2 text-sm font-medium text-emerald-700 transition hover:bg-emerald-50"
                      type="button"
                    >
                      播放全部
                    </button>
                  </div>
                  <div className="mt-5 space-y-4">
                    {dialogue.lines.map((line, index) => (
                      <div className="rounded-[20px] bg-gray-50 px-4 py-4" key={`${dialogue.title}-${index}`}>
                        <div className="flex items-start justify-between gap-3">
                          <div className="min-w-0">
                            <span
                              className={`inline-flex rounded-full px-3 py-1 text-xs font-semibold ${
                                line.speakerVariant === "a"
                                  ? "bg-emerald-100 text-emerald-700"
                                  : "bg-sky-100 text-sky-700"
                              }`}
                            >
                              {line.speaker}
                            </span>
                            <p className="mt-3 text-base font-medium text-gray-900">{line.es}</p>
                            <p className="mt-2 text-sm leading-6 text-gray-600">{line.zh}</p>
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
            <p className="text-xs font-semibold uppercase tracking-[0.2em] text-emerald-600">Grammar</p>
            <h2 className="mt-2 text-2xl font-semibold text-gray-900">语法</h2>
            <div className="mt-6 space-y-6">
              {content.grammarCards.map((card) => (
                <article className="rounded-[24px] border border-gray-100 bg-white p-6" key={card.verb}>
                  <h3 className="text-2xl font-semibold text-gray-900">
                    {card.verb}
                    <span className="ml-3 text-base font-medium text-gray-500">{card.titleZh}</span>
                  </h3>
                  <p className="mt-3 max-w-3xl text-sm leading-7 text-gray-600">{card.lead}</p>
                  {card.tip ? (
                    <div className="mt-4 rounded-2xl border-l-4 border-emerald-200 bg-emerald-50/70 px-4 py-3 text-sm leading-6 text-gray-700">
                      {card.tip}
                    </div>
                  ) : null}
                  <div className="mt-5 overflow-x-auto">
                    <table className="min-w-full text-left text-sm">
                      <thead className="bg-gray-50 text-gray-500">
                        <tr>
                          <th className="px-4 py-3 font-medium">人称</th>
                          <th className="px-4 py-3 font-medium">变位</th>
                          <th className="px-4 py-3 font-medium">例句</th>
                        </tr>
                      </thead>
                      <tbody>
                        {card.conjugation.map((row) => (
                          <tr className="border-b border-gray-100" key={`${card.verb}-${row.pronoun}`}>
                            <td className="px-4 py-3 text-gray-500">{row.pronoun}</td>
                            <td className="px-4 py-3 font-medium text-gray-900">{row.form}</td>
                            <td className="px-4 py-3 text-gray-600">{row.example ?? "—"}</td>
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
            <p className="text-xs font-semibold uppercase tracking-[0.2em] text-sky-700">Compare</p>
            <h2 className="mt-2 text-2xl font-semibold text-gray-900">中西对比</h2>
            <div className="mt-6 grid gap-4">
              {content.compareCards.map((card) => (
                <article
                  className="rounded-[24px] border border-sky-100 bg-sky-50/80 p-6 text-sm leading-7 text-gray-700"
                  key={card.title}
                >
                  <h3 className="text-lg font-semibold text-gray-900">{card.title}</h3>
                  <div
                    className="mt-3 overflow-x-auto [&_table]:min-w-full [&_table]:border-collapse [&_td]:border-b [&_td]:border-sky-100 [&_td]:px-3 [&_td]:py-2 [&_th]:border-b [&_th]:border-sky-100 [&_th]:px-3 [&_th]:py-2 [&_th]:text-left"
                    dangerouslySetInnerHTML={{ __html: card.body }}
                  />
                </article>
              ))}
            </div>
          </section>

          <section className="mt-10" id="exercises">
            <p className="text-xs font-semibold uppercase tracking-[0.2em] text-emerald-600">Practice</p>
            <h2 className="mt-2 text-2xl font-semibold text-gray-900">练习</h2>
            <div className="mt-6 space-y-4">
              {content.exercises.map((exercise) => (
                <details
                  className="rounded-[24px] border border-gray-100 bg-white p-5 shadow-[0_8px_24px_rgba(15,23,42,0.04)]"
                  key={exercise.title}
                >
                  <summary className="cursor-pointer list-none text-lg font-semibold text-gray-900">
                    {exercise.title}
                  </summary>
                  <div className="mt-4 space-y-3 text-sm leading-7 text-gray-700">
                    {exercise.questions.map((question, index) => (
                      <p key={`${exercise.title}-${index}`}>
                        <span className="mr-2 font-medium text-emerald-700">{index + 1}.</span>
                        {question}
                      </p>
                    ))}
                  </div>
                  <div className="mt-5 rounded-2xl bg-emerald-50/70 p-4 text-sm leading-7 text-gray-700">
                    <p className="font-semibold text-emerald-700">答案</p>
                    <div className="mt-2 space-y-2">
                      {exercise.answers.map((answer, index) => (
                        <p key={`${exercise.title}-answer-${index}`}>
                          <span className="mr-2 font-medium text-emerald-700">{index + 1}.</span>
                          {answer}
                        </p>
                      ))}
                    </div>
                  </div>
                </details>
              ))}
            </div>
          </section>

          <section className="mt-10 rounded-[24px] border border-gray-100 bg-white p-6 shadow-[0_8px_24px_rgba(15,23,42,0.04)]">
            <p className="text-xs font-semibold uppercase tracking-[0.2em] text-emerald-600">Video</p>
            <h2 className="mt-2 text-2xl font-semibold text-gray-900">本单元推荐视频</h2>
            <p className="mt-2 text-sm leading-7 text-gray-600">在真实西语对话中巩固本单元内容</p>
            <div className="mt-6 grid gap-5 md:grid-cols-[280px_1fr]">
              <div className="overflow-hidden rounded-[22px] bg-gray-100">
                <img
                  alt={content.recommendedVideo.title}
                  className="h-full w-full object-cover"
                  src={`https://img.youtube.com/vi/${content.recommendedVideo.videoId}/hqdefault.jpg`}
                />
              </div>
              <div className="flex flex-col justify-between gap-4">
                <div>
                  <h3 className="text-xl font-semibold text-gray-900">{content.recommendedVideo.title}</h3>
                  <p className="mt-3 text-sm leading-7 text-gray-600">
                    {content.recommendedVideo.description}
                  </p>
                </div>
                <Link
                  className="inline-flex w-fit items-center rounded-full bg-emerald-600 px-5 py-3 text-sm font-medium text-white transition hover:bg-emerald-700"
                  href={`/watch?v=${content.recommendedVideo.videoId}`}
                >
                  去观看 →
                </Link>
              </div>
            </div>
          </section>

          <section className="mt-10 flex flex-col gap-3 border-t border-gray-200 pt-6 sm:flex-row sm:items-center sm:justify-between">
            {prevUnit ? (
              <Link
                className="rounded-full border border-gray-200 px-5 py-3 text-sm font-medium text-gray-700 transition hover:border-emerald-300 hover:text-emerald-700"
                href={`/learn/${prevUnit.slug}`}
              >
                ← 上一个单元
              </Link>
            ) : (
              <span className="rounded-full border border-gray-100 px-5 py-3 text-sm text-gray-300">
                ← 上一个单元
              </span>
            )}

            {nextUnit ? (
              <Link
                className="rounded-full bg-gray-900 px-5 py-3 text-sm font-medium text-white transition hover:bg-gray-800"
                href={`/learn/${nextUnit.slug}`}
              >
                下一个单元 →
              </Link>
            ) : (
              <span className="rounded-full bg-gray-100 px-5 py-3 text-sm text-gray-400">
                下一个单元 →
              </span>
            )}
          </section>
        </div>
      </div>
    </main>
  );
}
