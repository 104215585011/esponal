// Timestamp: 2026-06-05 10:38
import { NextResponse } from "next/server";
import { getAuthedUserId } from "@/lib/api-auth";
import { getCreditSummary } from "@/lib/credits/summary";

export const dynamic = "force-dynamic";

export async function GET(request: Request) {
  // cookie(Web) | Bearer(App) 双通道
  const userId = await getAuthedUserId(request);

  if (!userId) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const summary = await getCreditSummary(userId);
  return NextResponse.json({
    plan: summary.plan,
    currentPlan: summary.currentPlan,
    currentCycle: summary.currentCycle,
    balanceDisplay: summary.balanceDisplay,
    balanceMinor: summary.balanceMinor
  });
}
