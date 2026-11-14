// Timestamp: 2026-11-15 07:35
import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { getAuthedUserId } from "@/lib/api-auth";
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
  request: Request,
  context: { params: { id: string } },
) {
  const userId =
    (await getAuthedUserId(request)) ??
    getUserId(await getServerSession(getAuthOptions()));

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
  request: Request,
  context: { params: { id: string } },
) {
  const userId =
    (await getAuthedUserId(request)) ??
    getUserId(await getServerSession(getAuthOptions()));

  if (!userId) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }

  const document = await getImportedDocumentByIdForUser(userId, context.params.id);

  if (!document) {
    return NextResponse.json({ error: "not found" }, { status: 404 });
  }

  let storageDeleted = document.ossKey.startsWith("inline/");
  if (!storageDeleted) {
    try {
      const url = await presignDelete({ key: document.ossKey });
      const response = await fetch(url, { method: "DELETE", cache: "no-store" });
      storageDeleted = response.ok || response.status === 404;
    } catch (error) {
      console.warn("Imported document storage delete failed; removing metadata only", error);
    }
  }

  const deleted = await deleteImportedDocumentForUser(userId, context.params.id);

  return NextResponse.json({
    deleted: Boolean(deleted),
    storageDeleted,
  });
}
