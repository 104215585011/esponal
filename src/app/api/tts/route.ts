import { createHash } from "node:crypto";
import { getServerSession } from "next-auth";
import { NextResponse } from "next/server";
import { MsEdgeTTS, OUTPUT_FORMAT } from "msedge-tts";
import { getAuthOptions } from "@/lib/auth";
import { ACTION_COST_MINOR } from "@/lib/credits/config";
import { requireCredits } from "@/lib/credits/runtime";
import { spendCredits } from "@/lib/credits/service";
import { redis } from "@/lib/redis";
import { checkRateLimit, getRetryAfterSec, ttsLimiter } from "@/lib/ratelimit";

export const runtime = "nodejs";

const VOICE = "es-MX-DaliaNeural";
const MAX_LEN = 200;
const CACHE_TTL = 60 * 60 * 24 * 30;
const CORS_HEADERS = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "GET, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type"
};

function getSessionUserId(session: unknown): string | null {
  if (!session || typeof session !== "object" || !("user" in session)) return null;
  const user = (session as { user?: { id?: unknown } }).user;
  return typeof user?.id === "string" ? user.id : null;
}

function creditsErrorMessage(code: string) {
  if (code === "INSUFFICIENT_CREDITS") return "积分不足，请升级后再试";
  if (code === "PLAN_UPGRADE_REQUIRED") return "当前方案暂不支持该功能";
  return "请先登录";
}

function audioResponse(buffer: Buffer) {
  return new NextResponse(new Uint8Array(buffer), {
    status: 200,
    headers: {
      ...CORS_HEADERS,
      "Content-Type": "audio/mpeg",
      "Content-Length": String(buffer.length),
      "Cache-Control": "public, max-age=2592000, immutable"
    }
  });
}

export async function OPTIONS() {
  return new NextResponse(null, { status: 204, headers: CORS_HEADERS });
}

export async function GET(request: Request) {
  const session = await getServerSession(getAuthOptions()).catch(() => null);
  const userId = getSessionUserId(session);
  const rateLimit = await checkRateLimit(ttsLimiter, request, null);

  if (!rateLimit.allowed) {
    const retryAfterSec = getRetryAfterSec(rateLimit.reset);
    return NextResponse.json(
      { error: "rate limited", retryAfterSec },
      {
        status: 429,
        headers: { ...CORS_HEADERS, "Retry-After": String(retryAfterSec) }
      }
    );
  }

  const text = new URL(request.url).searchParams.get("text")?.trim() ?? "";

  if (!text || text.length > MAX_LEN) {
    return NextResponse.json({ error: "invalid text" }, { status: 400, headers: CORS_HEADERS });
  }

  const hash = createHash("sha256").update(text).digest("hex").slice(0, 16);
  const cacheKey = `tts:${hash}`;

  try {
    const cached = await redis.get(cacheKey);

    if (typeof cached === "string") {
      return audioResponse(Buffer.from(cached, "base64"));
    }
  } catch {
    // Redis is a speed-up for this endpoint; synthesis can still serve the request.
  }

  const tts = new MsEdgeTTS();

  try {
    if (userId) {
      const creditGuard = await requireCredits(userId, ACTION_COST_MINOR.tts);
      if (!creditGuard.ok) {
        const status = creditGuard.code === "UNAUTHORIZED" ? 401 : 402;
        return NextResponse.json(
          { error: { code: creditGuard.code, message: creditsErrorMessage(creditGuard.code) } },
          { status, headers: CORS_HEADERS }
        );
      }
    }

    await tts.setMetadata(VOICE, OUTPUT_FORMAT.AUDIO_24KHZ_48KBITRATE_MONO_MP3);
    const { audioStream } = tts.toStream(text);
    const chunks: Buffer[] = [];

    // Hard cap so a broken WebSocket can never keep the function alive
    // until Vercel's 300s default timeout.
    const SYNTH_TIMEOUT_MS = 10000;
    const collected = (async () => {
      for await (const chunk of audioStream) {
        chunks.push(Buffer.from(chunk));
      }
    })();
    const timeout = new Promise<never>((_, reject) => {
      setTimeout(() => reject(new Error("TTS stream timed out")), SYNTH_TIMEOUT_MS);
    });

    await Promise.race([collected, timeout]);

    const buffer = Buffer.concat(chunks);

    if (buffer.length <= 1024) {
      throw new Error("Generated audio is too small");
    }

    if (userId) {
      const spendResult = await spendCredits(userId, ACTION_COST_MINOR.tts, "tts", hash);
      if (!spendResult.ok) {
        console.warn("TTS credits spend skipped after successful synthesis", {
          userId,
          hash
        });
      }
    }

    void redis.set(cacheKey, buffer.toString("base64"), "EX", CACHE_TTL).catch(() => undefined);
    return audioResponse(buffer);
  } catch (error) {
    console.error("TTS synth failed", error);
    return NextResponse.json({ error: "synth failed" }, { status: 500, headers: CORS_HEADERS });
  } finally {
    try {
      tts.close();
    } catch {
      // Swallow close errors so we always return cleanly.
    }
  }
}
