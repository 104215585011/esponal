import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { getAuthOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { getMessageEncryptionSecret } from "@/lib/talk/env";
import { retitleTalkSession } from "@/lib/talk/session-service";

type Props = {
  params: { id: string };
};

function getSessionUserId(session: unknown): string | null {
  if (!session || typeof session !== "object" || !("user" in session)) return null;
  const user = (session as { user?: { id?: unknown } }).user;
  return typeof user?.id === "string" ? user.id : null;
}

function jsonError(status: number, code: string, message: string) {
  return NextResponse.json({ error: { code, message } }, { status });
}

export async function POST(_request: Request, { params }: Props) {
  const session = await getServerSession(getAuthOptions());
  const userId = getSessionUserId(session);
  if (!userId) return jsonError(401, "UNAUTHORIZED", "登录后再更新标题");

  const item = await retitleTalkSession(prisma, {
    userId,
    sessionId: params.id,
    encryptionSecret: getMessageEncryptionSecret()
  });

  if (!item) {
    return NextResponse.json({ item: null, skipped: true });
  }

  return NextResponse.json({ item });
}
