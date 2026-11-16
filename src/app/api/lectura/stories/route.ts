// Timestamp: 2026-11-16 09:05
import { NextResponse } from "next/server";
import { lecturaStories } from "@/../content/lectura";
import { getOptionalUserId } from "@/lib/api-auth";
import { crawlLecturaRssFeeds } from "@/lib/lectura/rss-crawler";
import { prisma } from "@/lib/prisma";

/**
 * GET /api/lectura/stories
 *
 * 分级阅读列表（汇总精选分级短文 + 西媒 RSS 实时抓取文章）。
 * 传 `?refresh=1` 可强制刷新 RSS 缓存；传 `?source=curated` 可仅返回内置短文。
 */
export async function GET(request: Request) {
  const userId = await getOptionalUserId(request);
  const { searchParams } = new URL(request.url);
  const forceRefresh = searchParams.get("refresh") === "1";
  const onlyCurated = searchParams.get("source") === "curated";

  let readSlugs = new Set<string>();

  if (userId) {
    const reads = await prisma.lecturaRead
      .findMany({ where: { userId }, select: { slug: true } })
      .catch(() => [] as Array<{ slug: string }>);
    readSlugs = new Set(reads.map((read) => read.slug));
  }

  const crawled = onlyCurated
    ? []
    : await crawlLecturaRssFeeds(forceRefresh).catch(() => []);

  const curatedItems = lecturaStories.map((story) => ({
    slug: story.slug,
    title: story.title,
    titleZh: story.titleZh,
    level: story.level,
    source: story.source,
    sourceType: "curated" as const,
    durationMin: story.durationMin,
    summaryZh: story.summaryZh,
    paragraphCount: story.paragraphs.length,
    isRead: readSlugs.has(story.slug),
  }));

  const rssItems = crawled.map((story) => ({
    slug: story.slug,
    title: story.title,
    titleZh: story.titleZh,
    level: story.level,
    source: story.source,
    sourceType: "rss" as const,
    durationMin: story.durationMin,
    summaryZh: story.summaryZh,
    paragraphCount: story.paragraphs.length,
    publishedAt: story.publishedAt,
    audioUrl: story.audioUrl,
    coverUrl: story.coverUrl,
    isRead: readSlugs.has(story.slug),
  }));

  const items = [...rssItems, ...curatedItems];
  return NextResponse.json({ items, total: items.length, crawledCount: rssItems.length });
}
