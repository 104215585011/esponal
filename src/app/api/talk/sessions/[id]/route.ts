import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getMessageEncryptionSecret } from "@/lib/talk/env";
import { archiveTalkSession } from "@/lib/talk/session-service";
import { getAuthedUserId } from "@/lib/api-auth";

function jsonError(status: number, code: string, message: string) {
  return NextResponse.json({ error: { code, message } }, { status });
}

export async function DELETE(
  request: Request,
  { params }: { params: { id: string } }
) {
  const userId = await getAuthedUserId(request);
  if (!userId) return jsonError(401, "UNAUTHORIZED", "登录后再归档对话");

  const url = new URL(request.url);
  const characterId = url.searchParams.get("characterId") ?? "";
  if (!characterId) {
    return jsonError(400, "CHARACTER_REQUIRED", "缺少角色信息");
  }

  const item = await archiveTalkSession(prisma, {
    userId,
    sessionId: params.id,
    characterId,
    encryptionSecret: getMessageEncryptionSecret()
  });

  if (!item) {
    return jsonError(404, "SESSION_NOT_FOUND", "找不到该对话或无法归档");
  }

  return NextResponse.json({ item });
}
