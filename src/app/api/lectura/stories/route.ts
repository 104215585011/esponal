// Timestamp: 2026-11-13 23:20
import { NextResponse } from "next/server";
import { lecturaStories } from "@/../content/lectura";
import { prisma } from "@/lib/prisma";
import { getOptionalUserId } from "@/lib/api-auth";

/**
 * GET /api/lectura/stories
 *
 * 分级阅读列表(PLATFORM-001:给原生 App 用的页面级聚合接口)。
 * 登录后额外返回已读状态;未登录也能拿到列表(内容本身公开)。
 */
export async function GET(request: Request) {
  const userId = await getOptionalUserId(request);

  let readSlugs = new Set<string>();

  if (userId) {
    const reads = await prisma.lecturaRead
      .findMany({ where: { userId }, select: { slug: true } })
      .catch(() => [] as Array<{ slug: string }>);
    readSlugs = new Set(reads.map((read) => read.slug));
  }

  // 列表不返回正文,减小响应体积
  const items = lecturaStories.map((story) => ({
    slug: story.slug,
    title: story.title,
    titleZh: story.titleZh,
    level: story.level,
    source: story.source,
    durationMin: story.durationMin,
    summaryZh: story.summaryZh,
    paragraphCount: story.paragraphs.length,
    isRead: readSlugs.has(story.slug)
  }));

  return NextResponse.json({ items, total: items.length });
}
