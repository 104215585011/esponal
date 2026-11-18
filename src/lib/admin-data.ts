// Timestamp: 2026-11-18 10:58
import { Prisma } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { adminDayStart, parseAdminChange } from "@/lib/admin-input";

const quotaUnits: Record<string, string> = {
  supadata: "credits", youtube: "units", youtube_search: "search_calls", deepseek: "tokens",
  dashscope: "tokens", apify: "calls", whisper: "calls", fish: "characters", edge: "characters"
};

const userFields = {
  id: true, name: true, email: true, plan: true, planExpiresAt: true,
  creditBalanceMinor: true, featurePolicies: true
} satisfies Prisma.UserSelect;

export async function readAdminUsers(query: string) {
  return prisma.user.findMany({
    where: query ? { OR: [
      { email: { contains: query, mode: "insensitive" } },
      { name: { contains: query, mode: "insensitive" } }
    ] } : undefined,
    orderBy: [{ createdAt: "desc" }, { id: "desc" }],
    take: 30,
    select: userFields
  });
}

export async function readAdminUsage(period: "day" | "month", userId: string | null) {
  const now = new Date();
  const shifted = new Date(now.getTime() + 8 * 3600000);
  const from = period === "day" ? adminDayStart(now) :
    new Date(Date.UTC(shifted.getUTCFullYear(), shifted.getUTCMonth(), 1, -8));
  const [groups, quotas, first] = await Promise.all([
    prisma.apiUsageEvent.groupBy({
      by: ["provider", "feature", "origin", "outcome", "unit"],
      where: { createdAt: { gte: from }, ...(userId ? { userId } : {}) },
      _count: { _all: true, units: true },
      _sum: { units: true }
    }),
    prisma.apiQuota.findMany(),
    prisma.apiUsageEvent.findFirst({ orderBy: { createdAt: "asc" }, select: { createdAt: true } })
  ]);
  const budgets = await Promise.all(Object.entries(quotaUnits).map(async ([provider, unit]) => {
    const quota = quotas.find((item) => item.provider === provider);
    const active = quota && quota.resetAt > now;
    const observed = active ? await prisma.apiUsageEvent.aggregate({
      where: { provider, unit, createdAt: { gte: quota.updatedAt, lt: quota.resetAt } },
      _sum: { units: true }, _count: { _all: true, units: true }
    }) : null;
    const used = active ? quota.baseline + (observed?._sum.units ?? 0) : null;
    return {
      provider, unit, quota, used, remaining: active && used !== null ? Math.max(0, quota.allowance - used) : null,
      unmetered: observed ? observed._count._all - observed._count.units : 0
    };
  }));
  return { since: first?.createdAt ?? null, from, groups, budgets };
}

export async function saveAdminQuota(actorId: string, input: Record<string, unknown>) {
  const { provider, allowance, baseline, resetAt: resetText } = input;
  const usdPerThousand = input.usdPerThousand ?? null;
  const reason = typeof input.reason === "string" ? input.reason.trim() : "";
  if (typeof provider !== "string" || !Object.hasOwn(quotaUnits, provider) ||
      typeof allowance !== "number" || !Number.isInteger(allowance) || allowance < 1 || allowance > 2147483647 ||
      typeof baseline !== "number" || !Number.isInteger(baseline) || baseline < 0 || baseline > 2147483647 ||
      (usdPerThousand !== null && (typeof usdPerThousand !== "number" || !Number.isFinite(usdPerThousand) || usdPerThousand < 0 || usdPerThousand > 1000000)) ||
      typeof resetText !== "string" || !reason || reason.length > 300) return false;
  const resetAt = new Date(resetText);
  if (!Number.isFinite(+resetAt) || resetAt <= new Date()) return false;
  const data = { unit: quotaUnits[provider], allowance, baseline, resetAt, usdPerThousand };
  await prisma.$transaction(async (tx) => {
    const before = await tx.apiQuota.findUnique({ where: { provider } });
    await tx.apiQuota.upsert({ where: { provider }, create: { provider, ...data }, update: data });
    await tx.adminAction.create({ data: {
      actorId, target: provider, action: "quota", reason,
      before: before ? { ...before, resetAt: before.resetAt.toISOString(), updatedAt: before.updatedAt.toISOString() } : Prisma.JsonNull,
      after: { ...data, resetAt: resetAt.toISOString() }
    } });
  }, { isolationLevel: "Serializable" });
  return true;
}

export async function changeAdminUser(actorId: string, userId: string, change: NonNullable<ReturnType<typeof parseAdminChange>>) {
  return prisma.$transaction(async (tx) => {
    const user = await tx.user.findUnique({ where: { id: userId }, select: userFields });
    if (!user) return "找不到该用户";
    let before: Prisma.InputJsonObject | typeof Prisma.JsonNull;
    let after: Prisma.InputJsonObject;
    if (change.action === "credits") {
      const balance = user.creditBalanceMinor + change.value;
      if (balance < 0 || balance > 2147483647) return "积分余额超出范围";
      before = { creditBalanceMinor: user.creditBalanceMinor };
      after = { creditBalanceMinor: balance };
      await tx.user.update({ where: { id: userId }, data: { creditBalanceMinor: balance } });
      await tx.creditTransaction.create({ data: {
        userId, deltaMinor: change.value, balanceAfterMinor: balance, reason: "adjustment", refType: "admin"
      } });
    } else if (change.action === "extend") {
      if (!["premium_m", "premium_y", "ultra_m", "ultra_y"].includes(user.plan)) return "仅有期限的会员可以延长";
      const expiry = new Date(Math.max(Date.now(), user.planExpiresAt?.getTime() ?? 0) + change.value * 86400000);
      before = { planExpiresAt: user.planExpiresAt?.toISOString() ?? null };
      after = { planExpiresAt: expiry.toISOString() };
      await tx.user.update({ where: { id: userId }, data: { planExpiresAt: expiry } });
    } else {
      const key = { userId, feature: change.feature };
      const old = user.featurePolicies.find((rule) => rule.feature === change.feature);
      const rule = { enabled: change.enabled, dailyLimit: change.limit };
      before = old ? { feature: old.feature, enabled: old.enabled, dailyLimit: old.dailyLimit } : Prisma.JsonNull;
      after = { feature: change.feature, ...rule };
      await tx.adminFeaturePolicy.upsert({ where: { userId_feature: key }, create: { ...key, ...rule }, update: rule });
    }
    await tx.adminAction.create({ data: {
      actorId, target: user.email ?? user.id, action: change.action, reason: change.reason, before, after
    } });
    return null;
  }, { isolationLevel: "Serializable" });
}
