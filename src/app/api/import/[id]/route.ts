// Timestamp: 2026-06-09 12:20
import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { getAuthOptions } from "@/lib/auth";
import { deleteImportedDocumentForUser, getImportedDocumentByIdForUser } from "@/lib/import/service";
import { presignDelete } from "@/lib/storage/cos";

function getUserId(session: unknown) {
  const maybeSession = session as { user?: { id?: unknown } } | null;
  return maybeSession?.user && typeof maybeSession.user.id === "string"
    ? maybeSession.user.id
    : null;
}

export async function GET(
  _request: Request,
  context: { params: { id: string } },
) {
  const session = await getServerSession(getAuthOptions());
  const userId = getUserId(session);

  if (!userId) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }

  const document = await getImportedDocumentByIdForUser(userId, context.params.id);

  if (!document) {
    return NextResponse.json({ error: "not found" }, { status: 404 });
  }

  return NextResponse.json({
    document,
  });
}

export async function DELETE(
  _request: Request,
  context: { params: { id: string } },
) {
  const session = await getServerSession(getAuthOptions());
  const userId = getUserId(session);

  if (!userId) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }

  const document = await getImportedDocumentByIdForUser(userId, context.params.id);

  if (!document) {
    return NextResponse.json({ error: "not found" }, { status: 404 });
  }

  let storageDeleted = false;
  try {
    const url = await presignDelete({ key: document.ossKey });
    const response = await fetch(url, { method: "DELETE", cache: "no-store" });
    storageDeleted = response.ok || response.status === 404;
  } catch (error) {
    console.warn("Imported document storage delete failed; removing metadata only", error);
  }

  const deleted = await deleteImportedDocumentForUser(userId, context.params.id);

  return NextResponse.json({
    deleted: Boolean(deleted),
    storageDeleted,
  });
}
