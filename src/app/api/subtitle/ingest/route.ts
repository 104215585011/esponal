import { NextResponse } from "next/server";
import { checkRateLimit, getRetryAfterSec, ingestLimiter } from "@/lib/ratelimit";
import { redis } from "@/lib/redis";

export const runtime = "nodejs";

const SUBTITLE_CACHE_TTL = 86400 * 30;
const MAX_CUES = 5000;
const MIN_CUES = 5;
const MAX_PAYLOAD_BYTES = 500_000;
const CORS_HEADERS = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type, X-Esponal-Ingest-Token",
  "Access-Control-Max-Age": "86400"
} as const;

type SubtitleCue = {
  start: number;
  dur: number;
  text: string;
};

type IngestBody = {
  videoId: string;
  lang: string;
  cues: SubtitleCue[];
};

function withCorsHeaders(init?: ResponseInit): ResponseInit {
  const headers = new Headers(init?.headers);

  for (const [key, value] of Object.entries(CORS_HEADERS)) {
    headers.set(key, value);
  }

  return { ...init, headers };
}

function jsonResponse(body: unknown, init?: ResponseInit) {
  return NextResponse.json(body, withCorsHeaders(init));
}

function isValidVideoId(videoId: unknown): videoId is string {
  return (
    typeof videoId === "string" &&
    videoId.length > 0 &&
    videoId.length <= 32 &&
    /^[\w-]+$/.test(videoId)
  );
}

function isValidLang(lang: unknown): lang is string {
  return (
    typeof lang === "string" &&
    lang.length > 0 &&
    lang.length <= 12 &&
    /^[a-z]{2}(?:-[A-Za-z0-9]+)?$/.test(lang)
  );
}

function cleanCues(cues: SubtitleCue[]) {
  return cues
    .filter((cue) => {
      const text = typeof cue?.text === "string" ? cue.text.trim() : "";

      return (
        Number.isFinite(cue?.start) &&
        Number.isFinite(cue?.dur) &&
        cue.start >= 0 &&
        cue.dur > 0 &&
        cue.dur < 600 &&
        text.length > 0 &&
        text.length < 500
      );
    })
    .map((cue) => ({
      start: cue.start,
      dur: cue.dur,
      text: cue.text.trim()
    }))
    .sort((a, b) => a.start - b.start);
}

export async function OPTIONS() {
  return new NextResponse(null, withCorsHeaders({ status: 204 }));
}

export async function POST(request: Request) {
  const token = request.headers.get("x-esponal-ingest-token");

  if (!token || token !== process.env.EXT_INGEST_TOKEN) {
    return jsonResponse({ error: "unauthorized" }, { status: 401 });
  }

  const rateLimit = await checkRateLimit(ingestLimiter, request, null);

  if (!rateLimit.allowed) {
    const retryAfterSec = getRetryAfterSec(rateLimit.reset);

    return jsonResponse(
      { error: "rate limited", retryAfterSec },
      {
        status: 429,
        headers: { "Retry-After": String(retryAfterSec) }
      }
    );
  }

  const raw = await request.text();

  if (raw.length > MAX_PAYLOAD_BYTES) {
    return jsonResponse({ error: "payload too large" }, { status: 413 });
  }

  let body: IngestBody;

  try {
    body = JSON.parse(raw) as IngestBody;
  } catch {
    return jsonResponse({ error: "invalid json" }, { status: 400 });
  }

  if (
    !isValidVideoId(body.videoId) ||
    !isValidLang(body.lang) ||
    !Array.isArray(body.cues) ||
    body.cues.length < MIN_CUES ||
    body.cues.length > MAX_CUES
  ) {
    return jsonResponse({ error: "invalid body" }, { status: 400 });
  }

  const cues = cleanCues(body.cues);

  if (cues.length < MIN_CUES) {
    return jsonResponse({ error: "not enough valid cues" }, { status: 400 });
  }

  const cacheKey = `subtitle:v4:${body.videoId}:${body.lang}:auto`;
  const existing = await redis.get(cacheKey);

  if (existing) {
    return jsonResponse({
      success: true,
      cueCount: cues.length,
      written: false
    });
  }

  await redis.set(cacheKey, JSON.stringify(cues), "EX", SUBTITLE_CACHE_TTL);

  return jsonResponse({
    success: true,
    cueCount: cues.length,
    written: true
  });
}
