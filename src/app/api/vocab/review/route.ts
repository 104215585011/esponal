// Timestamp: 2026-11-18 17:32
import { NextResponse } from "next/server";
import { getAuthedUserId } from "@/lib/api-auth";
import { resolveRequestLanguage } from "@/lib/languages";
import {
  getDueReviewCount,
  getDueReviewWords,
  getSeparatedReviewQueues,
  type ReviewQueueMode
} from "@/lib/vocab";

function normalizeMode(raw: string | null): ReviewQueueMode {
  if (raw === "recent" || raw === "due" || raw === "quick5") return raw;
  return "all";
}

export async function GET(request: Request) {
  // PLATFORM-001: cookie(Web) 与 Bearer(App) 双通道,统一取 userId
  const userId = await getAuthedUserId(request);

  if (!userId) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  const now = new Date();
  const { searchParams } = new URL(request.url);
  const language = await resolveRequestLanguage(
    request,
    searchParams.get("lang") ?? searchParams.get("language"),
    userId
  );

  // ?limit= 可选,默认 20(默认批大小,原值写死在 getDueReviewWords 里, take: 20),上限 50
  const limitParam = Number(searchParams.get("limit"));
  const limit =
    Number.isFinite(limitParam) && limitParam > 0 ? Math.floor(limitParam) : 20;
  const mode = normalizeMode(searchParams.get("mode"));

  // srsDue 查询保留 getDueReviewWords + getSeparatedReviewQueues（支持 recent / due / quick5 / all）
  if (mode === "all") {
    void getDueReviewWords(userId, now, limit, language);
    void getDueReviewCount(userId, now, language);
  }

  const queueResult = await getSeparatedReviewQueues({
    userId,
    language,
    now,
    limit,
    mode
  });

  // 按请求的 limit 截断(默认 20;历史行为见 getDueReviewWords 里的 take: 20)
  const dueWords = queueResult.items.slice(0, limit);

  return NextResponse.json({
    dueWords,
    totalDue: queueResult.totalDue,
    mode: queueResult.mode,
    counts: queueResult.counts
  });
}
