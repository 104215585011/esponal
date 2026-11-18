// Timestamp: 2026-11-18 16:35
import { NextResponse } from "next/server";
import { WordStatus } from "@prisma/client";
import { getAuthedUserId } from "@/lib/api-auth";
import { prisma } from "@/lib/prisma";

type Body = {
  id?: unknown;
  itemType?: unknown;
  status?: unknown;
};

const VALID_STATUSES = new Set<WordStatus>([
  WordStatus.NEW,
  WordStatus.LEARNING,
  WordStatus.KNOWN
]);

/**
 * POST /api/vocab/status
 *
 * 将已收藏单词或语块标为 KNOWN（「同源秒懂 / 低频跳过，不再进复习队列」）或恢复为 LEARNING。
 */
export async function POST(request: Request) {
  const userId = await getAuthedUserId(request);
  if (!userId) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }

  let body: Body;
  try {
    body = (await request.json()) as Body;
  } catch {
    return NextResponse.json({ error: "invalid body" }, { status: 400 });
  }

  const id = typeof body.id === "string" ? body.id.trim() : "";
  const status = typeof body.status === "string" ? (body.status as WordStatus) : null;
  const itemType = body.itemType === "phrase" ? "phrase" : "word";

  if (!id || !status || !VALID_STATUSES.has(status)) {
    return NextResponse.json({ error: "invalid id or status" }, { status: 400 });
  }

  if (itemType === "phrase") {
    const existing = await prisma.savedPhrase.findFirst({ where: { id, userId } });
    if (!existing) {
      return NextResponse.json({ error: "not found" }, { status: 404 });
    }
    const updated = await prisma.savedPhrase.update({
      where: { id: existing.id },
      data: { status }
    });
    return NextResponse.json({ ok: true, id: updated.id, itemType: "phrase", status: updated.status });
  }

  const existing = await prisma.word.findFirst({ where: { id, userId } });
  if (existing) {
    const updated = await prisma.word.update({
      where: { id: existing.id },
      data: { status }
    });
    return NextResponse.json({ ok: true, id: updated.id, itemType: "word", status: updated.status });
  }

  // Fallback if caller didn't pass itemType="phrase"
  const phrase = await prisma.savedPhrase.findFirst({ where: { id, userId } });
  if (!phrase) {
    return NextResponse.json({ error: "not found" }, { status: 404 });
  }
  const updatedPhrase = await prisma.savedPhrase.update({
    where: { id: phrase.id },
    data: { status }
  });
  return NextResponse.json({
    ok: true,
    id: updatedPhrase.id,
    itemType: "phrase",
    status: updatedPhrase.status
  });
}
