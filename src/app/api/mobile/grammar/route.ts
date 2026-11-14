import { NextResponse } from "next/server";
import { grammarGroups, grammarTopics } from "../../../../../content/grammar/topics";

/**
 * GET /api/mobile/grammar
 *
 * 语法知识库的列表。内容与 Web 端 /grammar 用的是同一份文件
 * (content/grammar/topics.ts),不在两处各维护一套文案。
 *
 * 不需要登录:Web 端语法页本来就是公开的,App 端保持一致。
 * 列表只返回摘要字段,详情走 /api/mobile/grammar/[slug],避免一次拉几百 KB。
 */

export const revalidate = 3600;

export async function GET() {
  return NextResponse.json(
    {
      groups: grammarGroups,
      topics: grammarTopics.map((topic) => ({
        slug: topic.slug,
        group: topic.group,
        title: topic.title,
        intro: topic.intro
      }))
    },
    { headers: { "Cache-Control": "public, max-age=300, s-maxage=3600" } }
  );
}
