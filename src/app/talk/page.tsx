// Timestamp: 2026-05-26 16:15
import Link from "next/link";
import { SiteHeader } from "@/app/components/web/SiteHeader";
import { TALK_CHARACTERS } from "@/lib/talk/characters";

export const dynamic = "force-dynamic";

const LANG_FLAG: Record<string, string> = {
  carlos: "🇲🇽",
  emma: "🇬🇧",
  jake: "🇺🇸",
  sophie: "🇫🇷",
  kenji: "🇯🇵"
};

// 西语学习者优先看到 Carlos
const orderedCharacters = [
  ...TALK_CHARACTERS.filter((c) => c.id === "carlos"),
  ...TALK_CHARACTERS.filter((c) => c.id !== "carlos")
];

export default function TalkIndexPage() {
  return (
    <main className="min-h-screen bg-app">
      <SiteHeader />
      <section className="mx-auto max-w-app-shell px-4 py-10">
        <header className="mb-8">
          <h1 className="text-3xl font-semibold tracking-tight text-zinc-950 dark:text-zinc-50 font-display">
            Talk · AI 对话练习
          </h1>
          <p className="mt-2 text-sm text-zinc-500 dark:text-zinc-400 font-light">
            选一位 AI 老师开始对话。Carlos 是西语母语者——Esponal 的默认推荐。
          </p>
        </header>

        <div className="grid gap-5 sm:grid-cols-2 lg:grid-cols-3">
          {orderedCharacters.map((character) => (
            <Link
              className="group flex flex-col gap-3 rounded-hero border border-zinc-200/50 dark:border-zinc-800/50 bg-white/70 dark:bg-zinc-900/70 p-5 glass-card card-hover-lift hover:border-brand-300 dark:hover:border-brand-700/50"
              href={`/talk/${character.id}`}
              key={character.id}
            >
              <div className="flex items-center justify-between">
                <span className="text-3xl" aria-hidden>
                  {LANG_FLAG[character.id] ?? "🌐"}
                </span>
                {character.id === "carlos" ? (
                  <span className="inline-flex items-center rounded-full bg-brand-100 dark:bg-brand-950/50 px-2.5 py-0.5 text-xs font-semibold text-brand-800 dark:text-brand-300">
                    推荐
                  </span>
                ) : null}
              </div>

              <div>
                <p className="text-base font-semibold text-zinc-900 dark:text-zinc-50 font-display transition-colors duration-300 group-hover:text-brand-500">
                  {character.name}
                </p>
                <p className="mt-0.5 text-[13px] italic text-zinc-400 dark:text-zinc-500">
                  {character.language}
                </p>
              </div>

              <p className="text-sm leading-relaxed text-zinc-600 dark:text-zinc-400 font-light line-clamp-3">{character.bio}</p>

              <p className="mt-auto text-[11px] text-zinc-400 dark:text-zinc-500">{character.style}</p>
            </Link>
          ))}
        </div>
      </section>
    </main>
  );
}
