// Timestamp: 2026-05-26 16:05
import Link from "next/link";
import { SiteHeader } from "@/app/components/web/SiteHeader";
import { grammarGroups, grammarTopics } from "../../../content/grammar/topics";
import { GrammarTopicSelect } from "./GrammarTopicSelect";

export default function GrammarHomePage() {
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
                    .filter((topic) => topic.group === group)
                    .map((topic) => (
                      <Link
                        className="block border-l-[3px] border-transparent py-1.5 pl-3 text-sm text-zinc-600 dark:text-zinc-400 hover:text-brand-600 dark:hover:text-brand-400 transition-colors"
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
            <label className="mb-2 block text-sm font-semibold text-zinc-900 dark:text-zinc-200" htmlFor="grammar-topic">
              语法话题
            </label>
            <GrammarTopicSelect topics={grammarTopics} />
          </div>

          <header className="mb-8">
            <p className="text-sm font-medium text-brand-600 dark:text-brand-400">COURSE-002</p>
            <h1 className="mt-2 text-3xl font-bold text-zinc-900 dark:text-zinc-50 font-display tracking-tight">语法知识库</h1>
            <p className="mt-3 text-base leading-relaxed text-zinc-500 dark:text-zinc-400 font-light">
              为中文母语者整理的西班牙语核心语法，先理解差异，再记住形式。
            </p>
          </header>

          <div className="flex flex-col gap-3">
            {grammarTopics.filter((topic) => (grammarGroups as readonly string[]).includes(topic.group)).map((topic) => (
              <Link
                className="group rounded-xl shadow-sm border border-gray-100 bg-white/70 dark:bg-zinc-900/70 border-zinc-200/50 dark:border-zinc-800/50 p-5 glass-card card-hover-lift shadow-sm"
                href={`/grammar/${topic.slug}`}
                key={topic.slug}
              >
                <div className="flex items-center justify-between gap-4">
                  <div className="min-w-0">
                    <p className="text-xs font-semibold text-zinc-400 dark:text-zinc-500 uppercase tracking-wider">{topic.group}</p>
                    <h2 className="mt-1 text-lg font-semibold text-zinc-900 dark:text-zinc-100 font-display">{topic.title}</h2>
                    <p className="mt-2 text-sm leading-relaxed text-zinc-500 dark:text-zinc-400">{topic.intro}</p>
                  </div>
                  <span className="shrink-0 text-xl text-zinc-300 dark:text-zinc-700 group-hover:text-brand-500 transition-colors group-hover:translate-x-1 duration-300 transform">→</span>
                </div>
              </Link>
            ))}
          </div>
        </section>
      </div>
    </main>
  );
}
