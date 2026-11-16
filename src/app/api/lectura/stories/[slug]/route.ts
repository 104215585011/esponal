// Timestamp: 2026-11-16 09:05
import { NextResponse } from "next/server";
import { lecturaStories } from "@/../content/lectura";
import { getOptionalUserId } from "@/lib/api-auth";
import { getCrawledLecturaStoryBySlug } from "@/lib/lectura/rss-crawler";

/**
 * GET /api/lectura/stories/[slug]
 *
 * 单篇详情（含正文段落 + 生词表），兼容静态精选短文与 RSS 爬取文章。
 */
export async function GET(
  request: Request,
  { params }: { params: { slug: string } },
) {
  await getOptionalUserId(request);

  const slug = params.slug;
  const staticStory = lecturaStories.find((item) => item.slug === slug);
  const story = staticStory ?? (await getCrawledLecturaStoryBySlug(slug));

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
      glossary: story.glossary ?? [],
      sourceUrl: "sourceUrl" in story ? story.sourceUrl : undefined,
      audioUrl: "audioUrl" in story ? story.audioUrl : undefined,
      coverUrl: "coverUrl" in story ? story.coverUrl : undefined,
    },
  });
}
