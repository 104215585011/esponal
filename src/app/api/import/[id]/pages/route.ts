// Timestamp: 2026-06-08 13:06
import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { getAuthOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { resolvePageWindow } from "@/lib/import/window";

function getUserId(session: unknown) {
  const maybeSession = session as { user?: { id?: unknown } } | null;
  return maybeSession?.user && typeof maybeSession.user.id === "string"
    ? maybeSession.user.id
    : null;
}

export async function GET(
  request: Request,
  context: { params: { id: string } },
) {
  const session = await getServerSession(getAuthOptions());
  const userId = getUserId(session);

  if (!userId) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }

  const document = await prisma.importedDocument.findFirst({
    where: { id: context.params.id, userId },
    select: { id: true, pageCount: true },
  });

  if (!document) {
    return NextResponse.json({ error: "not found" }, { status: 404 });
  }

  const { searchParams } = new URL(request.url);
  const { from, to, pageCount } = resolvePageWindow(
    document.pageCount,
    searchParams.get("from"),
    searchParams.get("to"),
  );

  const pages = await prisma.documentSection.findMany({
    where: {
      documentId: document.id,
      pageIndex: { gte: from, lte: to },
    },
    orderBy: { pageIndex: "asc" },
    select: {
      pageIndex: true,
      content: true,
    },
  });

  return NextResponse.json({
    documentId: document.id,
    from,
    to,
    pageCount,
    pages,
  });
}
