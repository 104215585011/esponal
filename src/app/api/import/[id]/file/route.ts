// Timestamp: 2026-06-10 10:05
import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { getAuthOptions } from "@/lib/auth";
import { getImportedDocumentFileByIdForUser } from "@/lib/import/service";
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

function toArrayBuffer(bytes: Uint8Array) {
  const buffer = new ArrayBuffer(bytes.byteLength);
  new Uint8Array(buffer).set(bytes);
  return buffer;
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

  const document = await getImportedDocumentFileByIdForUser(userId, context.params.id);

  if (!document) {
    return NextResponse.json({ error: "not_found" }, { status: 404 });
  }

  const contentType = contentTypeForKind(document.kind);
  if (document.inlineContent) {
    return new Response(toArrayBuffer(document.inlineContent), {
      status: 200,
      headers: {
        "Cache-Control": "private, no-store",
        "Content-Disposition": "inline",
        "Content-Length": String(document.inlineContent.byteLength),
        "Content-Type": contentType,
      },
    });
  }

  const url = await presignGet({ key: document.ossKey });
  const upstream = await fetch(url, { cache: "no-store" });
  const sourceContentType = upstream.headers.get("content-type") ?? "";
  const sourceContentLength = upstream.headers.get("content-length");

  if (!upstream.ok || !upstream.body) {
    return NextResponse.json(
      {
        error: "source_unavailable",
        sourceStatus: upstream.status,
        sourceContentType,
      },
      { status: 502 },
    );
  }

  const headers = new Headers({
    "Cache-Control": "private, no-store",
    "Content-Disposition": "inline",
    "Content-Type": contentType,
  });
  if (sourceContentLength) {
    headers.set("Content-Length", sourceContentLength);
  }

  return new Response(upstream.body, {
    status: 200,
    headers,
  });
}
