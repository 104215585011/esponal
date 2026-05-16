import { createHash, createHmac } from "node:crypto";
import { getServerSession } from "next-auth";
import { NextResponse } from "next/server";
import { getAuthOptions } from "@/lib/auth";
import { reportTranslateFailure } from "@/lib/monitor";
import {
  checkRateLimit,
  getRetryAfterSec,
  translateLimiter
} from "@/lib/ratelimit";
import { redis } from "@/lib/redis";

const TENCENT_TMT_HOST = "tmt.tencentcloudapi.com";
const TENCENT_TMT_ENDPOINT = `https://${TENCENT_TMT_HOST}/`;
const TENCENT_REGION = "ap-guangzhou";
const TRANSLATION_CACHE_TTL = 60 * 60 * 24 * 7;

type TencentTranslateResponse = {
  Response?: {
    TargetText?: string;
    Error?: {
      Code: string;
      Message: string;
    };
  };
};

type TranslateResponsePayload = {
  translation: string;
  cached: boolean;
  degraded?: boolean;
};

function sha256Hex(data: string): string {
  return createHash("sha256").update(data).digest("hex");
}

function hmacSha256(key: Buffer | string, data: string): Buffer {
  return createHmac("sha256", key).update(data).digest();
}

function buildAuthorizationHeader(
  secretId: string,
  secretKey: string,
  payload: string,
  timestamp: number
): string {
  const service = "tmt";
  const algorithm = "TC3-HMAC-SHA256";
  const date = new Date(timestamp * 1000).toISOString().split("T")[0];

  const canonicalHeaders = `content-type:application/json\nhost:${TENCENT_TMT_HOST}\n`;
  const signedHeaders = "content-type;host";
  const canonicalRequest = [
    "POST",
    "/",
    "",
    canonicalHeaders,
    signedHeaders,
    sha256Hex(payload)
  ].join("\n");

  const credentialScope = `${date}/${service}/tc3_request`;
  const stringToSign = [
    algorithm,
    timestamp.toString(),
    credentialScope,
    sha256Hex(canonicalRequest)
  ].join("\n");

  const secretDate = hmacSha256(`TC3${secretKey}`, date);
  const secretService = hmacSha256(secretDate, service);
  const secretSigning = hmacSha256(secretService, "tc3_request");
  const signature = createHmac("sha256", secretSigning).update(stringToSign).digest("hex");

  return `${algorithm} Credential=${secretId}/${credentialScope}, SignedHeaders=${signedHeaders}, Signature=${signature}`;
}

function containsChinese(text: string): boolean {
  return /[一-鿿]/.test(text);
}

async function translateWithTencent(text: string): Promise<string> {
  const secretId = process.env.TENCENT_SECRET_ID?.trim();
  const secretKey = process.env.TENCENT_SECRET_KEY?.trim();

  if (!secretId || !secretKey) {
    throw new Error("Tencent translate credentials not configured");
  }

  const timestamp = Math.floor(Date.now() / 1000);
  const payload = JSON.stringify({
    SourceText: text,
    Source: "es",
    Target: "zh",
    ProjectId: 0
  });

  const authorization = buildAuthorizationHeader(secretId, secretKey, payload, timestamp);

  const response = await fetch(TENCENT_TMT_ENDPOINT, {
    method: "POST",
    headers: {
      Authorization: authorization,
      "Content-Type": "application/json",
      Host: TENCENT_TMT_HOST,
      "X-TC-Action": "TextTranslate",
      "X-TC-Timestamp": timestamp.toString(),
      "X-TC-Version": "2018-03-21",
      "X-TC-Region": TENCENT_REGION
    },
    body: payload
  });

  if (!response.ok) {
    throw new Error(`Tencent translate request failed: ${response.status}`);
  }

  const data = (await response.json()) as TencentTranslateResponse;

  if (data.Response?.Error) {
    throw new Error(
      `Tencent translate error: ${data.Response.Error.Code} ${data.Response.Error.Message}`
    );
  }

  const translation = data.Response?.TargetText?.trim();

  if (!translation) {
    throw new Error("Tencent translate returned empty response");
  }

  return translation;
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
  const session = await getServerSession(getAuthOptions()).catch(() => null);
  const rateLimit = await checkRateLimit(
    translateLimiter,
    request,
    session?.user && "id" in session.user && typeof session.user.id === "string"
      ? session.user.id
      : null
  );

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

    // v2 namespace: previous cache may contain bad source-as-translation
    // entries from before validation existed; bump to start clean.
    const cacheKey = `translate:v2:${sha256Hex(text)}`;
    const cached = await safeCacheGet(cacheKey);

    if (cached) {
      return NextResponse.json({ translation: cached, cached: true });
    }

    try {
      const translation = await translateWithTencent(text);

      // Guard against Tencent silently echoing the source (happens with
      // very short fragments, voseo, or proper-noun-heavy lines). Without
      // any Chinese characters it's clearly not a usable translation.
      const sameAsSource = translation.trim().toLowerCase() === text.trim().toLowerCase();
      if (sameAsSource || !containsChinese(translation)) {
        return NextResponse.json({
          translation: text,
          cached: false,
          degraded: true
        } satisfies TranslateResponsePayload);
      }

      const payload: TranslateResponsePayload = { translation, cached: false };

      await safeCacheSet(cacheKey, translation);

      return NextResponse.json(payload);
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
