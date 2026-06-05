// Timestamp: 2026-06-05 10:38
import { toDisplay, type Plan } from "./config.ts";
import { getCreditSnapshot, refreshCreditsIfDue } from "./runtime.ts";
import { ensureSignupGrant } from "./service.ts";

export type CreditSummary = {
  plan: Plan;
  planLabel: string;
  balanceMinor: number;
  balanceDisplay: number;
};

const PLAN_LABELS: Record<Plan, string> = {
  free: "免费",
  premium_m: "进阶",
  premium_y: "进阶年付",
  ultra_m: "高阶",
  ultra_y: "高阶年付",
  lifetime_premium: "终身进阶",
  lifetime_ultra: "终身高阶"
};

export async function getCreditSummary(userId: string): Promise<CreditSummary> {
  await ensureSignupGrant(userId);
  const snapshot = (await refreshCreditsIfDue(userId)) ?? (await getCreditSnapshot(userId));

  if (!snapshot) {
    return {
      plan: "free",
      planLabel: PLAN_LABELS.free,
      balanceMinor: 0,
      balanceDisplay: 0
    };
  }

  return {
    plan: snapshot.plan,
    planLabel: PLAN_LABELS[snapshot.plan],
    balanceMinor: snapshot.creditBalanceMinor,
    balanceDisplay: toDisplay(snapshot.creditBalanceMinor)
  };
}
