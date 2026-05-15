import Link from "next/link";
import { notFound } from "next/navigation";
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
    <main className="min-h-screen bg-[#F9FAFB] text-gray-900">
      <SiteHeader />
      <div className="mx-auto flex w-full max-w-5xl gap-8 px-4 py-8 sm:px-8">
        <aside className="hidden w-[220px] shrink-0 lg:block">
          <h2 className="mb-4 text-sm font-semibold text-gray-900">语法话题</h2>
          <nav className="space-y-6">
            {grammarGroups.map((group) => (
              <section key={group}>
                <h3 className="mb-2 text-xs font-medium text-gray-400">{group}</h3>
                <div className="space-y-1">
                  {grammarTopics
                    .filter((item) => item.group === group)
                    .map((item) => {
                      const active = item.slug === topic.slug;

                      return (
                        <Link
                          aria-current={active ? "page" : undefined}
                          className={[
                            "block py-1.5 pl-3 text-sm text-gray-700 hover:text-emerald-600",
                            active
                              ? "border-l-[3px] border-emerald-500 font-medium text-gray-900"
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
            <label className="mb-2 block text-sm font-semibold text-gray-900" htmlFor="grammar-topic">
              语法话题
            </label>
            <GrammarTopicSelect currentSlug={topic.slug} topics={grammarTopics} />
          </div>

          <Link className="text-sm font-medium text-emerald-600" href="/grammar">
            ← 返回语法话题
          </Link>

          <header className="mt-5">
            <p className="text-sm font-medium text-gray-400">{topic.group}</p>
            <h1 className="mt-2 text-3xl font-bold text-gray-900">{topic.title}</h1>
            <p className="mt-3 text-base leading-7 text-gray-500">{topic.intro}</p>
          </header>

          <section className="mt-6 border-l-[3px] border-emerald-200 bg-emerald-50/40 p-3 rounded-r-lg">
            <h2 className="text-xs font-semibold uppercase tracking-wide text-emerald-700">中文类比</h2>
            <p className="mt-2 text-sm leading-7 text-gray-700">{topic.analogy}</p>
          </section>

          {topic.conjugations ? (
            <section className="mt-8">
              <h2 className="mb-3 text-xl font-semibold text-gray-800">现在时变位表</h2>
              <div className="overflow-x-auto">
                <table className="w-full min-w-[560px] border-collapse bg-white text-left">
                  <thead className="bg-gray-50">
                    <tr className="border-b border-gray-100">
                      <th className="sticky left-0 bg-gray-50 px-3 py-3 text-sm font-medium text-gray-500">
                        人称代词
                      </th>
                      <th className="px-3 py-3 text-sm font-medium text-gray-500">人称说明</th>
                      <th className="px-3 py-3 text-sm font-medium text-gray-500">变位形式</th>
                      <th className="px-3 py-3 text-sm font-medium text-gray-500">音频</th>
                    </tr>
                  </thead>
                  <tbody>
                    {topic.conjugations.map((row) => (
                      <tr className="border-b border-gray-100" key={row.pronoun}>
                        <td className="sticky left-0 bg-white px-3 py-3 text-sm text-gray-500">
                          {row.pronoun}
                        </td>
                        <td className="px-3 py-3 text-sm text-gray-600">{row.person}</td>
                        <td className="px-3 py-3 text-base font-medium text-gray-900">{row.form}</td>
                        <td className="px-3 py-3 text-sm text-gray-400">{row.audioLabel ?? "—"}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </section>
          ) : null}

          {topic.rules ? (
            <section className="mt-8">
              <h2 className="mb-3 text-xl font-semibold text-gray-800">判断规则</h2>
              <div className="space-y-3">
                {topic.rules.map((rule) => (
                  <p className="rounded-xl border border-gray-100 bg-white p-4 text-sm leading-7 text-gray-700 shadow-sm" key={rule}>
                    {rule}
                  </p>
                ))}
              </div>
            </section>
          ) : null}

          {topic.comparison ? (
            <section className="mt-8">
              <h2 className="mb-3 text-xl font-semibold text-gray-800">ser / estar 对比</h2>
              <div className="grid gap-3 sm:grid-cols-2">
                <ComparisonColumn title="ser：身份、本质、来源" items={topic.comparison.ser} />
                <ComparisonColumn title="estar：状态、位置、结果" items={topic.comparison.estar} />
              </div>
            </section>
          ) : null}

          {topic.examples ? (
            <section className="mt-8">
              <h2 className="mb-3 text-xl font-semibold text-gray-800">例句</h2>
              <div className="space-y-3">
                {topic.examples.map((example) => (
                  <div className="rounded-xl border border-gray-100 bg-white p-4 shadow-sm" key={example.spanish}>
                    <p className="text-base font-semibold text-gray-900">{example.spanish}</p>
                    <p className="mt-1 text-sm text-gray-500">{example.chinese}</p>
                    <p className="mt-2 text-xs text-gray-400">因为：{example.reason}</p>
                  </div>
                ))}
              </div>
            </section>
          ) : null}

          {topic.related ? (
            <section className="mt-8 space-y-2">
              {topic.related.map((item) => (
                <Link
                  className="block text-xs font-medium text-emerald-600 hover:underline"
                  href={`/grammar/${item.slug}`}
                  key={item.slug}
                >
                  {item.label}
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
  items
}: {
  title: string;
  items: Array<{ spanish: string; chinese: string; reason: string }>;
}) {
  return (
    <div className="rounded-xl border border-gray-100 bg-white p-4 shadow-sm">
      <h3 className="text-sm font-semibold text-gray-900">{title}</h3>
      <div className="mt-4 space-y-4">
        {items.map((item) => (
          <div className="border-b border-gray-100 pb-3 last:border-b-0 last:pb-0" key={item.spanish}>
            <p className="text-base font-semibold text-gray-900">{item.spanish}</p>
            <p className="mt-1 text-sm text-gray-500">{item.chinese}</p>
            <p className="mt-2 text-xs leading-5 text-gray-400">因为：{item.reason}</p>
          </div>
        ))}
      </div>
    </div>
  );
}
