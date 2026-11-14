import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getMessageEncryptionSecret } from "@/lib/talk/env";
import { retitleTalkSession } from "@/lib/talk/session-service";
import { getAuthedUserId } from "@/lib/api-auth";

type Props = {
  params: { id: string };
};

function jsonError(status: number, code: string, message: string) {
  return NextResponse.json({ error: { code, message } }, { status });
}

export async function POST(request: Request, { params }: Props) {
  const userId = await getAuthedUserId(request);
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
