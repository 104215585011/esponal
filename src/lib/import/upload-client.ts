// Timestamp: 2026-06-10 09:35

export type UploadImportKind = "epub" | "pdf";

export type UploadImportedDocumentOptions = {
  file: File;
  title?: string;
  onProgress?: (progress: number) => void;
};

type PresignResponse = {
  uploadUrl: string;
  ossKey: string;
  contentType: string;
  maxFileBytes: number;
  error?: string;
};

type DocumentResponse = {
  document?: unknown;
  error?: string;
};

const PROXY_UPLOAD_MAX_FILE_BYTES = 4 * 1024 * 1024;

class CosUploadError extends Error {
  constructor(
    public readonly status: number,
    public readonly responseText: string,
  ) {
    super(`cos_upload_failed:${status}`);
  }
}

export function inferImportKind(file: File): UploadImportKind | null {
  const name = file.name.toLowerCase();
  if (name.endsWith(".epub") || file.type === "application/epub+zip") {
    return "epub";
  }
  if (name.endsWith(".pdf") || file.type === "application/pdf") {
    return "pdf";
  }
  return null;
}

function putFileWithProgress(uploadUrl: string, file: File, contentType: string, onProgress?: (progress: number) => void) {
  return new Promise<void>((resolve, reject) => {
    const request = new XMLHttpRequest();
    request.open("PUT", uploadUrl);
    request.setRequestHeader("Content-Type", contentType);
    request.upload.onprogress = (event) => {
      if (!event.lengthComputable || !onProgress) return;
      onProgress(Math.round((event.loaded / event.total) * 100));
    };
    request.onload = () => {
      if (request.status >= 200 && request.status < 300) {
        onProgress?.(100);
        resolve();
        return;
      }
      reject(new CosUploadError(request.status, request.responseText));
    };
    request.onerror = () => reject(new CosUploadError(0, ""));
    request.send(file);
  });
}

async function uploadViaProxy(file: File, title: string | undefined, onProgress?: (progress: number) => void) {
  const formData = new FormData();
  formData.append("file", file);
  if (title?.trim()) {
    formData.append("title", title.trim());
  }

  const response = await fetch("/api/import/upload", {
    method: "POST",
    body: formData,
  });
  const payload = (await response.json()) as DocumentResponse;
  if (!response.ok || !payload.document) {
    throw new Error(payload.error ?? "proxy_upload_failed");
  }
  onProgress?.(100);
  return payload.document;
}

export async function uploadImportedDocument({ file, title, onProgress }: UploadImportedDocumentOptions) {
  const kind = inferImportKind(file);
  if (!kind) {
    throw new Error("unsupported_file_type");
  }

  const contentType = file.type || (kind === "epub" ? "application/epub+zip" : "application/pdf");
  const presignResponse = await fetch("/api/import/presign", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      filename: file.name,
      kind,
      sizeBytes: file.size,
      contentType,
    }),
  });
  const presignPayload = (await presignResponse.json()) as PresignResponse;
  if (!presignResponse.ok || !presignPayload.uploadUrl || !presignPayload.ossKey) {
    throw new Error(presignPayload.error ?? "presign_failed");
  }

  try {
    await putFileWithProgress(presignPayload.uploadUrl, file, presignPayload.contentType || contentType, onProgress);
  } catch (error) {
    if (error instanceof CosUploadError && error.status === 451 && file.size <= PROXY_UPLOAD_MAX_FILE_BYTES) {
      return uploadViaProxy(file, title, onProgress);
    }
    throw error;
  }

  const documentResponse = await fetch("/api/import/document", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      title: title?.trim() || file.name.replace(/\.[^.]+$/, ""),
      kind,
      ossKey: presignPayload.ossKey,
      sizeBytes: file.size,
    }),
  });
  const documentPayload = (await documentResponse.json()) as DocumentResponse;
  if (!documentResponse.ok || !documentPayload.document) {
    throw new Error(documentPayload.error ?? "document_create_failed");
  }

  return documentPayload.document;
}
