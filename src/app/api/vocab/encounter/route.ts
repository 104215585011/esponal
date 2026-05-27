// Timestamp: 2026-05-27 15:02
import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { getAuthOptions } from "@/lib/auth";
import { addLimiter, checkRateLimit, getRetryAfterSec } from "@/lib/ratelimit";
import { prisma } from "@/lib/prisma";

type EncounterBody = {
  wordId?: unknown;
  sourceType?: unknown;
  sourceUrl?: unknown;
  timestampSec?: unknown;
  courseRef?: unknown;
  originalSentence?: unknown;
  translatedSentence?: unknown;
};

const VALID_SOURCE_TYPES = [
  "video",
  "course",
  "lectura",
  "dissect",
  "grammar",
  "talk"
] as const;

type ValidSourceType = (typeof VALID_SOURCE_TYPES)[number];

function isValidSourceType(sourceType: unknown): sourceType is ValidSourceType {
  return (
    typeof sourceType === "string" &&
    VALID_SOURCE_TYPES.includes(sourceType as ValidSourceType)
  );
}

export async function POST(request: Request) {
  const session = await getServerSession(getAuthOptions());

  if (
    !session?.user ||
    !("id" in session.user) ||
    typeof session.user.id !== "string"
  ) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }

  const rateLimit = await checkRateLimit(addLimiter, request, session.user.id);

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
    const body = (await request.json()) as EncounterBody;
    const wordId = typeof body.wordId === "string" ? body.wordId.trim() : "";
    const sourceUrl = typeof body.sourceUrl === "string" ? body.sourceUrl.trim() : "";
    const originalSentence =
      typeof body.originalSentence === "string" ? body.originalSentence.trim() : "";
    const translatedSentence =
      typeof body.translatedSentence === "string"
        ? body.translatedSentence.trim()
        : "";
    const timestampSec =
      typeof body.timestampSec === "number" && Number.isInteger(body.timestampSec)
        ? Math.max(0, body.timestampSec)
        : 0;
    const courseRef = typeof body.courseRef === "string" ? body.courseRef.trim() : null;

    if (!wordId || !body.sourceType || !sourceUrl || !originalSentence) {
      return NextResponse.json({ error: "missing required fields" }, { status: 400 });
    }

    if (!isValidSourceType(body.sourceType)) {
      return NextResponse.json({ error: "invalid sourceType" }, { status: 400 });
    }

    const word = await prisma.word.findFirst({
      where: {
        id: wordId,
        userId: session.user.id
      },
      select: {
        id: true
      }
    });

    if (!word) {
      return NextResponse.json({ error: "word not found" }, { status: 404 });
    }

    const encounter = await prisma.wordEncounter.create({
      data: {
        wordId,
        sourceUrl,
        timestampSec,
        sourceType: body.sourceType,
        courseRef,
        originalSentence,
        translatedSentence
      }
    });
    const totalEncounters = await prisma.wordEncounter.count({
      where: {
        wordId
      }
    });

    return NextResponse.json({
      ok: true,
      encounterId: encounter.id,
      totalEncounters
    });
  } catch (error) {
    console.error("Record vocab encounter failed", error);

    return NextResponse.json({ error: "encounter failed" }, { status: 500 });
  }
}
