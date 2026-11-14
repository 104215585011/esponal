// Timestamp: 2026-11-15 04:45
import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { getAuthedUserId } from "@/lib/api-auth";
import { getAuthOptions } from "@/lib/auth";
import { parseEpubForReader } from "@/lib/import/epub";
import { getImportedDocumentFileByIdForUser } from "@/lib/import/service";
import { presignGet } from "@/lib/storage/cos";

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

  if (document.kind !== "epub") {
    return NextResponse.json({ error: "unsupported_kind" }, { status: 400 });
  }

  if (document.inlineContent) {
    try {
      const { chapters } = parseEpubForReader(document.inlineContent);
      return NextResponse.json({ chapters, unitCount: chapters.length });
    } catch (error) {
      console.error("Imported EPUB parse failed", error);
      return NextResponse.json({ error: "epub_parse_failed" }, { status: 422 });
    }
  }

  let upstream: Response;
  try {
    const url = await presignGet({ key: document.ossKey });
    upstream = await fetch(url, { cache: "no-store" });
  } catch (error) {
    console.error("Imported EPUB source fetch failed", error);
    return NextResponse.json({ error: "source_fetch_failed" }, { status: 502 });
  }

  const sourceContentType = upstream.headers.get("content-type") ?? "";

  if (!upstream.ok) {
    return NextResponse.json(
      {
        error: "source_unavailable",
        sourceStatus: upstream.status,
        sourceContentType,
      },
      { status: 502 },
    );
  }

  try {
    const buffer = await upstream.arrayBuffer();
    const { chapters } = parseEpubForReader(new Uint8Array(buffer));
    return NextResponse.json({ chapters, unitCount: chapters.length });
  } catch (error) {
    console.error("Imported EPUB parse failed", error);
    return NextResponse.json({ error: "epub_parse_failed" }, { status: 422 });
  }
}
