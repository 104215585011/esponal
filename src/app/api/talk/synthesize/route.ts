import { getServerSession } from "next-auth";
import { getAuthOptions } from "@/lib/auth";
import { getTalkCharacterById } from "@/lib/talk/characters";
import { synthesizeSpeech } from "@/lib/talk/speech";

type Body = { characterId?: unknown; text?: unknown };

function getSessionUserId(session: unknown): string | null {
  if (!session || typeof session !== "object" || !("user" in session)) return null;
  const user = (session as { user?: { id?: unknown } }).user;
  return typeof user?.id === "string" ? user.id : null;
}

export async function POST(request: Request) {
  const session = await getServerSession(getAuthOptions());
  if (!getSessionUserId(session)) {
    return new Response(JSON.stringify({ error: "unauthorized" }), {
      status: 401,
      headers: { "content-type": "application/json" }
    });
  }

  const body = (await request.json().catch(() => ({}))) as Body;
  const characterId = typeof body.characterId === "string" ? body.characterId : "";
  const text = typeof body.text === "string" ? body.text.trim() : "";

  if (!getTalkCharacterById(characterId)) {
    return new Response(JSON.stringify({ error: "character_not_found" }), {
      status: 404,
      headers: { "content-type": "application/json" }
    });
  }
  if (!text) {
    return new Response(JSON.stringify({ error: "empty_text" }), {
      status: 400,
      headers: { "content-type": "application/json" }
    });
  }
  if (text.length > 2000) {
    return new Response(JSON.stringify({ error: "text_too_long" }), {
      status: 400,
      headers: { "content-type": "application/json" }
    });
  }

  const result = await synthesizeSpeech({ characterId, text });

  return new Response(result.stream, {
    headers: {
      "content-type": result.contentType,
      "cache-control": "private, max-age=3600",
      "x-tts-provider": result.provider
    }
  });
}
