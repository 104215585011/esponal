import { NextResponse } from "next/server";
import { getAuthedUserId } from "@/lib/api-auth";
import { resolveRequestLanguage } from "@/lib/languages";
import { getVocabStats } from "@/lib/vocab";

// Web 走 NextAuth cookie,App 走 Authorization: Bearer(PLATFORM-001 双通道)
export async function GET(request: Request) {
  const userId = await getAuthedUserId(request);

  if (!userId) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }

  const { searchParams } = new URL(request.url);
  const language = await resolveRequestLanguage(
    request,
    searchParams.get("lang") ?? searchParams.get("language"),
    userId
  );

  const stats = await getVocabStats(userId, new Date(), language);
  return NextResponse.json({
    totalSaved: stats.totalSaved,
    encounterBuckets: stats.encounterBuckets,
    weeklyNew: stats.weeklyNew,
    bySource: stats.bySource
  });
}
