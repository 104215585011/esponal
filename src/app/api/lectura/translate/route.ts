// Timestamp: 2026-11-18 10:58
import { withApiUsage } from "@/lib/api-usage";
import { createHash } from "node:crypto";
import { NextResponse } from "next/server";
import { getOptionalUserId } from "@/lib/api-auth";
import { normalizeLanguage } from "@/lib/languages";
import { checkRateLimit, getRetryAfterSec, translateLimiter } from "@/lib/ratelimit";
import { redis } from "@/lib/redis";
import { translateTextToZh } from "@/lib/translate";

export const runtime = "nodejs";
export const maxDuration = 60;

const CACHE_TTL_SEC = 60 * 60 * 24 * 30;
const MAX_PARAGRAPHS = 35;

async function translateOne(text: string, sourceLang: string): Promise<string> {
  const clean = text.trim().slice(0, 1500);
  if (!clean) return "";

  const hash = createHash("sha1").update(clean).digest("hex").slice(0, 16);
  const key = `lectura:zh:v1:${sourceLang}:${hash}`;

  try {
    const cached = await redis.get(key);
    if (cached) return cached;
  } catch {
    // ignore cache miss
  }

  const res = await translateTextToZh(clean, sourceLang).catch(() => null);
  const translation = res?.translation?.trim() ?? "";
  if (translation) {
    try {
      await redis.set(key, translation, "EX", CACHE_TTL_SEC);
    } catch {
      // ignore cache write failure
    }
  }
  return translation;
}

/**
 * POST /api/lectura/translate
 * 批量将短文 / 书架阅读器段落翻译为简体中文（30 天 Redis 缓存），支持中西/多语种对照。
 */
export async function POST(request: Request) {
  const userId = await getOptionalUserId(request);
  return withApiUsage(userId, () => handleRequest(request, userId));
}

async function handleRequest(request: Request, userId: string | null) {

  const rateLimit = await checkRateLimit(translateLimiter, request, userId);

  if (!rateLimit.allowed) {
    const retryAfterSec = getRetryAfterSec(rateLimit.reset);
    return NextResponse.json(
      { error: "rate_limited", retryAfterSec },
      { status: 429, headers: { "Retry-After": String(retryAfterSec) } }
    );
  }

  let body: { paragraphs?: unknown; sourceLang?: unknown };
  try {
    body = (await request.json()) as typeof body;
  } catch {
    return NextResponse.json({ error: "invalid_json" }, { status: 400 });
  }

  if (!Array.isArray(body.paragraphs)) {
    return NextResponse.json({ error: "paragraphs_required" }, { status: 400 });
  }

  const sourceLang = normalizeLanguage(
    typeof body.sourceLang === "string" ? body.sourceLang : "es"
  );
  const paragraphs = body.paragraphs
    .filter((p): p is string => typeof p === "string")
    .slice(0, MAX_PARAGRAPHS);

  const translations: string[] = new Array(paragraphs.length).fill("");
  const concurrency = 5;

  for (let i = 0; i < paragraphs.length; i += concurrency) {
    const chunk = paragraphs.slice(i, i + concurrency);
    const results = await Promise.all(chunk.map((p) => translateOne(p, sourceLang)));
    results.forEach((tr, offset) => {
      translations[i + offset] = tr;
    });
  }

  return NextResponse.json({ translations });
}
