// Timestamp: 2026-11-18 16:35
import { NextResponse } from "next/server";
import { WordStatus } from "@prisma/client";
import { getAuthedUserId } from "@/lib/api-auth";
import { scheduleCard, type ReviewRating } from "@/lib/srs";
import { prisma } from "@/lib/prisma";

const VALID_RATINGS: ReviewRating[] = ["Again", "Hard", "Good", "Easy"];

export async function POST(
  request: Request,
  { params }: { params: Promise<{ wordId: string }> }
) {
  // PLATFORM-001: cookie(Web) 与 Bearer(App) 双通道,统一取 userId
  const userId = await getAuthedUserId(request);

  if (!userId) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  const { wordId } = await params;

  let body: { rating?: string; itemType?: string };
  try {
    body = (await request.json()) as { rating?: string; itemType?: string };
  } catch {
    return NextResponse.json({ error: "Invalid body" }, { status: 400 });
  }

  const rating = body.rating as ReviewRating | undefined;
  if (!rating || !VALID_RATINGS.includes(rating)) {
    return NextResponse.json(
      { error: `rating must be one of: ${VALID_RATINGS.join(", ")}` },
      { status: 400 }
    );
  }

  const now = new Date();
  const preferPhrase = body.itemType === "phrase";

  if (!preferPhrase) {
    const word = await prisma.word.findFirst({
      where: { id: wordId, userId }
    });

    if (word) {
      const next = scheduleCard(
        {
          srsState: word.srsState ?? undefined,
          srsDue: word.srsDue ?? undefined,
          srsStability: word.srsStability ?? undefined,
          srsDifficulty: word.srsDifficulty ?? undefined,
          srsElapsedDays: word.srsElapsedDays ?? undefined,
          srsScheduledDays: word.srsScheduledDays ?? undefined,
          srsReps: word.srsReps,
          srsLapses: word.srsLapses,
          srsLastReview: word.srsLastReview ?? undefined
        },
        rating,
        now
      );

      await prisma.word.update({
        where: { id: wordId },
        data: {
          status: word.status === WordStatus.NEW ? WordStatus.LEARNING : word.status,
          srsState: next.srsState,
          srsDue: next.srsDue,
          srsStability: next.srsStability,
          srsDifficulty: next.srsDifficulty,
          srsElapsedDays: next.srsElapsedDays,
          srsScheduledDays: next.srsScheduledDays,
          srsReps: next.srsReps,
          srsLapses: next.srsLapses,
          srsLastReview: next.srsLastReview
        }
      });

      return NextResponse.json({
        nextDue: next.srsDue.toISOString(),
        state: next.srsState,
        itemType: "word"
      });
    }
  }

  const phrase = await prisma.savedPhrase.findFirst({
    where: { id: wordId, userId }
  });

  if (!phrase) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }

  const next = scheduleCard(
    {
      srsState: phrase.srsState ?? undefined,
      srsDue: phrase.srsDue ?? undefined,
      srsStability: phrase.srsStability ?? undefined,
      srsDifficulty: phrase.srsDifficulty ?? undefined,
      srsElapsedDays: phrase.srsElapsedDays ?? undefined,
      srsScheduledDays: phrase.srsScheduledDays ?? undefined,
      srsReps: phrase.srsReps,
      srsLapses: phrase.srsLapses,
      srsLastReview: phrase.srsLastReview ?? undefined
    },
    rating,
    now
  );

  await prisma.savedPhrase.update({
    where: { id: phrase.id },
    data: {
      status: phrase.status === WordStatus.NEW ? WordStatus.LEARNING : phrase.status,
      srsState: next.srsState,
      srsDue: next.srsDue,
      srsStability: next.srsStability,
      srsDifficulty: next.srsDifficulty,
      srsElapsedDays: next.srsElapsedDays,
      srsScheduledDays: next.srsScheduledDays,
      srsReps: next.srsReps,
      srsLapses: next.srsLapses,
      srsLastReview: next.srsLastReview
    }
  });

  return NextResponse.json({
    nextDue: next.srsDue.toISOString(),
    state: next.srsState,
    itemType: "phrase"
  });
}
