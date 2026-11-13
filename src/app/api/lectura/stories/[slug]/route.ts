// Timestamp: 2026-11-13 23:22
import { NextResponse } from "next/server";
import { lecturaStories } from "@/../content/lectura";
import { getOptionalUserId } from "@/lib/api-auth";

/**
 * GET /api/lectura/stories/[slug]
 *
 * 单篇详情(含正文段落 + 生词表),给原生阅读器用。
 */
export async function GET(
  request: Request,
  { params }: { params: { slug: string } }
) {
  // 保持接口语义一致(未来若做会员/额度,这里已有 userId 可用)
  await getOptionalUserId(request);

  const slug = params.slug;
  const story = lecturaStories.find((item) => item.slug === slug);

  if (!story) {
    return NextResponse.json({ error: "story not found" }, { status: 404 });
  }

  return NextResponse.json({
    story: {
      slug: story.slug,
      title: story.title,
      titleZh: story.titleZh,
      level: story.level,
      source: story.source,
      durationMin: story.durationMin,
      summaryZh: story.summaryZh,
      paragraphs: story.paragraphs,
      glossary: story.glossary ?? []
    }
  });
}
