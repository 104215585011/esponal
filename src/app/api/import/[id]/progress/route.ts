// Timestamp: 2026-11-15 04:45
import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { getAuthedUserId } from "@/lib/api-auth";
import { getAuthOptions } from "@/lib/auth";
import { updateImportedDocumentProgress } from "@/lib/import/service";

export async function POST(
  request: Request,
  context: { params: { id: string } },
) {
  const userId =
    (await getAuthedUserId(request)) ??
    ((await getServerSession(getAuthOptions()))?.user as { id?: string } | undefined)?.id ??
    null;

  if (!userId) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }

  let body: { lastPosition?: unknown; unitCount?: unknown };
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "invalid_json" }, { status: 400 });
  }

  const lastPosition = typeof body.lastPosition === "string" ? body.lastPosition : "";
  const unitCount = typeof body.unitCount === "number" && Number.isFinite(body.unitCount)
    ? Math.max(0, Math.floor(body.unitCount))
    : undefined;

  const document = await updateImportedDocumentProgress({
    userId,
    documentId: context.params.id,
    lastPosition,
    unitCount,
  });

  if (!document) {
    return NextResponse.json({ error: "not_found" }, { status: 404 });
  }

  return NextResponse.json({ document });
}
