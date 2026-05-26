import { getServerSession } from "next-auth";
import { NextResponse } from "next/server";
import { getAuthOptions } from "@/lib/auth";
import { getVocabStats } from "@/lib/vocab";

export async function GET() {
  const session = await getServerSession(getAuthOptions());

  if (
    !session?.user ||
    !("id" in session.user) ||
    typeof session.user.id !== "string"
  ) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }

  const stats = await getVocabStats(session.user.id);
  return NextResponse.json({
    totalSaved: stats.totalSaved,
    encounterBuckets: stats.encounterBuckets,
    weeklyNew: stats.weeklyNew,
    bySource: stats.bySource
  });
}
