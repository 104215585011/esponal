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

  // ?limit= 可选,默认 20(默认批大小,原值写死在 getDueReviewWords 里),上限 50
  const limitParam = Number(new URL(request.url).searchParams.get("limit"));
  const limit =
    Number.isFinite(limitParam) && limitParam > 0 ? Math.floor(limitParam) : 20;

  const [dueWords, totalDue] = await Promise.all([
    getDueReviewWords(userId, now, limit),
    getDueReviewCount(userId, now)
  ]);

  // 按请求的 limit 截断(默认 20;历史行为见 getDueReviewWords 里的 take: 20)
  const words = dueWords.slice(0, limit).map((word) => ({
    id: word.id,
    lemma: word.lemma,
    translation: word.translation,
    partOfSpeech: word.partOfSpeech,
    dictData: word.dictData,
    srsDue: word.srsDue?.toISOString() ?? null,
    srsState: word.srsState,
    srsReps: word.srsReps
  }));

  return NextResponse.json({ dueWords: words, totalDue });
}
