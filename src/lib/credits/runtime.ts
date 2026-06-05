// Timestamp: 2026-06-05 00:18
import { prisma } from "../prisma.ts";
import { applyMonthlyRefill } from "./account.ts";
import { PLAN_CONFIG, type CreditSource, type Plan } from "./config.ts";

export type UserCreditSnapshot = {
  plan: Plan;
  creditSource: CreditSource;
  creditBalanceMinor: number;
  planExpiresAt: Date | null;
  lastRefillAt: Date | null;
};

export type CreditGuardSuccess = {
  ok: true;
  snapshot: UserCreditSnapshot;
};

export type CreditGuardFailure = {
  ok: false;
  code: "UNAUTHORIZED" | "INSUFFICIENT_CREDITS" | "PLAN_UPGRADE_REQUIRED";
  snapshot: UserCreditSnapshot | null;
};

export function isMonthlyRefillDue(lastRefillAt: Date | null, now = new Date()): boolean {
  if (!lastRefillAt) {
    return true;
  }

  return (
    lastRefillAt.getUTCFullYear() !== now.getUTCFullYear() ||
    lastRefillAt.getUTCMonth() !== now.getUTCMonth()
  );
}

export async function getCreditSnapshot(userId: string): Promise<UserCreditSnapshot | null> {
  const user = await prisma.user.findUnique({
    where: { id: userId },
    select: {
      plan: true,
      creditSource: true,
      creditBalanceMinor: true,
      planExpiresAt: true,
      lastRefillAt: true,
    },
  });

  return user;
}

export async function refreshCreditsIfDue(
  userId: string,
  now = new Date(),
): Promise<UserCreditSnapshot | null> {
  return prisma.$transaction(async (tx) => {
    const user = await tx.user.findUnique({
      where: { id: userId },
      select: {
        plan: true,
        creditSource: true,
        creditBalanceMinor: true,
        planExpiresAt: true,
        lastRefillAt: true,
      },
    });

    if (!user) {
      return null;
    }

    const config = PLAN_CONFIG[user.plan];
    if (config.source === "free" || !isMonthlyRefillDue(user.lastRefillAt, now)) {
      return user;
    }

    const next = applyMonthlyRefill({
      plan: user.plan,
      source: user.creditSource,
      balanceMinor: user.creditBalanceMinor,
    });
    const deltaMinor = next.balanceMinor - user.creditBalanceMinor;

    await tx.user.update({
      where: { id: userId },
      data: {
        creditSource: config.source,
        creditBalanceMinor: next.balanceMinor,
        lastRefillAt: now,
      },
    });

    if (deltaMinor !== 0) {
      await tx.creditTransaction.create({
        data: {
          userId,
          deltaMinor,
          reason: "refill",
          balanceAfterMinor: next.balanceMinor,
        },
      });
    }

    return {
      ...user,
      creditSource: config.source,
      creditBalanceMinor: next.balanceMinor,
      lastRefillAt: now,
    };
  });
}

export async function requireCredits(
  userId: string | null,
  costMinor: number,
  now = new Date(),
): Promise<CreditGuardSuccess | CreditGuardFailure> {
  if (!userId) {
    return { ok: false, code: "UNAUTHORIZED", snapshot: null };
  }

  const snapshot = await refreshCreditsIfDue(userId, now);
  if (!snapshot) {
    return { ok: false, code: "UNAUTHORIZED", snapshot: null };
  }

  if (costMinor > 0 && snapshot.creditBalanceMinor < costMinor) {
    return { ok: false, code: "INSUFFICIENT_CREDITS", snapshot };
  }

  return { ok: true, snapshot };
}

export async function requirePlan(
  userId: string | null,
  allowedPlans: Plan[],
  now = new Date(),
): Promise<CreditGuardSuccess | CreditGuardFailure> {
  if (!userId) {
    return { ok: false, code: "UNAUTHORIZED", snapshot: null };
  }

  const snapshot = await refreshCreditsIfDue(userId, now);
  if (!snapshot) {
    return { ok: false, code: "UNAUTHORIZED", snapshot: null };
  }

  if (!allowedPlans.includes(snapshot.plan)) {
    return { ok: false, code: "PLAN_UPGRADE_REQUIRED", snapshot };
  }

  return { ok: true, snapshot };
}
