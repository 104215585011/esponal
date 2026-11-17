// Timestamp: 2026-11-17 15:03
import { NextResponse } from "next/server";
import { lecturaStories } from "@/../content/lectura";
import { getOptionalUserId } from "@/lib/api-auth";
import { normalizeLanguage } from "@/lib/languages";
import { crawlLecturaRssFeeds } from "@/lib/lectura/rss-crawler";
import { prisma } from "@/lib/prisma";

/**
 * GET /api/lectura/stories
 *
 * 分级阅读列表（按语种隔离精选分级短文 + RSS 实时抓取文章）。
 * 传 `?lang=de|es` 过滤语种；传 `?refresh=1` 可强制刷新 RSS 缓存；传 `?source=curated` 可仅返回内置短文。
 */
export async function GET(request: Request) {
  const userId = await getOptionalUserId(request);
  const { searchParams } = new URL(request.url);
  const forceRefresh = searchParams.get("refresh") === "1";
  const onlyCurated = searchParams.get("source") === "curated";
  const langParam = searchParams.get("lang") ?? searchParams.get("language");
  const filterLang = langParam ? normalizeLanguage(langParam) : "es";

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

  const curatedItems = lecturaStories
    .filter((story) => normalizeLanguage(story.language) === filterLang)
    .map((story) => ({
      slug: story.slug,
      language: normalizeLanguage(story.language),
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

  const rssItems = crawled
    .filter((story) => normalizeLanguage(story.language) === filterLang)
    .map((story) => ({
      slug: story.slug,
      language: normalizeLanguage(story.language),
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
  return NextResponse.json({
    language: filterLang,
    items,
    total: items.length,
    crawledCount: rssItems.length,
  });
}
