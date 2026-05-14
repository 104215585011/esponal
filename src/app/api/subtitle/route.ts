import { NextResponse } from "next/server";
import { getCachedJson } from "@/lib/youtube";

export const dynamic = "force-dynamic";

const SUBTITLE_CACHE_TTL_SECONDS = 24 * 60 * 60;
const TIMEDTEXT_HEADERS = {
  "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36"
};
const SPANISH_LANG_CODES = ["es", "es-419", "es-MX"];

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

type CaptionTrack = {
  langCode: string;
  name: string;
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
  const preferredLangCodes = Array.from(
    new Set([preferredLang, ...SPANISH_LANG_CODES].filter(Boolean))
  );

  for (const langCode of preferredLangCodes) {
    const track = tracks.find((item) => item.langCode === langCode);

    if (track) {
      return track;
    }
  }

  return null;
}

async function findSpanishCaptionTrack(videoId: string, preferredLang: string) {
  const listUrl = `https://www.youtube.com/api/timedtext?v=${encodeURIComponent(videoId)}&type=list`;
  const listRes = await fetch(listUrl, {
    headers: TIMEDTEXT_HEADERS,
    next: { revalidate: 0 }
  });
  const listXml = await listRes.text();

  console.log("[subtitle] list tracks:", listXml.slice(0, 300));

  if (!listRes.ok || !listXml.trim()) {
    return null;
  }

  const track = parseCaptionTracks(listXml, preferredLang);

  if (track) {
    console.log("[subtitle] selected lang:", track.langCode, "name:", track.name);
  }

  return track;
}

async function fetchSubtitleCues(videoId: string, lang: string) {
  const track = await findSpanishCaptionTrack(videoId, lang);

  if (!track) {
    return [] as SubtitleCue[];
  }

  const captionUrl = `https://www.youtube.com/api/timedtext?v=${encodeURIComponent(videoId)}&lang=${encodeURIComponent(track.langCode)}&name=${encodeURIComponent(track.name)}&fmt=json3`;
  const res = await fetch(captionUrl, {
    headers: TIMEDTEXT_HEADERS,
    next: { revalidate: 0 }
  });
  const text = await res.text();

  if (!res.ok || !text || !text.trim().startsWith("{")) {
    return [] as SubtitleCue[];
  }

  try {
    const data = JSON.parse(text) as TimedTextResponse;
    return parseSubtitleEvents(data);
  } catch {
    return [] as SubtitleCue[];
  }
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
      "youtube:subtitle:v2",
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
