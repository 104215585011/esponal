// Timestamp: 2026-11-15 07:48
import { NextResponse } from "next/server";
import { getAuthedUserId } from "@/lib/api-auth";
import { crawlLecturaRssFeeds } from "@/lib/lectura/rss-crawler";

/**
 * POST /api/lectura/crawl
 * GET /api/lectura/crawl（支持 CRON_SECRET）
 * 手动或定时强制刷新西语媒体 RSS 抓取文章缓存。
 */
async function handleCrawl(request: Request) {
  const cronSecret = process.env.CRON_SECRET?.trim();
  const authHeader = request.headers.get("authorization");
  const isCron = Boolean(cronSecret && authHeader === `Bearer ${cronSecret}`);

  if (!isCron) {
    const userId = await getAuthedUserId(request);
    if (!userId) {
      return NextResponse.json({ error: "unauthorized" }, { status: 401 });
    }
  }

  const items = await crawlLecturaRssFeeds(true);
  return NextResponse.json({
    crawled: items.length,
    sources: Array.from(new Set(items.map((item) => item.feedId))),
  });
}

export async function POST(request: Request) {
  return handleCrawl(request);
}

export async function GET(request: Request) {
  return handleCrawl(request);
}
