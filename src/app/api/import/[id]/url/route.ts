// Timestamp: 2026-06-08 21:42
import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { getAuthOptions } from "@/lib/auth";
import { getImportedDocumentByIdForUser } from "@/lib/import/service";
import { presignGet } from "@/lib/storage/cos";

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
    return NextResponse.json({ error: "not_found" }, { status: 404 });
  }

  const url = await presignGet({
    key: document.ossKey,
    responseContentDisposition: "inline",
    responseContentType: document.kind === "pdf" ? "application/pdf" : "application/epub+zip",
  });
  return NextResponse.json({ url, expiresIn: 900 });
}
