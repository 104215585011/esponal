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

type SubtitleSource = {
  lang: string;
  tlang?: string;
  kind?: "asr";
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

function buildSubtitleSources(lang: string): SubtitleSource[] {
  return [
    { lang },
    { lang: "es-419" },
    { lang: "es-MX" },
    { lang: "es", tlang: "es", kind: "asr" }
  ];
}

function buildTimedTextUrl(videoId: string, source: SubtitleSource) {
  const params = new URLSearchParams({
    v: videoId,
    lang: source.lang,
    fmt: "json3"
  });

  if (source.tlang) {
    params.set("tlang", source.tlang);
  }

  if (source.kind) {
    params.set("kind", source.kind);
  }

  return `https://www.youtube.com/api/timedtext?${params.toString()}`;
}

async function fetchSubtitleSource(videoId: string, source: SubtitleSource) {
  const response = await fetch(
    buildTimedTextUrl(videoId, source),
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

async function fetchSubtitleCues(videoId: string, lang: string) {
  for (const source of buildSubtitleSources(lang)) {
    const cues = await fetchSubtitleSource(videoId, source);

    if (cues.length > 0) {
      return cues;
    }
  }

  return [] as SubtitleCue[];
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
