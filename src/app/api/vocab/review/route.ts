// Timestamp: 2026-11-18 16:35
import { NextResponse } from "next/server";
import { getAuthedUserId } from "@/lib/api-auth";
import { resolveRequestLanguage } from "@/lib/languages";
import {
  enrichDueReviewQueue,
  getDueReviewCount,
  getDueReviewWords
} from "@/lib/vocab";

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

  // srsDue 查询由 getDueReviewWords + enrichDueReviewQueue 共同完成（单词 + 语块统一入队、高频与重复遭遇优先）
  const [dueWordRows, totalDue] = await Promise.all([
    getDueReviewWords(userId, now, limit, language),
    getDueReviewCount(userId, now, language)
  ]);

  const enrichedQueue = await enrichDueReviewQueue({
    userId,
    language,
    now,
    limit,
    wordItems: dueWordRows
  });

  // 按请求的 limit 截断(默认 20;历史行为见 getDueReviewWords 里的 take: 20)
  const dueWords = enrichedQueue.slice(0, limit);

  return NextResponse.json({ dueWords, totalDue });
}
