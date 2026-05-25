import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { getAuthOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { getMessageEncryptionSecret } from "@/lib/talk/env";
import { restoreTalkSession } from "@/lib/talk/session-service";

function getSessionUserId(session: unknown): string | null {
  if (!session || typeof session !== "object" || !("user" in session)) return null;
  const user = (session as { user?: { id?: unknown } }).user;
  return typeof user?.id === "string" ? user.id : null;
}

function jsonError(status: number, code: string, message: string) {
  return NextResponse.json({ error: { code, message } }, { status });
}

export async function POST(
  request: Request,
  { params }: { params: { id: string } }
) {
  const session = await getServerSession(getAuthOptions());
  const userId = getSessionUserId(session);
  if (!userId) return jsonError(401, "UNAUTHORIZED", "登录后再恢复对话");

  const url = new URL(request.url);
  const characterId = url.searchParams.get("characterId") ?? "";
  if (!characterId) {
    return jsonError(400, "CHARACTER_REQUIRED", "缺少角色信息");
  }

  const item = await restoreTalkSession(prisma, {
    userId,
    sessionId: params.id,
    characterId,
    encryptionSecret: getMessageEncryptionSecret()
  });

  if (!item) {
    return jsonError(404, "SESSION_NOT_FOUND", "找不到该归档对话或无法恢复");
  }

  return NextResponse.json({ item });
}
