// Timestamp: 2026-06-08 15:28
import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { getAuthOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { buildImportedDocumentProgress } from "@/lib/import/progress";

function getUserId(session: unknown) {
  const maybeSession = session as { user?: { id?: unknown } } | null;
  return maybeSession?.user && typeof maybeSession.user.id === "string"
    ? maybeSession.user.id
    : null;
}

export async function GET() {
  const session = await getServerSession(getAuthOptions());
  const userId = getUserId(session);

  if (!userId) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }

  const rows = await prisma.importedDocument.findMany({
    where: { userId },
    orderBy: { createdAt: "desc" },
    select: {
      id: true,
      title: true,
      kind: true,
      status: true,
      failReason: true,
      pageCount: true,
      lastPageIndex: true,
      createdAt: true,
      updatedAt: true,
    },
  });

  const documents = rows.map((document) => ({
    ...document,
    progress: buildImportedDocumentProgress(document),
  }));

  return NextResponse.json({ documents });
}
