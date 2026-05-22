import { NextResponse } from "next/server";
import { TALK_CHARACTERS } from "@/lib/talk/characters";

export async function GET() {
  // 公开端点：列出 5 个 AI 对话角色（不含 systemPrompt，那是服务端机密）
  return NextResponse.json({
    items: TALK_CHARACTERS.map(({ id, name, language, bio, style }) => ({
      id,
      name,
      language,
      bio,
      style
    }))
  });
}
