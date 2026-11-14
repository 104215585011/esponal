// Timestamp: 2026-11-15 07:35
import { randomUUID } from "node:crypto";
import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { getAuthedUserId } from "@/lib/api-auth";
import { getAuthOptions } from "@/lib/auth";
import { parseEpubForReader } from "@/lib/import/epub";
import { createImportedDocument } from "@/lib/import/service";

const MAX_PROXY_UPLOAD_BYTES = 4 * 1024 * 1024;

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

function inferKind(file: File) {
  const name = file.name.toLowerCase();
  if (name.endsWith(".epub") || file.type === CONTENT_TYPES.epub) return "epub";
  if (name.endsWith(".pdf") || file.type === CONTENT_TYPES.pdf) return "pdf";
  return null;
}

function extensionForKind(kind: "epub" | "pdf") {
  return kind === "epub" ? ".epub" : ".pdf";
}

function titleFromFile(file: File, title: FormDataEntryValue | null) {
  return typeof title === "string" && title.trim()
    ? title.trim()
    : file.name.replace(/\.[^.]+$/, "") || "Imported document";
}

export async function POST(request: Request) {
  const userId =
    (await getAuthedUserId(request)) ??
    getUserId(await getServerSession(getAuthOptions()));

  if (!userId) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }

  let formData: FormData;
  try {
    formData = await request.formData();
  } catch {
    return NextResponse.json({ error: "invalid_form_data" }, { status: 400 });
  }

  const file = formData.get("file");
  if (!(file instanceof File)) {
    return NextResponse.json({ error: "missing_file" }, { status: 400 });
  }

  const kind = inferKind(file);
  if (!kind) {
    return NextResponse.json({ error: "unsupported_file_type" }, { status: 400 });
  }

  if (file.size <= 0) {
    return NextResponse.json({ error: "invalid_size" }, { status: 400 });
  }

  if (file.size > MAX_PROXY_UPLOAD_BYTES) {
    return NextResponse.json({ error: "proxy_file_too_large" }, { status: 413 });
  }

  const randomId = randomUUID().replace(/-/g, "");
  const ossKey = `inline/${userId}/${randomId}${extensionForKind(kind)}`;
  const inlineContent = Buffer.from(await file.arrayBuffer());

  let unitCount = 0;
  if (kind === "epub") {
    try {
      const parsed = await parseEpubForReader(inlineContent);
      unitCount = parsed.chapters.length;
    } catch {
      unitCount = 0;
    }
  }

  const document = await createImportedDocument({
    userId,
    title: titleFromFile(file, formData.get("title")),
    kind,
    ossKey,
    sizeBytes: file.size,
    inlineContent,
    unitCount,
  });

  return NextResponse.json({ document });
}
