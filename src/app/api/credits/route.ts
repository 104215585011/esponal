// Timestamp: 2026-06-05 10:38
import { getServerSession } from "next-auth";
import { NextResponse } from "next/server";
import { getAuthOptions } from "@/lib/auth";
import { getCreditSummary } from "@/lib/credits/summary";

type SessionUserWithId = {
  id?: string;
};

export const dynamic = "force-dynamic";

export async function GET() {
  const session = await getServerSession(getAuthOptions());
  const userId = (session?.user as SessionUserWithId | undefined)?.id;

  if (!userId) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const summary = await getCreditSummary(userId);
  return NextResponse.json({
    plan: summary.plan,
    balanceDisplay: summary.balanceDisplay,
    balanceMinor: summary.balanceMinor
  });
}
