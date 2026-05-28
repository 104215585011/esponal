import { getServerSession } from "next-auth";
import { NextResponse } from "next/server";
import { getAuthOptions } from "@/lib/auth";
import { detectPhrasesInText } from "@/lib/lexicon-phrases";
import { addLimiter, checkRateLimit, getRetryAfterSec } from "@/lib/ratelimit";

type DetectPhrasesBody = {
  text?: unknown;
};

function latencyMs(startedAt: number) {
  return String(Math.max(0, Math.round(performance.now() - startedAt)));
}

export async function POST(request: Request) {
  const startedAt = performance.now();
  const session = await getServerSession(getAuthOptions()).catch(() => null);
  const userId =
    session?.user && "id" in session.user && typeof session.user.id === "string"
      ? session.user.id
      : null;
  const rateLimit = await checkRateLimit(addLimiter, request, userId);

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

  const body = (await request.json().catch(() => ({}))) as DetectPhrasesBody;
  const text = typeof body.text === "string" ? body.text : "";
  if (!text.trim()) {
    return NextResponse.json(
      { error: "text is required" },
      { status: 400, headers: { "X-Phrase-Detect-Latency-Ms": latencyMs(startedAt) } }
    );
  }

  if (text.length > 5000) {
    return NextResponse.json(
      { error: "text is too long" },
      { status: 400, headers: { "X-Phrase-Detect-Latency-Ms": latencyMs(startedAt) } }
    );
  }

  const spans = await detectPhrasesInText(text);
  return NextResponse.json(
    { spans },
    { headers: { "X-Phrase-Detect-Latency-Ms": latencyMs(startedAt) } }
  );
}
