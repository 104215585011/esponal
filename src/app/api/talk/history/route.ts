import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getTalkCharacterById } from "@/lib/talk/characters";
import { listUserHistory } from "@/lib/talk/history-service";
import { getMessageEncryptionSecret } from "@/lib/talk/env";
import { getAuthedUserId } from "@/lib/api-auth";

export async function GET(request: Request) {
  const userId = await getAuthedUserId(request);
  if (!userId) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }

  const url = new URL(request.url);
  const page = Math.max(1, Number(url.searchParams.get("page") ?? "1") || 1);
  const pageSize = Math.min(50, Math.max(1, Number(url.searchParams.get("pageSize") ?? "20") || 20));
  const sessionId = url.searchParams.get("sessionId") ?? undefined;
  const characterId = url.searchParams.get("characterId") ?? "";
  const includeArchived = url.searchParams.get("includeArchived") === "true";

  if (!characterId || !getTalkCharacterById(characterId)) {
    return NextResponse.json({ error: "character_not_found" }, { status: 404 });
  }

  const history = await listUserHistory(prisma, {
    userId,
    characterId,
    page,
    pageSize,
    sessionId: sessionId ?? undefined,
    includeArchived,
    encryptionSecret: getMessageEncryptionSecret()
  });

  return NextResponse.json(history);
}
