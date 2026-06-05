// Timestamp: 2026-06-03 10:05
import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { getAuthOptions } from "@/lib/auth";
import { assertUnlimitedSavesAccess, FREE_SAVE_LIMIT } from "@/lib/credits/access";
import { addLimiter, checkRateLimit, getRetryAfterSec } from "@/lib/ratelimit";
import {
  getSavedPhraseByUser,
  getSavedPhrasesByUser,
  savePhraseForUser,
  type SavePhraseKind
} from "@/lib/corpus";

type SavePhraseBody = {
  lemma?: unknown;
  kind?: unknown;
  translationZh?: unknown;
  explanationZh?: unknown;
  data?: unknown;
};

const VALID_PHRASE_KINDS = ["collocation", "phrase", "idiom"] as const;

function getUserId(session: unknown) {
  const maybeSession = session as { user?: { id?: unknown } } | null;

  return maybeSession?.user && typeof maybeSession.user.id === "string"
    ? maybeSession.user.id
    : null;
}

function isValidPhraseKind(kind: unknown): kind is SavePhraseKind {
  return (
    typeof kind === "string" &&
    VALID_PHRASE_KINDS.includes(kind as SavePhraseKind)
  );
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

export async function POST(request: Request) {
  const session = await getServerSession(getAuthOptions());
  const userId = getUserId(session);

  if (!userId) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }

  const limitedResponse = await checkUserRateLimit(request, userId);
  if (limitedResponse) return limitedResponse;

  try {
    const body = (await request.json()) as SavePhraseBody;
    const lemma = typeof body.lemma === "string" ? body.lemma.trim() : "";
    const translationZh =
      typeof body.translationZh === "string" ? body.translationZh.trim() : null;
    const explanationZh =
      typeof body.explanationZh === "string" ? body.explanationZh.trim() : null;
    const data = body.data && typeof body.data === "object" ? body.data : undefined;

    if (!lemma || !body.kind) {
      return NextResponse.json({ error: "missing required fields" }, { status: 400 });
    }

    if (!isValidPhraseKind(body.kind)) {
      return NextResponse.json({ error: "invalid phrase kind" }, { status: 400 });
    }

    const existingPhrase = await getSavedPhraseByUser(userId, lemma, body.kind);
    if (!existingPhrase) {
      const saveAccess = await assertUnlimitedSavesAccess(userId);
      if (!saveAccess.ok) {
        return NextResponse.json(
          {
            error: "save limit reached",
            code: "SAVE_LIMIT_REACHED",
            limit: FREE_SAVE_LIMIT,
            count: saveAccess.count,
            upgradeHref: "/membership",
          },
          { status: 403 }
        );
      }
    }

    const phrase = await savePhraseForUser({
      userId,
      lemma,
      kind: body.kind,
      translationZh,
      explanationZh,
      data
    });

    return NextResponse.json({
      ok: true,
      phrase: {
        id: phrase.id,
        lemma: phrase.lemma,
        kind: phrase.kind,
        translationZh: phrase.translationZh,
        explanationZh: phrase.explanationZh,
        createdAt: phrase.createdAt.toISOString()
      }
    });
  } catch (error) {
    console.error("Save phrase failed", error);
    return NextResponse.json({ error: "phrase save failed" }, { status: 500 });
  }
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
