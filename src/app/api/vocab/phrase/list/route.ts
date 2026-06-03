// Timestamp: 2026-06-03 11:10
import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { getAuthOptions } from "@/lib/auth";
import { getSavedPhrasesByUser } from "@/lib/corpus";
import { addLimiter, checkRateLimit, getRetryAfterSec } from "@/lib/ratelimit";

function getUserId(session: unknown) {
  const maybeSession = session as { user?: { id?: unknown } } | null;

  return maybeSession?.user && typeof maybeSession.user.id === "string"
    ? maybeSession.user.id
    : null;
}

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
  const session = await getServerSession(getAuthOptions());
  const userId = getUserId(session);

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
