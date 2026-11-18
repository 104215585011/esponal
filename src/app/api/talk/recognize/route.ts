// Timestamp: 2026-11-18 10:58
import { checkAdminFeature } from "@/lib/admin-policy";
import { withApiUsage } from "@/lib/api-usage";
import { NextResponse } from "next/server";
import { transcribeViaWhisperTunnel } from "@/lib/talk/whisper-client";
import { getAuthedUserId } from "@/lib/api-auth";

type Body = {
  audioBase64?: unknown;
  language?: unknown;
  mimeType?: unknown;
};

export async function POST(request: Request) {
  const userId = await getAuthedUserId(request);
  return withApiUsage(userId, () => handleRequest(request, userId));
}

async function handleRequest(request: Request, userId: string | null) {
  if (!userId) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }

  const body = (await request.json().catch(() => ({}))) as Body;
  const audioBase64 = typeof body.audioBase64 === "string" ? body.audioBase64 : "";
  const language = typeof body.language === "string" && body.language ? body.language : "es-MX";
  const mimeType = typeof body.mimeType === "string" && body.mimeType ? body.mimeType : "audio/webm";

  if (!audioBase64) {
    return NextResponse.json({ error: "empty_audio" }, { status: 400 });
  }

  const denied = await checkAdminFeature(userId, "talk");
  if (denied) return denied;

  const result = await transcribeViaWhisperTunnel({ audioBase64, language, mimeType });

  return NextResponse.json({
    transcript: result.transcript,
    language: result.language,
    provider: result.provider,
    unavailableReason: result.unavailableReason,
    segments: result.segments
  });
}
