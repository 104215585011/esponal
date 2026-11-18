// Timestamp: 2026-11-18 11:18
import { NextResponse } from "next/server";
import { getAuthedUserId } from "@/lib/api-auth";
import {
  getCatalogStoryBySlug,
  getNextRecommendationAfterRead
} from "@/lib/lectura/catalog";
import { prisma } from "@/lib/prisma";

type ReadRouteContext = {
  params: { slug: string };
};

type ProgressBody = {
  action?: "progress" | "complete";
  paragraphIndex?: number;
  totalParagraphs?: number;
};

/**
 * POST /api/lectura/[slug]/read
 *
 * - `{ action: "progress", paragraphIndex, totalParagraphs }`：记录当前续读段落（不提前标记读完）
 * - `{ action: "complete", totalParagraphs }` 或空请求体：标记「读完了」，并推荐下一篇相关好文章
 */
export async function POST(request: Request, { params }: ReadRouteContext) {
  // PLATFORM-001: cookie(Web) 与 Bearer(App) 双通道
  const userId = await getAuthedUserId(request);

  if (!userId) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }

  const slug = params.slug.trim();
  if (!slug) {
    return NextResponse.json({ error: "invalid slug" }, { status: 400 });
  }

  let body: ProgressBody = {};
  try {
    const raw = await request.text();
    if (raw.trim()) {
      body = JSON.parse(raw) as ProgressBody;
    }
  } catch {
    body = {};
  }

  const isProgressOnly = body.action === "progress";
  const paragraphIndex =
    typeof body.paragraphIndex === "number" && Number.isFinite(body.paragraphIndex)
      ? Math.max(0, Math.floor(body.paragraphIndex))
      : 0;
  const totalParagraphs =
    typeof body.totalParagraphs === "number" && Number.isFinite(body.totalParagraphs)
      ? Math.max(0, Math.floor(body.totalParagraphs))
      : 0;

  const existing = await prisma.lecturaRead
    .findUnique({
      where: { userId_slug: { userId, slug } },
      select: { completed: true, completedAt: true, language: true }
    })
    .catch(() => null);

  const story = await getCatalogStoryBySlug(slug).catch(() => null);
  const resolvedLang = story?.language ?? existing?.language ?? "es";
  const now = new Date();

  const read = await prisma.lecturaRead.upsert({
    where: {
      userId_slug: {
        userId,
        slug
      }
    },
    create: {
      userId,
      slug,
      language: resolvedLang,
      lastParagraphIndex: paragraphIndex,
      totalParagraphs: totalParagraphs || story?.paragraphCount || 0,
      completed: !isProgressOnly,
      completedAt: isProgressOnly ? null : now
    },
    update: isProgressOnly
      ? {
          lastParagraphIndex: paragraphIndex,
          ...(totalParagraphs > 0 ? { totalParagraphs } : {})
        }
      : {
          lastParagraphIndex:
            totalParagraphs > 0
              ? totalParagraphs - 1
              : story?.paragraphCount
                ? Math.max(0, story.paragraphCount - 1)
                : paragraphIndex,
          ...(totalParagraphs > 0 ? { totalParagraphs } : {}),
          completed: true,
          completedAt: existing?.completedAt ?? now,
          readAt: now
        }
  });

  const nextStory =
    !isProgressOnly && story
      ? await getNextRecommendationAfterRead({ current: story, userId }).catch(() => null)
      : null;

  return NextResponse.json({
    ok: true,
    slug: read.slug,
    completed: read.completed,
    lastParagraphIndex: read.lastParagraphIndex,
    totalParagraphs: read.totalParagraphs,
    readAt: read.readAt.toISOString(),
    nextStory
  });
}
