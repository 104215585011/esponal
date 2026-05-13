import Link from "next/link";
import { grammarGroups, grammarTopics } from "../../../content/grammar/topics";
import { GrammarTopicSelect } from "./GrammarTopicSelect";

export default function GrammarHomePage() {
  return (
    <main className="min-h-screen bg-[#F9FAFB] text-gray-900">
      <div className="mx-auto flex w-full max-w-5xl gap-8 px-4 py-8 sm:px-8">
        <aside className="hidden w-[220px] shrink-0 lg:block">
          <h2 className="mb-4 text-sm font-semibold text-gray-900">语法话题</h2>
          <nav className="space-y-6">
            {grammarGroups.map((group) => (
              <section key={group}>
                <h3 className="mb-2 text-xs font-medium text-gray-400">{group}</h3>
                <div className="space-y-1">
                  {grammarTopics
                    .filter((topic) => topic.group === group)
                    .map((topic) => (
                      <Link
                        className="block border-l-[3px] border-transparent py-1.5 pl-3 text-sm text-gray-700 hover:text-emerald-600"
                        href={`/grammar/${topic.slug}`}
                        key={topic.slug}
                      >
                        {topic.title}
                      </Link>
                    ))}
                </div>
              </section>
            ))}
          </nav>
        </aside>

        <section className="w-full max-w-2xl">
          <div className="mb-6 lg:hidden">
            <label className="mb-2 block text-sm font-semibold text-gray-900" htmlFor="grammar-topic">
              语法话题
            </label>
            <GrammarTopicSelect topics={grammarTopics} />
          </div>

          <header className="mb-6">
            <p className="text-sm font-medium text-emerald-600">COURSE-002</p>
            <h1 className="mt-2 text-3xl font-bold text-gray-900">语法知识库</h1>
            <p className="mt-3 text-base leading-7 text-gray-500">
              为中文母语者整理的西班牙语核心语法，先理解差异，再记住形式。
            </p>
          </header>

          <div className="flex flex-col gap-3">
            {grammarTopics.map((topic) => (
              <Link
                className="group rounded-xl shadow-sm border border-gray-100 bg-white p-4 transition hover:border-emerald-100"
                href={`/grammar/${topic.slug}`}
                key={topic.slug}
              >
                <div className="flex items-center justify-between gap-4">
                  <div>
                    <p className="text-xs font-medium text-gray-400">{topic.group}</p>
                    <h2 className="mt-1 text-lg font-semibold text-gray-900">{topic.title}</h2>
                    <p className="mt-2 text-sm leading-6 text-gray-500">{topic.intro}</p>
                  </div>
                  <span className="shrink-0 text-xl text-gray-300 group-hover:text-emerald-600">→</span>
                </div>
              </Link>
            ))}
          </div>
        </section>
      </div>
    </main>
  );
}
