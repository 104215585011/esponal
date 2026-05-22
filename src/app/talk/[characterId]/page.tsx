import { notFound, redirect } from "next/navigation";
import { getServerSession } from "next-auth";
import { SiteHeader } from "@/app/components/web/SiteHeader";
import { BackLink } from "@/app/components/web/BackLink";
import { getAuthOptions } from "@/lib/auth";
import { getTalkCharacterById, TALK_CHARACTERS } from "@/lib/talk/characters";
import { TalkClient } from "./TalkClient";

export const dynamic = "force-dynamic";

export function generateStaticParams() {
  return TALK_CHARACTERS.map((c) => ({ characterId: c.id }));
}

type Props = { params: { characterId: string } };

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

export default async function TalkCharacterPage({ params }: Props) {
  const character = getTalkCharacterById(params.characterId);
  if (!character) notFound();

  const session = await getServerSession(getAuthOptions());
  if (!session?.user) {
    redirect(`/auth/sign-in?callbackUrl=/talk/${character.id}`);
  }

  return (
    <main className="min-h-screen bg-app">
      <SiteHeader />
      <section className="mx-auto flex h-[calc(100vh-64px)] max-w-3xl flex-col px-4 pt-4">
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
          locale={LOCALE[character.id] ?? "es-MX"}
        />
      </section>
    </main>
  );
}
