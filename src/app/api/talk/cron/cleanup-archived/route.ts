import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { cleanupArchivedSessions } from "@/lib/talk/session-service";

function getBearerToken(request: Request) {
  const header = request.headers.get("Authorization") ?? "";
  const match = header.match(/^Bearer\s+(.+)$/i);
  return match?.[1] ?? "";
}

export async function GET(request: Request) {
  const expectedSecret = process.env.CRON_SECRET ?? "";
  if (!expectedSecret || getBearerToken(request) !== expectedSecret) {
    return NextResponse.json({ error: { code: "UNAUTHORIZED" } }, { status: 401 });
  }

  const deletedCount = await cleanupArchivedSessions(prisma);
  return NextResponse.json({ deletedCount });
}
