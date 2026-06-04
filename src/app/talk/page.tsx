// Timestamp: 2026-06-04 11:18
import Link from "next/link";
import { getServerSession } from "next-auth";
import { MobileTopBar } from "@/app/components/web/MobileTopBar";
import { SiteHeader } from "@/app/components/web/SiteHeader";
import { getAuthOptions } from "@/lib/auth";
import { TALK_CHARACTERS } from "@/lib/talk/characters";

export const dynamic = "force-dynamic";

const LANG_BADGE: Record<string, string> = {
  carlos: "ES",
  emma: "UK",
  jake: "US",
  sophie: "FR",
  kenji: "JP"
};

const orderedCharacters = [
  ...TALK_CHARACTERS.filter((character) => character.id === "carlos"),
  ...TALK_CHARACTERS.filter((character) => character.id !== "carlos")
];

export default async function TalkIndexPage() {
  const session = await getServerSession(getAuthOptions());

  return (
    <main className="min-h-screen bg-app">
      <div className="hidden md:block"><SiteHeader /></div>
      <MobileTopBar session={session} />

      <section className="mx-auto max-w-app-shell px-4 py-6 md:py-10">
        <header className="mb-5 md:mb-8">
          <h1 className="font-display text-2xl font-semibold tracking-tight text-zinc-950 dark:text-zinc-50 md:text-3xl">
            选择一位 AI 老师
          </h1>
          <p className="mt-1.5 text-[13px] font-light leading-relaxed text-zinc-500 dark:text-zinc-400 md:text-sm">
            用真人感的对话练口语。Carlos 是西语母语者，也是 Esponal 的默认推荐。
          </p>
        </header>

        <div className="grid grid-cols-1 gap-3 md:grid-cols-2 md:gap-5 lg:grid-cols-3">
          {orderedCharacters.map((character) => (
            <Link
              className="group relative flex items-start gap-3.5 rounded-hero border border-zinc-200/60 bg-white/70 p-4 glass-card card-hover-lift transition active:scale-[0.99] hover:border-brand-300 dark:border-zinc-800/60 dark:bg-zinc-900/70 dark:hover:border-brand-700/50 md:flex-col md:items-stretch md:gap-3 md:p-5"
              href={`/talk/${character.id}`}
              key={character.id}
            >
              <span
                aria-hidden
                className="flex h-12 w-12 shrink-0 items-center justify-center rounded-full bg-brand-50 font-display text-sm font-bold tracking-normal text-brand-700 ring-1 ring-brand-100 dark:bg-brand-950/40 dark:text-brand-300 dark:ring-brand-900/40 md:h-14 md:w-14 md:text-base"
              >
                {LANG_BADGE[character.id] ?? "AI"}
              </span>

              <div className="min-w-0 flex-1">
                <div className="flex items-center gap-2">
                  <p className="truncate font-display text-[15px] font-semibold text-zinc-900 transition-colors group-hover:text-brand-600 dark:text-zinc-50 dark:group-hover:text-brand-400 md:text-base">
                    {character.name}
                  </p>
                  {character.id === "carlos" ? (
                    <span className="shrink-0 rounded-full bg-brand-100 px-2 py-0.5 text-[10px] font-semibold text-brand-800 dark:bg-brand-950/50 dark:text-brand-300">
                      推荐
                    </span>
                  ) : null}
                </div>
                <p className="mt-0.5 text-[12px] italic text-zinc-400 dark:text-zinc-500">
                  {character.language}
                </p>
                <p className="mt-1.5 line-clamp-2 text-[13px] font-light leading-relaxed text-zinc-600 dark:text-zinc-400 md:line-clamp-3">
                  {character.bio}
                </p>
                <p className="mt-2 hidden text-[11px] text-zinc-400 dark:text-zinc-500 md:block">
                  {character.style}
                </p>
              </div>

              <svg
                aria-hidden
                className="mt-0.5 h-5 w-5 shrink-0 text-zinc-300 transition group-hover:text-brand-500 dark:text-zinc-600 md:hidden"
                fill="none"
                stroke="currentColor"
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                viewBox="0 0 24 24"
              >
                <path d="M9 6l6 6-6 6" />
              </svg>
            </Link>
          ))}
        </div>
      </section>
    </main>
  );
}
