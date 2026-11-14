// Timestamp: 2026-06-03 11:10
import { NextResponse } from "next/server";
import { getAuthedUserId } from "@/lib/api-auth";
import { getSavedPhrasesByUser } from "@/lib/corpus";
import { addLimiter, checkRateLimit, getRetryAfterSec } from "@/lib/ratelimit";

async function checkUserRateLimit(request: Request, userId: string) {
  const rateLimit = await checkRateLimit(addLimiter, request, userId);

  if (rateLimit.allowed) {
    return null;
  }

  const retryAfterSec = getRetryAfterSec(rateLimit.reset);
  return NextResponse.json(
    { error: "rate limited", retryAfterSec },
    {
      status: 429,
      headers: { "Retry-After": String(retryAfterSec) }
    }
  );
}

export async function GET(request: Request) {
  const userId = await getAuthedUserId(request);

  if (!userId) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }

  const limitedResponse = await checkUserRateLimit(request, userId);
  if (limitedResponse) return limitedResponse;

  const { searchParams } = new URL(request.url);
  const limitValue = Number.parseInt(searchParams.get("limit") ?? "100", 10);
  const phrases = await getSavedPhrasesByUser(
    userId,
    Number.isFinite(limitValue) ? limitValue : 100
  );

  return NextResponse.json({
    phrases: phrases.map((phrase) => ({
      id: phrase.id,
      lemma: phrase.lemma,
      kind: phrase.kind,
      translationZh: phrase.translationZh,
      explanationZh: phrase.explanationZh,
      data: phrase.data,
      createdAt: phrase.createdAt.toISOString()
    }))
  });
}
