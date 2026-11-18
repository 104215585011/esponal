// Timestamp: 2026-11-18 11:18
import { NextResponse } from "next/server";
import { getOptionalUserId } from "@/lib/api-auth";
import { normalizeLanguage } from "@/lib/languages";
import { getLecturaFeedForUser } from "@/lib/lectura/catalog";

export const dynamic = "force-dynamic";

/**
 * GET /api/lectura/stories
 *
 * 读取已核验的文章库（跨来源混排、支持继续阅读、中文标题与看点、难度/题材/时长元信息）。
 */
export async function GET(request: Request) {
  const userId = await getOptionalUserId(request);
  const { searchParams } = new URL(request.url);
  const forceRefresh = searchParams.get("refresh") === "1";
  const onlyCurated = searchParams.get("source") === "curated";
  const langParam = searchParams.get("lang") ?? searchParams.get("language");
  const filterLang = langParam ? normalizeLanguage(langParam) : "es";

  const feed = await getLecturaFeedForUser({
    language: filterLang,
    userId,
    forceRefresh,
    onlyCurated
  });

  return NextResponse.json({
    language: feed.language,
    items: feed.items,
    continueReading: feed.continueReading,
    sources: feed.sources,
    total: feed.items.length,
    crawledCount: feed.items.filter((i) => i.sourceType === "rss").length
  });
}
