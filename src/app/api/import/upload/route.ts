// Timestamp: 2026-11-15 14:12
import { randomUUID } from "node:crypto";
import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { getAuthedUserId } from "@/lib/api-auth";
import { getAuthOptions } from "@/lib/auth";
import { parseEpubForReader } from "@/lib/import/epub";
import { parsePdfForReader } from "@/lib/import/pdf";
import { createImportedDocument } from "@/lib/import/service";
import { resolveRequestLanguage } from "@/lib/languages";

export const runtime = "nodejs";
export const maxDuration = 60;

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

function inferKind(filename: string, mimeType: string) {
  const name = filename.toLowerCase();
  const type = mimeType.toLowerCase();
  if (name.endsWith(".epub") || type.includes("epub")) return "epub";
  if (name.endsWith(".pdf") || type === CONTENT_TYPES.pdf) return "pdf";
  return null;
}

function extensionForKind(kind: "epub" | "pdf") {
  return kind === "epub" ? ".epub" : ".pdf";
}

function titleFromName(filename: string, title: unknown) {
  return typeof title === "string" && title.trim()
    ? title.trim()
    : filename.replace(/\.[^.]+$/, "") || "Imported document";
}

export async function POST(request: Request) {
  const userId =
    (await getAuthedUserId(request)) ??
    getUserId(await getServerSession(getAuthOptions()));

  if (!userId) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }

  let filename = "";
  let mimeType = "";
  let rawTitle: unknown = null;
  let rawLanguage: unknown = null;
  let inlineContent: Buffer;

  const contentTypeHeader = (request.headers.get("content-type") ?? "").toLowerCase();

  if (contentTypeHeader.includes("application/json")) {
    let body: {
      filename?: unknown;
      title?: unknown;
      mimeType?: unknown;
      language?: unknown;
      fileBase64?: unknown;
    };
    try {
      body = (await request.json()) as typeof body;
    } catch {
      return NextResponse.json({ error: "invalid_json" }, { status: 400 });
    }
    const base64 = typeof body.fileBase64 === "string" ? body.fileBase64.trim() : "";
    if (!base64) {
      return NextResponse.json({ error: "missing_file" }, { status: 400 });
    }
    inlineContent = Buffer.from(base64.replace(/^data:[^;]+;base64,/, ""), "base64");
    filename = typeof body.filename === "string" ? body.filename : "document.pdf";
    mimeType = typeof body.mimeType === "string" ? body.mimeType : "";
    rawTitle = body.title;
    rawLanguage = body.language;
  } else {
    let formData: FormData;
    try {
      formData = await request.formData();
    } catch {
      return NextResponse.json({ error: "invalid_form_data" }, { status: 400 });
    }

    const file = formData.get("file");
    if (!file || typeof file === "string" || typeof (file as Blob).arrayBuffer !== "function") {
      return NextResponse.json({ error: "missing_file" }, { status: 400 });
    }

    const blob = file as Blob & { name?: unknown };
    filename = typeof blob.name === "string" ? blob.name : "";
    mimeType = blob.type || "";
    rawTitle = formData.get("title");
    rawLanguage = formData.get("language");
    inlineContent = Buffer.from(await blob.arrayBuffer());
  }

  const kind = inferKind(filename, mimeType);
  if (!kind) {
    return NextResponse.json({ error: "unsupported_file_type" }, { status: 400 });
  }

  const sizeBytes = inlineContent.length;
  if (sizeBytes <= 0) {
    return NextResponse.json({ error: "invalid_size" }, { status: 400 });
  }

  if (sizeBytes > MAX_PROXY_UPLOAD_BYTES) {
    return NextResponse.json({ error: "proxy_file_too_large" }, { status: 413 });
  }

  const randomId = randomUUID().replace(/-/g, "");
  const ossKey = `inline/${userId}/${randomId}${extensionForKind(kind)}`;

  let unitCount = 0;
  if (kind === "epub") {
    try {
      const parsed = await parseEpubForReader(inlineContent);
      unitCount = parsed.chapters.length;
    } catch {
      unitCount = 0;
    }
  } else {
    try {
      const parsed = await parsePdfForReader(inlineContent);
      unitCount = parsed.unitCount;
    } catch {
      unitCount = 0;
    }
  }

  const language = await resolveRequestLanguage(request, rawLanguage, userId);

  const document = await createImportedDocument({
    userId,
    language,
    title: titleFromName(filename, rawTitle),
    kind,
    ossKey,
    sizeBytes,
    inlineContent,
    unitCount,
  });

  return NextResponse.json({ document });
}
