// Timestamp: 2026-11-15 03:18
import { NextResponse } from "next/server";
import { getAuthedUserId } from "@/lib/api-auth";
import { listImportedDocumentsForUser } from "@/lib/import/service";

export const dynamic = "force-dynamic";

export async function GET(request: Request) {
  const userId = await getAuthedUserId(request);

  if (!userId) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }

  const documents = await listImportedDocumentsForUser(userId);

  return NextResponse.json({ documents });
}
