// Timestamp: 2026-06-11 14:35
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

function parseRange(rangeHeader: string | null, size: number) {
  const match = rangeHeader?.match(/^bytes=(\d*)-(\d*)$/);
  if (!match) return null;
  const start = match[1] ? Number(match[1]) : 0;
  const end = match[2] ? Number(match[2]) : size - 1;
  if (!Number.isSafeInteger(start) || !Number.isSafeInteger(end) || start < 0 || end < start || start >= size) return null;
  return { start, end: Math.min(end, size - 1) };
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

  const document = await getImportedDocumentFileByIdForUser(userId, context.params.id);

  if (!document) {
    return NextResponse.json({ error: "not_found" }, { status: 404 });
  }

  const contentType = contentTypeForKind(document.kind);
  const rangeHeader = request.headers.get("range");
  if (document.inlineContent) {
    const range = parseRange(rangeHeader, document.inlineContent.byteLength);
    const body = range ? document.inlineContent.slice(range.start, range.end + 1) : document.inlineContent;
    return new Response(toArrayBuffer(body), {
      status: range ? 206 : 200,
      headers: {
        "Accept-Ranges": "bytes",
        "Cache-Control": "private, no-store",
        "Content-Disposition": "inline",
        "Content-Length": String(body.byteLength),
        "Content-Type": contentType,
        ...(range ? { "Content-Range": `bytes ${range.start}-${range.end}/${document.inlineContent.byteLength}` } : {}),
      },
    });
  }

  const url = await presignGet({ key: document.ossKey });
  const upstream = await fetch(url, { cache: "no-store", headers: rangeHeader ? { Range: rangeHeader } : undefined });
  const sourceContentType = upstream.headers.get("content-type") ?? "";
  const sourceContentLength = upstream.headers.get("content-length");
  const sourceContentRange = upstream.headers.get("content-range");

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
    "Accept-Ranges": "bytes",
    "Cache-Control": "private, no-store",
    "Content-Disposition": "inline",
    "Content-Type": contentType,
  });
  if (sourceContentLength) {
    headers.set("Content-Length", sourceContentLength);
  }
  if (sourceContentRange) {
    headers.set("Content-Range", sourceContentRange);
  }

  return new Response(upstream.body, {
    status: upstream.status === 206 ? 206 : 200,
    headers,
  });
}
