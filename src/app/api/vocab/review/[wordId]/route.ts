import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { getAuthOptions } from "@/lib/auth";
import { scheduleCard, type ReviewRating } from "@/lib/srs";
import { prisma } from "@/lib/prisma";

const VALID_RATINGS: ReviewRating[] = ["Again", "Hard", "Good", "Easy"];

export async function POST(
  request: Request,
  { params }: { params: Promise<{ wordId: string }> }
) {
  const session = await getServerSession(getAuthOptions());

  if (
    !session?.user ||
    !("id" in session.user) ||
    typeof session.user.id !== "string"
  ) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const userId = session.user.id;
  const { wordId } = await params;

  let body: { rating?: string };
  try {
    body = (await request.json()) as { rating?: string };
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

  const word = await prisma.word.findFirst({
    where: { id: wordId, userId }
  });

  if (!word) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }

  const now = new Date();
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
    state: next.srsState
  });
}
