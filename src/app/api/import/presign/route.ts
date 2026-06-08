// Timestamp: 2026-06-08 21:42
import { randomUUID } from "node:crypto";
import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { getAuthOptions } from "@/lib/auth";
import { presignPut } from "@/lib/storage/cos";

const MAX_FILE_BYTES = 100 * 1024 * 1024;

const CONTENT_TYPES = {
  epub: "application/epub+zip",
  pdf: "application/pdf",
} as const;

function getUserId(session: unknown) {
  const maybeSession = session as { user?: { id?: unknown } } | null;
  return maybeSession?.user && typeof maybeSession.user.id === "string"
    ? maybeSession.user.id
    : null;
}

function extensionForKind(kind: "epub" | "pdf") {
  return kind === "epub" ? ".epub" : ".pdf";
}

export async function POST(request: Request) {
  const session = await getServerSession(getAuthOptions());
  const userId = getUserId(session);

  if (!userId) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }

  let body: { filename?: unknown; kind?: unknown; sizeBytes?: unknown; contentType?: unknown };
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "invalid_json" }, { status: 400 });
  }

  const kind = body.kind;
  if (kind !== "epub" && kind !== "pdf") {
    return NextResponse.json({ error: "unsupported_file_type" }, { status: 400 });
  }

  const sizeBytes = typeof body.sizeBytes === "number" ? body.sizeBytes : Number(body.sizeBytes);
  if (!Number.isFinite(sizeBytes) || sizeBytes <= 0) {
    return NextResponse.json({ error: "invalid_size" }, { status: 400 });
  }

  if (sizeBytes > MAX_FILE_BYTES) {
    return NextResponse.json({ error: "file_too_large" }, { status: 400 });
  }

  const randomId = randomUUID().replace(/-/g, "");
  const extension = extensionForKind(kind);
  const ossKey = `imports/${userId}/${randomId}${extension}`;
  const contentType = typeof body.contentType === "string" && body.contentType.trim()
    ? body.contentType
    : CONTENT_TYPES[kind];
  const uploadUrl = await presignPut({
    key: ossKey,
    contentType,
  });

  return NextResponse.json({ uploadUrl, ossKey, contentType, maxFileBytes: MAX_FILE_BYTES });
}
