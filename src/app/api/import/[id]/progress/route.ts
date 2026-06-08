// Timestamp: 2026-06-08 15:37
import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { getAuthOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { buildImportedDocumentProgress } from "@/lib/import/progress";
import { clampLastPageIndex } from "@/lib/import/window";

function getUserId(session: unknown) {
  const maybeSession = session as { user?: { id?: unknown } } | null;
  return maybeSession?.user && typeof maybeSession.user.id === "string"
    ? maybeSession.user.id
    : null;
}

export async function POST(
  request: Request,
  context: { params: { id: string } },
) {
  const session = await getServerSession(getAuthOptions());
  const userId = getUserId(session);

  if (!userId) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }

  const body = (await request.json()) as { lastPageIndex?: unknown };
  const lastPageIndex =
    typeof body.lastPageIndex === "number" && Number.isInteger(body.lastPageIndex)
      ? body.lastPageIndex
      : null;

  if (lastPageIndex === null || lastPageIndex < 0) {
    return NextResponse.json({ error: "invalid lastPageIndex" }, { status: 400 });
  }

  const document = await prisma.importedDocument.findFirst({
    where: { id: context.params.id, userId },
    select: { id: true, pageCount: true },
  });

  if (!document) {
    return NextResponse.json({ error: "not found" }, { status: 404 });
  }

  const clampedPageIndex = clampLastPageIndex(lastPageIndex, document.pageCount);

  const updated = await prisma.importedDocument.update({
    where: { id: document.id },
    data: { lastPageIndex: clampedPageIndex },
    select: { id: true, lastPageIndex: true, pageCount: true },
  });

  return NextResponse.json({
    document: {
      ...updated,
      progress: buildImportedDocumentProgress(updated),
    },
  });
}
