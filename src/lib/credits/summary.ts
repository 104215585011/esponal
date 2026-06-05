// Timestamp: 2026-06-05 11:05
import { toDisplay, type Plan } from "./config.ts";
import { getCreditSnapshot, refreshCreditsIfDue } from "./runtime.ts";
import { ensureSignupGrant } from "./service.ts";

export type CreditCycle = "free" | "monthly" | "yearly" | "founder";

export type CreditSummary = {
  plan: Plan;
  currentPlan: Plan;
  currentCycle: CreditCycle;
  planLabel: string;
  balanceMinor: number;
  balanceDisplay: number;
};

const PLAN_LABELS: Record<Plan, string> = {
  free: "免费",
  premium_m: "进阶（月付）",
  premium_y: "进阶（年付）",
  ultra_m: "高阶（月付）",
  ultra_y: "高阶（年付）",
  lifetime_premium: "共建者 · 进阶",
  lifetime_ultra: "共建者 · 高阶",
};

export function getCurrentCycle(plan: Plan): CreditCycle {
  if (plan === "premium_m" || plan === "ultra_m") {
    return "monthly";
  }

  if (plan === "premium_y" || plan === "ultra_y") {
    return "yearly";
  }

  if (plan === "lifetime_premium" || plan === "lifetime_ultra") {
    return "founder";
  }

  return "free";
}

export async function getCreditSummary(userId: string): Promise<CreditSummary> {
  await ensureSignupGrant(userId);
  const snapshot = (await refreshCreditsIfDue(userId)) ?? (await getCreditSnapshot(userId));

  if (!snapshot) {
    return {
      plan: "free",
      currentPlan: "free",
      currentCycle: "free",
      planLabel: PLAN_LABELS.free,
      balanceMinor: 0,
      balanceDisplay: 0,
    };
  }

  return {
    plan: snapshot.plan,
    currentPlan: snapshot.plan,
    currentCycle: getCurrentCycle(snapshot.plan),
    planLabel: PLAN_LABELS[snapshot.plan],
    balanceMinor: snapshot.creditBalanceMinor,
    balanceDisplay: toDisplay(snapshot.creditBalanceMinor),
  };
}
