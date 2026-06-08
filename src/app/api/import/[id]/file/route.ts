// Timestamp: 2026-06-08 23:55
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

function contentTypeForKind(kind: "epub" | "pdf") {
  return kind === "pdf" ? "application/pdf" : "application/epub+zip";
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

  const contentType = contentTypeForKind(document.kind);
  const url = await presignGet({
    key: document.ossKey,
    responseContentDisposition: "inline",
    responseContentType: contentType,
  });
  const upstream = await fetch(url, { cache: "no-store" });

  if (!upstream.ok || !upstream.body) {
    return NextResponse.json({ error: "source_unavailable" }, { status: 502 });
  }

  return new Response(upstream.body, {
    status: 200,
    headers: {
      "Cache-Control": "private, no-store",
      "Content-Disposition": "inline",
      "Content-Type": contentType,
    },
  });
}
