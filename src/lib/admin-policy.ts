// Timestamp: 2026-11-18 10:58
import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { adminDayStart, type AdminFeature } from "@/lib/admin-input";

export async function checkAdminFeature(userId: string | null, feature: AdminFeature, count = true) {
  if (!userId) return null;
  const rule = await prisma.adminFeaturePolicy.findUnique({ where: { userId_feature: { userId, feature } } });
  if (!rule) return null;
  if (!rule.enabled) {
    return NextResponse.json({ error: { code: "FEATURE_DISABLED", message: "该功能已暂停，请联系管理员。" } }, { status: 403 });
  }
  if (!count || rule.dailyLimit === null) return null;

  const key = { userId, feature, day: adminDayStart().toISOString() };
  await prisma.adminFeatureCounter.upsert({ where: { userId_feature_day: key }, create: key, update: {} });
  const result = await prisma.adminFeatureCounter.updateMany({
    where: { ...key, used: { lt: rule.dailyLimit } },
    data: { used: { increment: 1 } }
  });
  if (result.count) return null;
  return NextResponse.json({ error: { code: "DAILY_LIMIT", message: "已达到该功能的今日使用上限。" } }, { status: 429 });
}
