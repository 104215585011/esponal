// Timestamp: 2026-06-08 21:42
import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { getAuthOptions } from "@/lib/auth";
import { createImportedDocument } from "@/lib/import/service";

function getUserId(session: unknown) {
  const maybeSession = session as { user?: { id?: unknown } } | null;
  return maybeSession?.user && typeof maybeSession.user.id === "string"
    ? maybeSession.user.id
    : null;
}

export async function POST(request: Request) {
  const session = await getServerSession(getAuthOptions());
  const userId = getUserId(session);

  if (!userId) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }

  let body: {
    title?: unknown;
    kind?: unknown;
    ossKey?: unknown;
    sizeBytes?: unknown;
    unitCount?: unknown;
  };
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "invalid_json" }, { status: 400 });
  }

  if (body.kind !== "epub" && body.kind !== "pdf") {
    return NextResponse.json({ error: "unsupported_file_type" }, { status: 400 });
  }

  const ossKey = typeof body.ossKey === "string" ? body.ossKey.trim() : "";
  if (!ossKey.startsWith(`imports/${userId}/`)) {
    return NextResponse.json({ error: "invalid_oss_key" }, { status: 400 });
  }

  const sizeBytes = typeof body.sizeBytes === "number" ? body.sizeBytes : Number(body.sizeBytes);
  if (!Number.isFinite(sizeBytes) || sizeBytes <= 0) {
    return NextResponse.json({ error: "invalid_size" }, { status: 400 });
  }

  const title = typeof body.title === "string" && body.title.trim()
    ? body.title.trim()
    : "Imported document";
  const unitCount = typeof body.unitCount === "number" && Number.isFinite(body.unitCount)
    ? Math.max(0, Math.floor(body.unitCount))
    : 0;

  const document = await createImportedDocument({
    userId,
    title,
    kind: body.kind,
    ossKey,
    sizeBytes,
    unitCount,
  });

  return NextResponse.json({ document });
}
