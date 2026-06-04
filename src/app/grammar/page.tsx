// Timestamp: 2026-06-04 15:02
import Link from "next/link";
import { SiteHeader } from "@/app/components/web/SiteHeader";
import { grammarGroups, grammarTopics } from "../../../content/grammar/topics";
import { GrammarTopicSelect } from "./GrammarTopicSelect";

export default function GrammarHomePage() {
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
                    .filter((topic) => topic.group === group)
                    .map((topic) => (
                      <Link
                        className="block border-l-[3px] border-transparent py-1.5 pl-3 text-sm text-zinc-600 transition-colors hover:text-brand-600 dark:text-zinc-400 dark:hover:text-brand-400"
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
          <div className="mb-5 lg:hidden">
            <label className="mb-2 block text-sm font-semibold text-zinc-900 dark:text-zinc-200" htmlFor="grammar-topic">
              语法话题
            </label>
            <GrammarTopicSelect topics={grammarTopics} />
          </div>

          <header className="mb-6 md:mb-8">
            <p className="text-sm font-medium text-brand-600 dark:text-brand-400">COURSE-002</p>
            <h1 className="mt-2 text-2xl leading-snug md:text-3xl font-display font-bold tracking-tight text-zinc-900 dark:text-zinc-50">
              语法知识库
            </h1>
            <p className="mt-3 line-clamp-2 md:line-clamp-none text-base font-light leading-relaxed text-zinc-500 dark:text-zinc-400">
              为中文母语者整理的西班牙语核心语法，先理解差异，再记住形式。
            </p>
          </header>

          <div className="flex flex-col gap-2.5 md:gap-3">
            {grammarTopics
              .filter((topic) => (grammarGroups as readonly string[]).includes(topic.group))
              .map((topic) => (
                <Link
                  className="group flex rounded-card border border-zinc-200/50 bg-white/70 p-4 shadow-sm transition-transform active:scale-[0.99] hover:border-brand-300 dark:border-zinc-800/50 dark:bg-zinc-900/70 dark:hover:border-brand-700/50 md:card-hover-lift md:p-5 md:active:scale-100"
                  href={`/grammar/${topic.slug}`}
                  key={topic.slug}
                >
                  <div className="flex w-full items-center justify-between gap-4">
                    <div className="min-w-0">
                      <p className="text-xs font-semibold uppercase tracking-wider text-zinc-400 dark:text-zinc-500">
                        {topic.group}
                      </p>
                      <h2 className="mt-1 font-display text-lg font-semibold text-zinc-900 dark:text-zinc-100">
                        {topic.title}
                      </h2>
                      <p className="mt-2 line-clamp-2 md:line-clamp-none text-sm leading-relaxed text-zinc-500 dark:text-zinc-400">
                        {topic.intro}
                      </p>
                    </div>
                    <span className="shrink-0 text-xl text-zinc-300 transition duration-300 group-hover:translate-x-1 group-hover:text-brand-500 dark:text-zinc-700">
                      →
                    </span>
                  </div>
                </Link>
              ))}
          </div>
        </section>
      </div>
    </main>
  );
}
