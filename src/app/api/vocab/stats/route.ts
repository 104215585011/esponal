import { NextResponse } from "next/server";
import { getAuthedUserId } from "@/lib/api-auth";
import { getVocabStats } from "@/lib/vocab";

// Web 走 NextAuth cookie,App 走 Authorization: Bearer(PLATFORM-001 双通道)
export async function GET(request: Request) {
  const userId = await getAuthedUserId(request);

  if (!userId) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }

  const stats = await getVocabStats(userId);
  return NextResponse.json({
    totalSaved: stats.totalSaved,
    encounterBuckets: stats.encounterBuckets,
    weeklyNew: stats.weeklyNew,
    bySource: stats.bySource
  });
}
