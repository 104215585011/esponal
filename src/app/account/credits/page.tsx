// Timestamp: 2026-06-08 12:26
import Link from "next/link";
import { getServerSession } from "next-auth";
import { redirect } from "next/navigation";
import CreditHistoryClient from "@/app/account/credits/CreditHistoryClient";
import { SiteHeader } from "@/app/components/web/SiteHeader";
import { getAuthOptions } from "@/lib/auth";
import {
  ACTION_COST_MINOR,
  PLAN_CONFIG,
  toDisplay,
  type Plan,
} from "@/lib/credits/config";
import { getCreditTransactionsPage } from "@/lib/credits/history";
import { prisma } from "@/lib/prisma";
import { getCurrentCycle, getCreditSummary } from "@/lib/credits/summary";

type SessionUserWithId = {
  id?: string;
};

const PLAN_NAME: Record<Plan, string> = {
  free: "免费方案",
  premium_m: "进阶会员",
  premium_y: "进阶会员",
  ultra_m: "高阶会员",
  ultra_y: "高阶会员",
  lifetime_premium: "共建者 · 进阶",
  lifetime_ultra: "共建者 · 高阶",
};

const COST_ITEMS = [
  {
    label: "AI 对话",
    unit: "每轮",
    value: toDisplay(ACTION_COST_MINOR.talk_turn),
  },
  {
    label: "发音朗读",
    unit: "每次",
    value: toDisplay(ACTION_COST_MINOR.tts),
  },
  {
    label: "查词(AI 回落)",
    unit: "每次",
    value: toDisplay(ACTION_COST_MINOR.lookup_fallback),
  },
  {
    label: "短语提取",
    unit: "每句",
    value: toDisplay(ACTION_COST_MINOR.phrase_extract_per_sentence),
  },
  {
    label: "视频字幕解锁",
    unit: "每次",
    value: toDisplay(ACTION_COST_MINOR.video_unlock_short),
  },
] as const;

const FREE_ITEMS = [
  "看缓存视频",
  "本地词典查词",
  "复习 / SRS",
  "收藏(限 50 词)",
  "重看已解锁字幕",
] as const;

export const dynamic = "force-dynamic";

function formatMonthDay(value: Date) {
  return new Intl.DateTimeFormat("zh-CN", {
    month: "numeric",
    day: "numeric",
  }).format(value);
}

function getNextMonthlyRefill(lastRefillAt: Date | null) {
  const base = lastRefillAt ?? new Date();
  return new Date(Date.UTC(base.getUTCFullYear(), base.getUTCMonth() + 1, 1));
}

export default async function AccountCreditsPage() {
  const session = await getServerSession(getAuthOptions());
  const userId = (session?.user as SessionUserWithId | undefined)?.id;

  if (!userId) {
    redirect("/auth/sign-in?callbackUrl=/account/credits");
  }

  const [summary, userMeta, transactions] = await Promise.all([
    getCreditSummary(userId),
    prisma.user.findUnique({
      where: { id: userId },
      select: {
        plan: true,
        lastRefillAt: true,
      },
    }),
    getCreditTransactionsPage(userId, { limit: 20 }),
  ]);

  const plan = userMeta?.plan ?? summary.currentPlan;
  const cycle = getCurrentCycle(plan);
  const monthlyQuotaDisplay = toDisplay(PLAN_CONFIG[plan].monthlyMinor);
  const refreshCopy =
    cycle === "free"
      ? "注册赠送一次"
      : cycle === "founder"
        ? `每月 ${monthlyQuotaDisplay} · 累加`
        : `每月 ${monthlyQuotaDisplay} · ${formatMonthDay(getNextMonthlyRefill(userMeta?.lastRefillAt ?? null))} 刷新`;

  return (
    <main className="min-h-screen bg-white md:bg-app">
      <SiteHeader />
      <div className="mx-auto w-full max-w-app-shell px-5 pb-[calc(5rem+env(safe-area-inset-bottom))] pt-6 md:px-6 md:py-10 lg:px-8">
        <section className="mx-auto max-w-[960px] space-y-5 md:space-y-6">
          <div className="overflow-hidden rounded-[30px] bg-[linear-gradient(140deg,#0e3b2c_0%,#10b981_130%)] px-5 py-6 text-white shadow-[0_26px_60px_-34px_rgba(16,185,129,0.8)] md:px-8 md:py-7">
            <div className="text-xs font-medium text-white/80">当前配额余额</div>
            <div className="mt-2 flex items-end gap-2">
              <span className="font-display text-[40px] font-extrabold leading-none">
                {summary.balanceDisplay}
              </span>
              <span className="pb-1 text-sm text-white/85">配额</span>
            </div>
            <div className="mt-5 flex flex-wrap items-center gap-2">
              <span className="rounded-full bg-white/16 px-3 py-1 text-xs font-semibold">
                {PLAN_NAME[plan]}
              </span>
              <span className="rounded-full bg-white/16 px-3 py-1 text-xs font-semibold">
                {refreshCopy}
              </span>
              <Link
                className="ml-auto inline-flex min-h-[40px] items-center rounded-full bg-white px-4 text-sm font-semibold text-brand-700"
                href="/membership"
              >
                管理会员
              </Link>
            </div>
          </div>

          <div className="rounded-[28px] border border-zinc-200 bg-white p-5 shadow-[0_18px_40px_-28px_rgba(15,23,42,0.22)] md:p-6">
            <div className="text-[11px] font-semibold uppercase tracking-[0.18em] text-brand-600">
              Quota Guide
            </div>
            <h2 className="mt-2 text-[24px] font-semibold tracking-tight text-zinc-950">
              配额消耗说明
            </h2>
            <div className="mt-4 rounded-[22px] border border-zinc-200 bg-zinc-50/80 p-3 md:p-4">
              <div className="space-y-2.5">
                {COST_ITEMS.map((item) => (
                  <div
                    key={item.label}
                    className="flex items-center justify-between rounded-[18px] bg-white px-4 py-3"
                  >
                    <div>
                      <div className="text-[15px] font-semibold text-zinc-950">{item.label}</div>
                      <div className="mt-1 text-[13px] text-zinc-500">{item.unit}</div>
                    </div>
                    <div className="rounded-full bg-emerald-50 px-3 py-1.5 text-[13px] font-semibold text-emerald-700">
                      {item.value} 配额
                    </div>
                  </div>
                ))}
              </div>
            </div>

            <div className="mt-4 rounded-[22px] border border-zinc-200 bg-white p-4">
              <div className="text-sm font-semibold text-zinc-950">免费动作</div>
              <div className="mt-3 flex flex-wrap gap-2">
                {FREE_ITEMS.map((item) => (
                  <span
                    key={item}
                    className="inline-flex min-h-[36px] items-center rounded-full bg-zinc-100 px-3.5 text-[13px] font-medium text-zinc-700"
                  >
                    {item}
                  </span>
                ))}
              </div>
            </div>

            <p className="mt-4 text-[13px] leading-6 text-zinc-500">
              配额仅用于 AI 加工;费率以实际扣费为准,数值随版本可能调整。
            </p>
          </div>

          <CreditHistoryClient
            initialItems={transactions.items}
            initialNextCursor={transactions.nextCursor}
            membershipHref="/membership"
          />
        </section>
      </div>
    </main>
  );
}
