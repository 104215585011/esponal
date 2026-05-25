import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { getAuthOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { getTalkCharacterById } from "@/lib/talk/characters";
import { getMessageEncryptionSecret } from "@/lib/talk/env";
import { createTalkSession, listActiveTalkSessions } from "@/lib/talk/session-service";

type Body = {
  characterId?: unknown;
};

function getSessionUserId(session: unknown): string | null {
  if (!session || typeof session !== "object" || !("user" in session)) return null;
  const user = (session as { user?: { id?: unknown } }).user;
  return typeof user?.id === "string" ? user.id : null;
}

function jsonError(status: number, code: string, message: string) {
  return NextResponse.json({ error: { code, message } }, { status });
}

export async function GET(request: Request) {
  const session = await getServerSession(getAuthOptions());
  const userId = getSessionUserId(session);
  if (!userId) return jsonError(401, "UNAUTHORIZED", "登录后再查看对话");

  const url = new URL(request.url);
  const characterId = url.searchParams.get("characterId") ?? "";
  const includeArchived = url.searchParams.get("includeArchived") === "true";
  if (!characterId || !getTalkCharacterById(characterId)) {
    return jsonError(404, "CHARACTER_NOT_FOUND", "未知角色");
  }

  const items = await listActiveTalkSessions(prisma, {
    userId,
    characterId,
    encryptionSecret: getMessageEncryptionSecret(),
    includeArchived
  });

  return NextResponse.json({ items });
}

export async function POST(request: Request) {
  const session = await getServerSession(getAuthOptions());
  const userId = getSessionUserId(session);
  if (!userId) return jsonError(401, "UNAUTHORIZED", "登录后再创建对话");

  let body: Body;
  try {
    body = (await request.json()) as Body;
  } catch {
    return jsonError(400, "BAD_JSON", "请求体不是合法 JSON");
  }

  const characterId = typeof body.characterId === "string" ? body.characterId : "";
  if (!characterId || !getTalkCharacterById(characterId)) {
    return jsonError(404, "CHARACTER_NOT_FOUND", "未知角色");
  }

  const item = await createTalkSession(prisma, { userId, characterId });
  return NextResponse.json({ item }, { status: 201 });
}
