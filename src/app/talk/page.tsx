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
          <h1 className="text-3xl font-semibold tracking-tight text-gray-900">
            Talk · AI 对话练习
          </h1>
          <p className="mt-2 text-sm text-gray-500">
            选一位 AI 老师开始对话。Carlos 是西语母语者——Esponal 的默认推荐。
          </p>
        </header>

        <div className="grid gap-5 sm:grid-cols-2 lg:grid-cols-3">
          {orderedCharacters.map((character) => (
            <Link
              className="group flex flex-col gap-3 rounded-surface border border-gray-100 bg-surface p-5 shadow-card transition hover:-translate-y-[2px] hover:border-brand-200 hover:shadow-elevated"
              href={`/talk/${character.id}`}
              key={character.id}
            >
              <div className="flex items-center justify-between">
                <span className="text-3xl" aria-hidden>
                  {LANG_FLAG[character.id] ?? "🌐"}
                </span>
                {character.id === "carlos" ? (
                  <span className="inline-flex items-center rounded-full bg-brand-100 px-2 py-0.5 text-[11px] font-semibold text-brand-700">
                    推荐
                  </span>
                ) : null}
              </div>

              <div>
                <p className="text-base font-semibold text-gray-900 group-hover:text-brand-700">
                  {character.name}
                </p>
                <p className="mt-0.5 text-[13px] italic text-gray-500">
                  {character.language}
                </p>
              </div>

              <p className="text-sm leading-6 text-gray-600 line-clamp-3">{character.bio}</p>

              <p className="mt-auto text-[11px] text-gray-400">{character.style}</p>
            </Link>
          ))}
        </div>
      </section>
    </main>
  );
}
