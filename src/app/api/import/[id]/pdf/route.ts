// Timestamp: 2026-11-15 14:10
import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { getAuthedUserId } from "@/lib/api-auth";
import { getAuthOptions } from "@/lib/auth";
import { parsePdfForReader } from "@/lib/import/pdf";
import { getImportedDocumentFileByIdForUser } from "@/lib/import/service";
import { presignGet } from "@/lib/storage/cos";

export const runtime = "nodejs";
export const maxDuration = 60;

export async function GET(
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

  const document = await getImportedDocumentFileByIdForUser(userId, context.params.id);

  if (!document) {
    return NextResponse.json({ error: "not_found" }, { status: 404 });
  }

  if (document.kind !== "pdf") {
    return NextResponse.json({ error: "unsupported_kind" }, { status: 400 });
  }

  if (document.inlineContent) {
    try {
      const { pages, unitCount } = await parsePdfForReader(document.inlineContent);
      return NextResponse.json({ pages, unitCount });
    } catch (error) {
      console.error("Imported PDF parse failed", error);
      return NextResponse.json({ error: "pdf_parse_failed" }, { status: 422 });
    }
  }

  let upstream: Response;
  try {
    const url = await presignGet({ key: document.ossKey });
    upstream = await fetch(url, { cache: "no-store" });
  } catch (error) {
    console.error("Imported PDF source fetch failed", error);
    return NextResponse.json({ error: "source_fetch_failed" }, { status: 502 });
  }

  if (!upstream.ok) {
    return NextResponse.json(
      { error: "source_unavailable", sourceStatus: upstream.status },
      { status: 502 },
    );
  }

  try {
    const buffer = await upstream.arrayBuffer();
    const { pages, unitCount } = await parsePdfForReader(new Uint8Array(buffer));
    return NextResponse.json({ pages, unitCount });
  } catch (error) {
    console.error("Imported PDF parse failed", error);
    return NextResponse.json({ error: "pdf_parse_failed" }, { status: 422 });
  }
}
