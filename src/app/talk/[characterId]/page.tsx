import { notFound, redirect } from "next/navigation";
import { getServerSession } from "next-auth";
import { SiteHeader } from "@/app/components/web/SiteHeader";
import { BackLink } from "@/app/components/web/BackLink";
import { getAuthOptions } from "@/lib/auth";
import { getTalkCharacterById, TALK_CHARACTERS } from "@/lib/talk/characters";
import { TalkClient } from "./TalkClient";
import { TalkSidebar } from "./TalkSidebar";

export const dynamic = "force-dynamic";

export function generateStaticParams() {
  return TALK_CHARACTERS.map((c) => ({ characterId: c.id }));
}

type Props = {
  params: { characterId: string };
  searchParams?: { session?: string };
};

const LANG_FLAG: Record<string, string> = {
  carlos: "🇲🇽",
  emma: "🇬🇧",
  jake: "🇺🇸",
  sophie: "🇫🇷",
  kenji: "🇯🇵"
};

const LOCALE: Record<string, string> = {
  carlos: "es-MX",
  emma: "en-GB",
  jake: "en-US",
  sophie: "fr-FR",
  kenji: "ja-JP"
};

export default async function TalkCharacterPage({ params, searchParams }: Props) {
  const character = getTalkCharacterById(params.characterId);
  if (!character) notFound();

  const session = await getServerSession(getAuthOptions());
  if (!session?.user) {
    redirect(`/auth/sign-in?callbackUrl=/talk/${character.id}`);
  }

  return (
    <main className="min-h-screen bg-app">
      <SiteHeader />
      <section className="mx-auto flex h-[calc(100vh-64px)] w-full max-w-app-shell lg:flex">
        <div className="border-r border-gray-200 px-4 pt-4 lg:w-[260px] lg:shrink-0">
          <TalkSidebar characterId={character.id} characterName={character.name} />
        </div>

        <div className="min-w-0 flex-1 px-4 pt-4">
          <div className="mx-auto flex h-full max-w-3xl flex-col">
            <BackLink href="/talk" label="对话" />
            <header className="mb-3 mt-2 flex items-center gap-3">
              <span aria-hidden className="text-3xl">
                {LANG_FLAG[character.id] ?? "🌐"}
              </span>
              <div>
                <h1 className="text-lg font-semibold tracking-tight text-gray-900">
                  {character.name}
                </h1>
                <p className="text-[13px] text-gray-500">
                  {character.language} · {character.style}
                </p>
              </div>
            </header>

            <TalkClient
              characterId={character.id}
              characterName={character.name}
              initialSessionId={searchParams?.session ?? null}
              locale={LOCALE[character.id] ?? "es-MX"}
            />
          </div>
        </div>
      </section>
    </main>
  );
}
