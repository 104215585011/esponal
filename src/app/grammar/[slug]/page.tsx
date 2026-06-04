// Timestamp: 2026-06-04 15:02
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
      <div className="mx-auto flex w-full max-w-5xl gap-8 px-4 pt-5 pb-[calc(3.5rem+env(safe-area-inset-bottom)+16px)] sm:px-8 md:py-8">
        <aside className="hidden w-[220px] shrink-0 lg:block">
          <h2 className="mb-4 font-display text-sm font-semibold text-zinc-900 dark:text-zinc-50">语法话题</h2>
          <nav className="space-y-6">
            {grammarGroups.map((group) => (
              <section key={group}>
                <h3 className="mb-2 text-xs font-semibold uppercase tracking-wider text-zinc-400 dark:text-zinc-500">
                  {group}
                </h3>
                <div className="space-y-1">
                  {grammarTopics
                    .filter((item) => item.group === group)
                    .map((item) => {
                      const active = item.slug === topic.slug;

                      return (
                        <Link
                          aria-current={active ? "page" : undefined}
                          className={[
                            "block border-l-[3px] py-1.5 pl-3 text-sm transition-colors",
                            active
                              ? "rounded-r border-brand-500 bg-zinc-100/50 font-semibold text-zinc-900 dark:bg-zinc-800/40 dark:text-zinc-50"
                              : "border-transparent text-zinc-600 hover:text-brand-600 dark:text-zinc-400 dark:hover:text-brand-400"
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
          <div className="mb-5 md:mb-6 lg:hidden">
            <label className="mb-2 block text-sm font-semibold text-zinc-900 dark:text-zinc-200" htmlFor="grammar-topic">
              语法话题
            </label>
            <GrammarTopicSelect currentSlug={topic.slug} topics={grammarTopics} />
          </div>

          <BackLink href="/grammar" label="语法" />

          <header className="mt-4 mb-6 md:mt-5">
            <p className="text-sm font-medium uppercase tracking-wider text-zinc-400 dark:text-zinc-500">{topic.group}</p>
            <h1 className="mt-2 text-2xl leading-snug md:text-3xl font-display font-bold tracking-tight text-zinc-900 dark:text-zinc-50">
              {topic.title}
            </h1>
            <p className="mt-3 line-clamp-3 text-base font-light leading-relaxed text-zinc-500 dark:text-zinc-400 md:line-clamp-none">
              {topic.intro}
            </p>
          </header>

          <section className="mt-6 rounded-r-lg border border-zinc-200/20 border-l-[3px] border-brand-200 bg-brand-50/40 p-4 dark:border-zinc-800/20 dark:bg-brand-950/20">
            <h2 className="font-display text-xs font-semibold uppercase tracking-wider text-brand-700 dark:text-brand-400">
              中文类比
            </h2>
            <p className="mt-2 text-sm leading-relaxed text-zinc-700 dark:text-zinc-300">{topic.analogy}</p>
          </section>

          {topic.conjugations ? (
            <section className="mt-6 md:mt-8">
              <div className="mb-4 flex items-baseline justify-between gap-3">
                <h2 className="font-display text-xl font-semibold text-zinc-800 dark:text-zinc-200">现在时变位表</h2>
                <span className="shrink-0 text-xs text-zinc-400 dark:text-zinc-500 md:hidden">→ 左右滑动看全表</span>
              </div>
              <div className="overflow-x-auto rounded-xl border border-zinc-200/50 bg-white/70 shadow-sm dark:border-zinc-800/50 dark:bg-zinc-900/70">
                <table className="w-full min-w-[560px] border-collapse text-left">
                  <thead className="bg-zinc-50 dark:bg-zinc-800/50">
                    <tr className="border-b border-zinc-100 dark:border-zinc-800/80">
                      <th className="sticky left-0 bg-zinc-50 px-4 py-3 font-display text-sm font-semibold text-zinc-700 dark:bg-zinc-800/50 dark:text-zinc-300">
                        人称代词
                      </th>
                      <th className="px-4 py-3 font-display text-sm font-semibold text-zinc-700 dark:text-zinc-300">人称说明</th>
                      <th className="px-4 py-3 font-display text-sm font-semibold text-zinc-700 dark:text-zinc-300">变位形式</th>
                      <th className="px-4 py-3 font-display text-sm font-semibold text-zinc-700 dark:text-zinc-300">音频</th>
                    </tr>
                  </thead>
                  <tbody>
                    {topic.conjugations.map((row) => (
                      <tr
                        className="border-b border-zinc-100 transition-colors hover:bg-zinc-50/50 dark:border-zinc-800/80 dark:hover:bg-zinc-800/30"
                        key={row.pronoun}
                      >
                        <td className="sticky left-0 bg-white px-4 py-4 text-sm text-zinc-600 dark:bg-zinc-900 dark:text-zinc-400">
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
                        <td className="px-4 py-4 font-display text-base font-semibold text-zinc-900 dark:text-zinc-100">
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
            <section className="mt-6 md:mt-8">
              <h2 className="mb-4 font-display text-xl font-semibold text-zinc-800 dark:text-zinc-200">判断规则</h2>
              <div className="space-y-3">
                {topic.rules.map((rule) => (
                  <p
                    className="rounded-xl border border-zinc-200/50 bg-white/70 p-4 text-sm leading-relaxed text-zinc-700 shadow-sm dark:border-zinc-800 dark:bg-zinc-900/70 dark:text-zinc-300"
                    key={rule}
                  >
                    {rule}
                  </p>
                ))}
              </div>
            </section>
          ) : null}

          {topic.comparison ? (
            <section className="mt-6 md:mt-8">
              <h2 className="mb-4 font-display text-xl font-semibold text-zinc-800 dark:text-zinc-200">ser / estar 对比</h2>
              <div className="grid gap-3 sm:grid-cols-2">
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
            <section className="mt-6 md:mt-8">
              <h2 className="mb-4 font-display text-xl font-semibold text-zinc-800 dark:text-zinc-200">例句</h2>
              <div className="space-y-4">
                {topic.examples.map((example) => (
                  <div
                    className="rounded-xl border border-zinc-200/50 bg-white/70 p-4 shadow-sm dark:border-zinc-800 dark:bg-zinc-900/70 md:p-5"
                    key={example.spanish}
                  >
                    <SpanishText
                      enablePhrases={true}
                      className="font-display text-base font-bold text-zinc-900 dark:text-zinc-50"
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
                    <p className="mt-2 text-xs font-light text-zinc-400 dark:text-zinc-500">因为：{example.reason}</p>
                  </div>
                ))}
              </div>
            </section>
          ) : null}

          {topic.related ? (
            <section aria-label="相关语法" className="mt-6 flex flex-wrap gap-2 md:mt-8">
              {topic.related.map((item) => (
                <Link
                  className="inline-flex rounded-full border border-zinc-200/70 bg-white/70 px-3 py-2 text-xs font-semibold text-brand-600 transition active:scale-95 hover:border-brand-300 dark:border-zinc-800/60 dark:bg-zinc-900/70 dark:text-brand-400 md:active:scale-100"
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
    <div className="rounded-xl border border-zinc-200/50 bg-white/70 p-4 shadow-sm dark:border-zinc-800 dark:bg-zinc-900/70 md:p-5">
      <h3 className="mb-4 border-b border-zinc-100 pb-3 font-display text-sm font-bold text-zinc-900 dark:border-zinc-800 dark:text-zinc-50">
        {title}
      </h3>
      <div className="space-y-4">
        {items.map((item) => (
          <div className="border-b border-zinc-100 pb-3 last:border-b-0 last:pb-0 dark:border-zinc-800/50" key={item.spanish}>
            <SpanishText
              enablePhrases={true}
              className="font-display text-base font-bold text-zinc-900 dark:text-zinc-50"
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
            <p className="mt-2 text-xs font-light leading-relaxed text-zinc-400 dark:text-zinc-500">因为：{item.reason}</p>
          </div>
        ))}
      </div>
    </div>
  );
}
