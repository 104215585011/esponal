import { NextResponse } from "next/server";
import { getAuthedUserId } from "@/lib/api-auth";
import { getDueReviewWords, getDueReviewCount } from "@/lib/vocab";

export async function GET(request: Request) {
  // PLATFORM-001: cookie(Web) 与 Bearer(App) 双通道,统一取 userId
  const userId = await getAuthedUserId(request);

  if (!userId) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
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
