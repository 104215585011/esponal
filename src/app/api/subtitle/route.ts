import { NextResponse } from "next/server";
import { YoutubeTranscript } from "youtube-transcript";
import { getCachedJson } from "@/lib/youtube";

export const dynamic = "force-dynamic";

const SUBTITLE_CACHE_TTL_SECONDS = 24 * 60 * 60;

type SubtitleCue = {
  start: number;
  dur: number;
  text: string;
};

function normalizeTranscriptText(text: string) {
  return text.replace(/\s+/g, " ").trim();
}

async function fetchSubtitleCues(videoId: string, lang: string) {
  const transcript = await YoutubeTranscript.fetchTranscript(videoId, {
    lang
  });
  const cues = transcript
    .map((item) => ({
      start: item.offset / 1000,
      dur: item.duration / 1000,
      text: normalizeTranscriptText(item.text)
    }))
    .filter(
      (cue): cue is SubtitleCue =>
        Boolean(cue.text) &&
        Number.isFinite(cue.start) &&
        Number.isFinite(cue.dur) &&
        cue.dur > 0
    );

  console.log("[subtitle] fetched", cues.length, "cues for", videoId);

  return cues;
}

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const videoId = searchParams.get("v")?.trim() ?? "";
  const lang = searchParams.get("lang")?.trim() || "es";

  if (!videoId) {
    return NextResponse.json([], { status: 200 });
  }

  try {
    const cues = await getCachedJson(
      "youtube:subtitle:transcript",
      `${videoId}:${lang}`,
      SUBTITLE_CACHE_TTL_SECONDS,
      () => fetchSubtitleCues(videoId, lang)
    );

    return NextResponse.json(cues);
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    console.log("[subtitle] youtube-transcript failed:", message);

    return NextResponse.json([], { status: 200 });
  }
}
