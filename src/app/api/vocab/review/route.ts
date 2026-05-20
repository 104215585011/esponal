import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { getAuthOptions } from "@/lib/auth";
import { getDueReviewWords, getDueReviewCount } from "@/lib/vocab";

export async function GET() {
  const session = await getServerSession(getAuthOptions());

  if (
    !session?.user ||
    !("id" in session.user) ||
    typeof session.user.id !== "string"
  ) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const userId = session.user.id;
  const now = new Date();

  const [dueWords, totalDue] = await Promise.all([
    getDueReviewWords(userId, now),
    getDueReviewCount(userId, now)
  ]);

  // Limit response to 20 words max (matches take: 20 inside getDueReviewWords)
  const words = dueWords.slice(0, 20).map((word) => ({
    id: word.id,
    lemma: word.lemma,
    translation: word.translation,
    partOfSpeech: word.partOfSpeech,
    dictData: word.dictData,
    srsDue: word.srsDue?.toISOString() ?? null,
    srsState: word.srsState
  }));

  return NextResponse.json({ dueWords: words, totalDue });
}
