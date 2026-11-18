// Timestamp: 2026-11-18 11:18
import { NextResponse } from "next/server";
import { getOptionalUserId } from "@/lib/api-auth";
import {
  getCatalogStoryBySlug,
  getNextRecommendationAfterRead
} from "@/lib/lectura/catalog";
import { prisma } from "@/lib/prisma";

/**
 * GET /api/lectura/stories/[slug]
 *
 * 单篇详情（含正文段落 + 是否全文/节选 + 原声/合成朗读区分 + 当前续读位置 + 读后推荐下一篇）。
 */
export async function GET(
  request: Request,
  { params }: { params: { slug: string } }
) {
  const userId = await getOptionalUserId(request);
  const slug = params.slug;
  const story = await getCatalogStoryBySlug(slug);

  if (!story) {
    return NextResponse.json({ error: "story not found" }, { status: 404 });
  }

  let lastParagraphIndex = 0;
  let completed = false;

  if (userId) {
    const progress = await prisma.lecturaRead
      .findUnique({
        where: { userId_slug: { userId, slug: story.slug } },
        select: { lastParagraphIndex: true, completed: true }
      })
      .catch(() => null);
    if (progress) {
      lastParagraphIndex = progress.lastParagraphIndex;
      completed = progress.completed;
    }
  }

  const nextRecommendation = await getNextRecommendationAfterRead({
    current: story,
    userId
  });

  return NextResponse.json({
    story: {
      slug: story.slug,
      language: story.language,
      contentKind: story.contentKind,
      sourceId: story.sourceId,
      title: story.title,
      titleZh: story.titleZh,
      level: story.level,
      source: story.sourceLabel,
      topic: story.topic,
      durationMin: story.durationMin,
      summaryZh: story.summaryZh,
      paragraphs: story.paragraphs,
      paragraphCount: story.paragraphCount,
      isFullText: story.isFullText,
      audioType: story.audioType,
      glossary: story.glossary ?? [],
      sourceUrl: story.sourceUrl ?? undefined,
      audioUrl: story.audioUrl ?? undefined,
      coverUrl: story.coverUrl ?? undefined,
      lastParagraphIndex,
      completed,
      isRead: completed,
      nextRecommendation
    }
  });
}
