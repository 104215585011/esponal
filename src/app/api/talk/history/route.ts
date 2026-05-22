import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { getAuthOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { listUserHistory } from "@/lib/talk/history-service";
import { getMessageEncryptionSecret } from "@/lib/talk/env";

function getSessionUserId(session: unknown): string | null {
  if (!session || typeof session !== "object" || !("user" in session)) return null;
  const user = (session as { user?: { id?: unknown } }).user;
  return typeof user?.id === "string" ? user.id : null;
}

export async function GET(request: Request) {
  const session = await getServerSession(getAuthOptions());
  const userId = getSessionUserId(session);
  if (!userId) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }

  const url = new URL(request.url);
  const page = Math.max(1, Number(url.searchParams.get("page") ?? "1") || 1);
  const pageSize = Math.min(50, Math.max(1, Number(url.searchParams.get("pageSize") ?? "20") || 20));
  const sessionId = url.searchParams.get("sessionId") ?? undefined;

  const history = await listUserHistory(prisma, {
    userId,
    page,
    pageSize,
    sessionId: sessionId ?? undefined,
    encryptionSecret: getMessageEncryptionSecret()
  });

  return NextResponse.json(history);
}
