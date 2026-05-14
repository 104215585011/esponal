import { NextResponse } from "next/server";
import { getCachedJson } from "@/lib/youtube";

export const dynamic = "force-dynamic";

const SUBTITLE_CACHE_TTL_SECONDS = 24 * 60 * 60;

type TimedTextEvent = {
  tStartMs?: number;
  dDurationMs?: number;
  segs?: Array<{
    utf8?: string;
  }>;
};

type TimedTextResponse = {
  events?: TimedTextEvent[];
};

type SubtitleCue = {
  start: number;
  dur: number;
  text: string;
};

function normalizeSubtitleText(event: TimedTextEvent) {
  return (event.segs ?? [])
    .map((segment) => segment.utf8 ?? "")
    .join("")
    .replace(/\s+/g, " ")
    .trim();
}

function parseSubtitleEvents(payload: TimedTextResponse) {
  return (payload.events ?? []).reduce<SubtitleCue[]>((cues, event) => {
    const text = normalizeSubtitleText(event);
    const start = typeof event.tStartMs === "number" ? event.tStartMs / 1000 : NaN;
    const dur = typeof event.dDurationMs === "number" ? event.dDurationMs / 1000 : NaN;

    if (!text || !Number.isFinite(start) || !Number.isFinite(dur) || dur <= 0) {
      return cues;
    }

    cues.push({
      start,
      dur,
      text
    });

    return cues;
  }, []);
}

async function fetchSubtitleCues(videoId: string, lang: string) {
  const response = await fetch(
    `https://www.youtube.com/api/timedtext?v=${encodeURIComponent(videoId)}&lang=${encodeURIComponent(lang)}&fmt=json3`,
    {
      next: { revalidate: 0 }
    }
  );

  if (!response.ok) {
    return [] as SubtitleCue[];
  }

  const payload = (await response.json()) as TimedTextResponse;
  return parseSubtitleEvents(payload);
}

export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
    const videoId = searchParams.get("v")?.trim() ?? "";
    const lang = searchParams.get("lang")?.trim() || "es";

    if (!videoId) {
      return NextResponse.json([], { status: 200 });
    }

    const cues = await getCachedJson(
      "youtube:subtitle",
      `${videoId}:${lang}`,
      SUBTITLE_CACHE_TTL_SECONDS,
      () => fetchSubtitleCues(videoId, lang)
    );

    return NextResponse.json(cues);
  } catch (error) {
    console.error("Subtitle fetch failed", error);
    return NextResponse.json([], { status: 200 });
  }
}
