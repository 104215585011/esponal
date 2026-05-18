import { NextResponse } from "next/server";
import { checkRateLimit, getRetryAfterSec, ingestLimiter } from "@/lib/ratelimit";
import { redis } from "@/lib/redis";

export const runtime = "nodejs";

const SUBTITLE_CACHE_TTL = 86400 * 30;
const MAX_CUES = 5000;
const MIN_CUES = 5;
const MAX_PAYLOAD_BYTES = 500_000;

type IngestBody = {
  videoId: string;
  lang: string;
  cues: Array<{ start: number; dur: number; text: string }>;
};

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

function cleanCues(cues: IngestBody["cues"]) {
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

export async function POST(request: Request) {
  const rateLimit = await checkRateLimit(ingestLimiter, request, null);

  if (!rateLimit.allowed) {
    const retryAfterSec = getRetryAfterSec(rateLimit.reset);

    return NextResponse.json(
      { error: "rate limited", retryAfterSec },
      {
        status: 429,
        headers: { "Retry-After": String(retryAfterSec) }
      }
    );
  }

  const raw = await request.text();

  if (raw.length > MAX_PAYLOAD_BYTES) {
    return NextResponse.json({ error: "payload too large" }, { status: 413 });
  }

  let body: IngestBody;

  try {
    body = JSON.parse(raw) as IngestBody;
  } catch {
    return NextResponse.json({ error: "invalid json" }, { status: 400 });
  }

  if (
    !isValidVideoId(body.videoId) ||
    !isValidLang(body.lang) ||
    !Array.isArray(body.cues) ||
    body.cues.length < MIN_CUES ||
    body.cues.length > MAX_CUES
  ) {
    return NextResponse.json({ error: "invalid body" }, { status: 400 });
  }

  const clean = cleanCues(body.cues);

  if (clean.length < MIN_CUES) {
    return NextResponse.json({ error: "not enough valid cues" }, { status: 400 });
  }

  const cacheKey = `subtitle:${body.videoId}:${body.lang}`;
  const existing = await redis.get(cacheKey);

  if (existing) {
    return NextResponse.json({ ok: true, status: "exists" });
  }

  await redis.set(cacheKey, JSON.stringify(clean), "EX", SUBTITLE_CACHE_TTL);

  return NextResponse.json({
    ok: true,
    status: "ingested",
    cueCount: clean.length
  });
}
