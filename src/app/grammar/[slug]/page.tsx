// Timestamp: 2026-05-27 08:45
import Link from "next/link";
import { notFound } from "next/navigation";
import { SpanishText } from "@/app/components/vocab/SpanishText";
import { BackLink } from "@/app/components/web/BackLink";
import { SiteHeader } from "@/app/components/web/SiteHeader";
import {
  getGrammarTopic,
  grammarGroups,
  grammarTopics
} from "../../../../content/grammar/topics";
import { GrammarTopicSelect } from "../GrammarTopicSelect";

type GrammarDetailPageProps = {
  params: {
    slug: string;
  };
};

export function generateStaticParams() {
  return grammarTopics.map((topic) => ({ slug: topic.slug }));
}

export default function GrammarDetailPage({ params }: GrammarDetailPageProps) {
  const topic = getGrammarTopic(params.slug);

  if (!topic) {
    notFound();
  }

  return (
    <main className="min-h-screen bg-app">
      <SiteHeader />
      <div className="mx-auto flex w-full max-w-5xl gap-8 px-4 py-8 sm:px-8">
        <aside className="hidden w-[220px] shrink-0 lg:block">
          <h2 className="mb-4 text-sm font-semibold text-zinc-900 dark:text-zinc-50 font-display">语法话题</h2>
          <nav className="space-y-6">
            {grammarGroups.map((group) => (
              <section key={group}>
                <h3 className="mb-2 text-xs font-semibold text-zinc-400 dark:text-zinc-500 uppercase tracking-wider">{group}</h3>
                <div className="space-y-1">
                  {grammarTopics
                    .filter((item) => item.group === group)
                    .map((item) => {
                      const active = item.slug === topic.slug;

                      return (
                        <Link
                          aria-current={active ? "page" : undefined}
                          className={[
                            "block py-1.5 pl-3 text-sm text-zinc-600 dark:text-zinc-400 hover:text-brand-600 dark:hover:text-brand-400 transition-colors",
                            active
                              ? "border-l-[3px] border-brand-500 font-semibold text-zinc-900 dark:text-zinc-50 bg-zinc-100/50 dark:bg-zinc-800/40 rounded-r"
                              : "border-l-[3px] border-transparent"
                          ].join(" ")}
                          href={`/grammar/${item.slug}`}
                          key={item.slug}
                        >
                          {item.title}
                        </Link>
                      );
                    })}
                </div>
              </section>
            ))}
          </nav>
        </aside>

        <article className="w-full max-w-2xl">
          <div className="mb-6 lg:hidden">
            <label className="mb-2 block text-sm font-semibold text-zinc-900 dark:text-zinc-200" htmlFor="grammar-topic">
              语法话题
            </label>
            <GrammarTopicSelect currentSlug={topic.slug} topics={grammarTopics} />
          </div>

          <BackLink href="/grammar" label="语法" />

          <header className="mt-5 mb-6">
            <p className="text-sm font-medium text-zinc-400 dark:text-zinc-500 uppercase tracking-wider">{topic.group}</p>
            <h1 className="mt-2 text-3xl font-bold font-display text-zinc-900 dark:text-zinc-50 tracking-tight">{topic.title}</h1>
            <p className="mt-3 text-base leading-relaxed text-zinc-500 dark:text-zinc-400 font-light">{topic.intro}</p>
          </header>

          <section className="mt-6 border-l-[3px] border-brand-200 bg-brand-50/40 dark:bg-brand-950/20 p-4 rounded-r-lg border border-zinc-200/20 dark:border-zinc-800/20">
            <h2 className="text-xs font-semibold uppercase tracking-wider text-brand-700 dark:text-brand-400 font-display">中文类比</h2>
            <p className="mt-2 text-sm leading-relaxed text-zinc-700 dark:text-zinc-300">{topic.analogy}</p>
          </section>

          {topic.conjugations ? (
            <section className="mt-8">
              <h2 className="mb-4 text-xl font-semibold font-display text-zinc-800 dark:text-zinc-200">现在时变位表</h2>
              <div className="overflow-x-auto rounded-xl border border-zinc-200/50 dark:border-zinc-800/50 bg-white/70 dark:bg-zinc-900/70 glass-card shadow-sm">
                <table className="w-full min-w-[560px] border-collapse text-left">
                  <thead className="bg-gray-50 dark:bg-zinc-800/50">
                    <tr className="border-b border-gray-100 dark:border-zinc-800/80">
                      <th className="sticky left-0 bg-gray-50 dark:bg-zinc-800/50 px-4 py-3 text-sm font-semibold text-zinc-700 dark:text-zinc-300 font-display">
                        人称代词
                      </th>
                      <th className="px-4 py-3 text-sm font-semibold text-zinc-700 dark:text-zinc-300 font-display">人称说明</th>
                      <th className="px-4 py-3 text-sm font-semibold text-zinc-700 dark:text-zinc-300 font-display">变位形式</th>
                      <th className="px-4 py-3 text-sm font-semibold text-zinc-700 dark:text-zinc-300 font-display">音频</th>
                    </tr>
                  </thead>
                  <tbody>
                    {topic.conjugations.map((row) => (
                      <tr className="border-b border-gray-100 dark:border-zinc-800/80 hover:bg-zinc-50/50 dark:hover:bg-zinc-800/30 transition-colors" key={row.pronoun}>
                        <td className="sticky left-0 bg-white dark:bg-zinc-900 px-4 py-4 text-sm text-zinc-600 dark:text-zinc-400">
                          <SpanishText
                            enablePhrases={true}
                            enableKeyboard={true}
                            interactionDensity="dense"
                            source={{
                              type: "grammar",
                              url: `/grammar/${topic.slug}`,
                              topicSlug: topic.slug,
                              sentence: row.pronoun
                            }}
                            text={row.pronoun}
                            translation={row.person}
                          />
                        </td>
                        <td className="px-4 py-4 text-sm text-zinc-600 dark:text-zinc-400">{row.person}</td>
                        <td className="px-4 py-4 text-base font-semibold text-zinc-900 dark:text-zinc-100 font-display">
                          <SpanishText
                            enablePhrases={true}
                            enableKeyboard={true}
                            interactionDensity="dense"
                            source={{
                              type: "grammar",
                              url: `/grammar/${topic.slug}`,
                              topicSlug: topic.slug,
                              sentence: row.form
                            }}
                            text={row.form}
                            translation={row.person}
                          />
                        </td>
                        <td className="px-4 py-4 text-sm text-zinc-400 dark:text-zinc-500">{row.audioLabel ?? "—"}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </section>
          ) : null}

          {topic.rules ? (
            <section className="mt-8">
              <h2 className="mb-4 text-xl font-semibold font-display text-zinc-800 dark:text-zinc-200">判断规则</h2>
              <div className="space-y-3">
                {topic.rules.map((rule) => (
                  <p className="rounded-xl border border-gray-100 dark:border-zinc-800 bg-white/70 dark:bg-zinc-900/70 glass-card p-4 text-sm leading-relaxed text-zinc-700 dark:text-zinc-300 shadow-sm" key={rule}>
                    {rule}
                  </p>
                ))}
              </div>
            </section>
          ) : null}

          {topic.comparison ? (
            <section className="mt-8">
              <h2 className="mb-4 text-xl font-semibold font-display text-zinc-800 dark:text-zinc-200">ser / estar 对比</h2>
              <div className="grid gap-4 sm:grid-cols-2">
                <ComparisonColumn
                  items={topic.comparison.ser}
                  title="ser：身份、本质、来源"
                  topicSlug={topic.slug}
                />
                <ComparisonColumn
                  items={topic.comparison.estar}
                  title="estar：状态、位置、结果"
                  topicSlug={topic.slug}
                />
              </div>
            </section>
          ) : null}

          {topic.examples ? (
            <section className="mt-8">
              <h2 className="mb-4 text-xl font-semibold font-display text-zinc-800 dark:text-zinc-200">例句</h2>
              <div className="space-y-4">
                {topic.examples.map((example) => (
                  <div className="rounded-xl border border-gray-100 dark:border-zinc-800 bg-white/70 dark:bg-zinc-900/70 glass-card p-5 shadow-sm" key={example.spanish}>
                    <SpanishText
                      enablePhrases={true}
                      className="text-base font-bold text-zinc-900 dark:text-zinc-50 font-display"
                      enableKeyboard={true}
                      source={{
                        type: "grammar",
                        url: `/grammar/${topic.slug}`,
                        topicSlug: topic.slug,
                        sentence: example.spanish
                      }}
                      text={example.spanish}
                      translation={example.chinese}
                    />
                    <p className="mt-1.5 text-sm text-zinc-500 dark:text-zinc-400">{example.chinese}</p>
                    <p className="mt-2 text-xs text-zinc-400 dark:text-zinc-500 font-light">因为：{example.reason}</p>
                  </div>
                ))}
              </div>
            </section>
          ) : null}

          {topic.related ? (
            <section className="mt-8 space-y-2">
              {topic.related.map((item) => (
                <Link
                  className="inline-flex text-xs font-semibold text-brand-500 hover:text-brand-600 dark:hover:text-brand-400 hover:underline mr-4"
                  href={`/grammar/${item.slug}`}
                  key={item.slug}
                >
                  {item.label} →
                </Link>
              ))}
            </section>
          ) : null}
        </article>
      </div>
    </main>
  );
}

function ComparisonColumn({
  title,
  items,
  topicSlug
}: {
  title: string;
  items: Array<{ spanish: string; chinese: string; reason: string }>;
  topicSlug: string;
}) {
  return (
    <div className="rounded-xl border border-gray-100 dark:border-zinc-800 bg-white/70 dark:bg-zinc-900/70 glass-card p-5 shadow-sm">
      <h3 className="text-sm font-bold text-zinc-900 dark:text-zinc-50 font-display border-b border-zinc-100 dark:border-zinc-800 pb-3 mb-4">{title}</h3>
      <div className="space-y-4">
        {items.map((item) => (
          <div className="border-b border-zinc-100 dark:border-zinc-800/50 pb-3 last:border-b-0 last:pb-0" key={item.spanish}>
            <SpanishText
              enablePhrases={true}
              className="text-base font-bold text-zinc-900 dark:text-zinc-50 font-display"
              enableKeyboard={true}
              source={{
                type: "grammar",
                url: `/grammar/${topicSlug}`,
                topicSlug,
                sentence: item.spanish
              }}
              text={item.spanish}
              translation={item.chinese}
            />
            <p className="mt-1 text-sm text-zinc-500 dark:text-zinc-400">{item.chinese}</p>
            <p className="mt-2 text-xs leading-relaxed text-zinc-400 dark:text-zinc-500 font-light">因为：{item.reason}</p>
          </div>
        ))}
      </div>
    </div>
  );
}


