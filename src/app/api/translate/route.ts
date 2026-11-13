import { createHash } from "node:crypto";
import { NextResponse } from "next/server";
import { getOptionalUserId } from "@/lib/api-auth";
import { reportTranslateFailure } from "@/lib/monitor";
import {
  checkRateLimit,
  getRetryAfterSec,
  translateLimiter
} from "@/lib/ratelimit";
import { redis } from "@/lib/redis";
import { translateEsToZh } from "@/lib/translate";

const TRANSLATION_CACHE_TTL = 60 * 60 * 24 * 7;

type TranslateResponsePayload = {
  translation: string;
  cached: boolean;
  degraded?: boolean;
};

function sha256Hex(data: string): string {
  return createHash("sha256").update(data).digest("hex");
}

async function safeCacheGet(cacheKey: string) {
  try {
    return await redis.get(cacheKey);
  } catch (error) {
    console.warn("Translate cache read failed", error);
    return null;
  }
}

async function safeCacheSet(cacheKey: string, translation: string) {
  try {
    await redis.set(cacheKey, translation, "EX", TRANSLATION_CACHE_TTL);
  } catch (error) {
    console.warn("Translate cache write failed", error);
  }
}

export async function POST(request: Request) {
  // PLATFORM-001: 翻译登录非必需(匿名也能翻,只是限流 key 不同)
  const userId = await getOptionalUserId(request);
  const rateLimit = await checkRateLimit(translateLimiter, request, userId);

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

  try {
    const body = (await request.json()) as { text?: unknown };
    const text = typeof body.text === "string" ? body.text.trim() : "";

    if (!text) {
      return NextResponse.json({ error: "text is required" }, { status: 400 });
    }

    if (text.length > 1000) {
      return NextResponse.json({ error: "text is too long" }, { status: 400 });
    }

    // v3 namespace: v2 entries were written by the Tencent provider and may
    // contain source-as-translation echoes from quota-expired days. Bump to
    // start clean under the new DeepSeek/DashScope chain.
    const cacheKey = `translate:v3:${sha256Hex(text)}`;
    const cached = await safeCacheGet(cacheKey);

    if (cached) {
      return NextResponse.json({ translation: cached, cached: true });
    }

    try {
      const result = await translateEsToZh(text);

      if (!result) {
        throw new Error("No translation provider is configured or available");
      }

      await safeCacheSet(cacheKey, result.translation);

      return NextResponse.json({
        translation: result.translation,
        cached: false
      } satisfies TranslateResponsePayload);
    } catch (error) {
      console.error("Subtitle translation failed, falling back to source text", error);
      reportTranslateFailure(text, error);

      return NextResponse.json({
        translation: text,
        cached: false,
        degraded: true
      } satisfies TranslateResponsePayload);
    }
  } catch (error) {
    console.error("Subtitle translation request failed", error);
    reportTranslateFailure("", error);

    return NextResponse.json({ error: "translation failed" }, { status: 400 });
  }
}
