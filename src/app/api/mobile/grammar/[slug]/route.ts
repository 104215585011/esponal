import { NextResponse } from "next/server";
import { grammarTopics } from "../../../../../../content/grammar/topics";

/**
 * GET /api/mobile/grammar/[slug]
 *
 * 单篇语法详情(含变位表、规则、例句、ser/estar 对比、相关话题)。
 * 数据源与 Web 端 /grammar/[slug] 同一份,字段原样透出。
 */

export const revalidate = 3600;

export async function GET(_request: Request, context: { params: { slug: string } }) {
  const slug = context.params.slug;
  const topic = grammarTopics.find((item) => item.slug === slug);

  if (!topic) {
    return NextResponse.json({ error: "topic not found", code: "NOT_FOUND" }, { status: 404 });
  }

  return NextResponse.json(
    { topic },
    { headers: { "Cache-Control": "public, max-age=300, s-maxage=3600" } }
  );
}
