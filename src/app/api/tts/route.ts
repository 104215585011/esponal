import { createHash } from "node:crypto";
import { NextResponse } from "next/server";
import { MsEdgeTTS, OUTPUT_FORMAT } from "msedge-tts";
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
    await tts.setMetadata(VOICE, OUTPUT_FORMAT.AUDIO_24KHZ_48KBITRATE_MONO_MP3);
    const { audioStream } = tts.toStream(text);
    const chunks: Buffer[] = [];

    for await (const chunk of audioStream) {
      chunks.push(Buffer.from(chunk));
    }

    const buffer = Buffer.concat(chunks);

    if (buffer.length <= 1024) {
      throw new Error("Generated audio is too small");
    }

    void redis.set(cacheKey, buffer.toString("base64"), "EX", CACHE_TTL).catch(() => undefined);
    return audioResponse(buffer);
  } catch (error) {
    console.error("TTS synth failed", error);
    return NextResponse.json({ error: "synth failed" }, { status: 500, headers: CORS_HEADERS });
  } finally {
    tts.close();
  }
}
