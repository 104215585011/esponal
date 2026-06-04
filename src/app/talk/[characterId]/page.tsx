// Timestamp: 2026-06-04 14:07
import { notFound, redirect } from "next/navigation";
import { getServerSession } from "next-auth";
import { getAuthOptions } from "@/lib/auth";
import { getTalkCharacterById, TALK_CHARACTERS } from "@/lib/talk/characters";
import { TalkCharacterShell } from "./TalkCharacterShell";

export const dynamic = "force-dynamic";

export function generateStaticParams() {
  return TALK_CHARACTERS.map((character) => ({ characterId: character.id }));
}

type Props = {
  params: { characterId: string };
  searchParams?: { session?: string };
};

const LANG_BADGE: Record<string, string> = {
  carlos: "ES",
  emma: "UK",
  jake: "US",
  sophie: "FR",
  kenji: "JP"
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
    <TalkCharacterShell
      characterBadge={LANG_BADGE[character.id] ?? "AI"}
      characterId={character.id}
      characterLanguage={character.language}
      characterName={character.name}
      characterStyle={character.style}
      initialSessionId={searchParams?.session ?? null}
      locale={LOCALE[character.id] ?? "es-MX"}
    />
  );
}
