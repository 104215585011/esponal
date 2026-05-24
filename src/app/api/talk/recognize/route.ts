import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { getAuthOptions } from "@/lib/auth";
import { transcribeViaWhisperTunnel } from "@/lib/talk/whisper-client";

type Body = {
  audioBase64?: unknown;
  language?: unknown;
  mimeType?: unknown;
};

function getSessionUserId(session: unknown): string | null {
  if (!session || typeof session !== "object" || !("user" in session)) return null;
  const user = (session as { user?: { id?: unknown } }).user;
  return typeof user?.id === "string" ? user.id : null;
}

export async function POST(request: Request) {
  const session = await getServerSession(getAuthOptions());
  if (!getSessionUserId(session)) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }

  const body = (await request.json().catch(() => ({}))) as Body;
  const audioBase64 = typeof body.audioBase64 === "string" ? body.audioBase64 : "";
  const language = typeof body.language === "string" && body.language ? body.language : "es-MX";
  const mimeType = typeof body.mimeType === "string" && body.mimeType ? body.mimeType : "audio/webm";

  if (!audioBase64) {
    return NextResponse.json({ error: "empty_audio" }, { status: 400 });
  }

  const result = await transcribeViaWhisperTunnel({ audioBase64, language, mimeType });

  return NextResponse.json({
    transcript: result.transcript,
    language: result.language,
    provider: result.provider,
    unavailableReason: result.unavailableReason,
    segments: result.segments
  });
}
