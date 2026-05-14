import { NextResponse } from "next/server";

export const runtime = "edge";
export const dynamic = "force-dynamic";

const YOUTUBE_TIMEDTEXT_URL = "https://www.youtube.com/api/timedtext";
const TIMEDTEXT_HEADERS = {
  "User-Agent":
    "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0 Safari/537.36",
  Accept: "*/*",
  "Accept-Language": "es,en;q=0.8"
};
const FALLBACK_LANG_CODES = ["es", "es-419", "es-MX"];

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

type CaptionTrack = {
  langCode: string;
  name: string;
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

    cues.push({ start, dur, text });

    return cues;
  }, []);
}

function decodeXmlAttribute(value: string) {
  return value
    .replace(/&quot;/g, "\"")
    .replace(/&apos;/g, "'")
    .replace(/&amp;/g, "&")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">");
}

function readTrackAttribute(trackTag: string, attributeName: string) {
  const match = trackTag.match(new RegExp(`${attributeName}="([^"]*)"`));

  return match ? decodeXmlAttribute(match[1]) : "";
}

function parseCaptionTracks(listXml: string, preferredLang: string) {
  const trackTags = listXml.match(/<track\b[^>]*>/g) ?? [];
  const tracks = trackTags
    .map((trackTag) => ({
      langCode: readTrackAttribute(trackTag, "lang_code"),
      name: readTrackAttribute(trackTag, "name")
    }))
    .filter((track): track is CaptionTrack => Boolean(track.langCode));
  const langCodes = Array.from(
    new Set([preferredLang, ...FALLBACK_LANG_CODES].filter(Boolean))
  );

  for (const langCode of langCodes) {
    const track = tracks.find((item) => item.langCode === langCode);

    if (track) {
      return track;
    }
  }

  return null;
}

function buildTimedTextUrl(params: Record<string, string>) {
  const searchParams = new URLSearchParams(params);

  return `${YOUTUBE_TIMEDTEXT_URL}?${searchParams.toString()}`;
}

async function fetchCaptionTrack(videoId: string, lang: string) {
  const listUrl = buildTimedTextUrl({
    v: videoId,
    type: "list"
  });
  const response = await fetch(listUrl, {
    headers: TIMEDTEXT_HEADERS,
    cache: "no-store"
  });
  const listXml = await response.text();

  console.log("[subtitle] edge list tracks:", listXml.slice(0, 300));

  if (!response.ok || !listXml.trim()) {
    return null;
  }

  const track = parseCaptionTracks(listXml, lang);

  if (track) {
    console.log("[subtitle] edge selected lang:", track.langCode, "name:", track.name);
  }

  return track;
}

async function fetchSubtitleCues(videoId: string, lang: string) {
  const track = await fetchCaptionTrack(videoId, lang);

  if (!track) {
    return [] as SubtitleCue[];
  }

  const captionUrl = buildTimedTextUrl({
    v: videoId,
    lang: track.langCode,
    name: track.name,
    fmt: "json3"
  });
  const response = await fetch(captionUrl, {
    headers: TIMEDTEXT_HEADERS,
    cache: "no-store"
  });
  const text = await response.text();

  if (!response.ok || !text.trim().startsWith("{")) {
    return [] as SubtitleCue[];
  }

  const payload = JSON.parse(text) as TimedTextResponse;
  const cues = parseSubtitleEvents(payload);

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
    const cues = await fetchSubtitleCues(videoId, lang);

    return NextResponse.json(cues, {
      headers: {
        "Cache-Control": "s-maxage=86400, stale-while-revalidate=3600"
      }
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    console.log("[subtitle] edge fetch failed:", message);

    return NextResponse.json([], { status: 200 });
  }
}
