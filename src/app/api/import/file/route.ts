// Timestamp: 2026-06-08 16:16
import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { getAuthOptions } from "@/lib/auth";
import { scheduleImportedDocumentProcessing } from "@/lib/import/queue";
import { createImportedDocument } from "@/lib/import/service";

const MAX_FILE_BYTES = 100 * 1024 * 1024;
const ALLOWED_EXTENSIONS = [".epub", ".pdf"];
const ALLOWED_MIME_TYPES = ["application/epub+zip", "application/pdf"];

function getUserId(session: unknown) {
  const maybeSession = session as { user?: { id?: unknown } } | null;
  return maybeSession?.user && typeof maybeSession.user.id === "string"
    ? maybeSession.user.id
    : null;
}

function hasAllowedExtension(fileName: string) {
  const lowerName = fileName.toLowerCase();
  return ALLOWED_EXTENSIONS.some((extension) => lowerName.endsWith(extension));
}

function hasAllowedMimeType(file: File) {
  return file.type.length === 0 || ALLOWED_MIME_TYPES.includes(file.type);
}

export async function POST(request: Request) {
  const session = await getServerSession(getAuthOptions());
  const userId = getUserId(session);

  if (!userId) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }

  const formData = await request.formData();
  const fileValue = formData.get("file");

  if (!(fileValue instanceof File)) {
    return NextResponse.json({ error: "missing file" }, { status: 400 });
  }

  if (!hasAllowedExtension(fileValue.name) || !hasAllowedMimeType(fileValue)) {
    return NextResponse.json({ error: "unsupported file type" }, { status: 400 });
  }

  if (fileValue.size > MAX_FILE_BYTES) {
    return NextResponse.json({ error: "file too large" }, { status: 413 });
  }

  const fallbackTitle = fileValue.name.replace(/\.[^.]+$/, "").trim() || "Imported document";
  const kind = fileValue.name.toLowerCase().endsWith(".epub") ? "epub" : "pdf_text";
  const document = await createImportedDocument({
    userId,
    title: fallbackTitle,
    kind,
    status: "processing",
  });

  void scheduleImportedDocumentProcessing({
    documentId: document.id,
    userId: userId,
    file: fileValue,
  });

  return NextResponse.json({
    document: {
      id: document.id,
      title: document.title,
      kind: document.kind,
      status: document.status,
      pageCount: document.pageCount,
    },
  });
}
