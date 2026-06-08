// Timestamp: 2026-06-08 20:45
import { NextResponse } from "next/server";
import { parseYouTubeVideoId } from "@/lib/import/parse-video-url";

export async function POST(request: Request) {
  let body: { url?: unknown };

  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "invalid_json" }, { status: 400 });
  }

  const url = typeof body.url === "string" ? body.url : "";
  const videoId = parseYouTubeVideoId(url);

  if (!videoId) {
    return NextResponse.json({ error: "unsupported_url" }, { status: 400 });
  }

  return NextResponse.json({
    videoId,
    redirect: `/watch?v=${videoId}`,
  });
}
