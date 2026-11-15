// Timestamp: 2026-11-15 15:08
import { NextResponse } from "next/server";
import { getAuthedUserId } from "@/lib/api-auth";
import { listImportedDocumentsForUser } from "@/lib/import/service";
import { resolveRequestLanguage } from "@/lib/languages";

export const dynamic = "force-dynamic";

export async function GET(request: Request) {
  const userId = await getAuthedUserId(request);

  if (!userId) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }

  const { searchParams } = new URL(request.url);
  const showAll = searchParams.get("all") === "1";
  const language = showAll
    ? undefined
    : await resolveRequestLanguage(
        request,
        searchParams.get("lang") ?? searchParams.get("language"),
        userId
      );
  const documents = await listImportedDocumentsForUser(userId, language);

  return NextResponse.json({ documents });
}
