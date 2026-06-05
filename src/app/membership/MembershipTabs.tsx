// Timestamp: 2026-06-05 11:05
"use client";

import { useMemo, useState } from "react";
import type { Plan } from "@/lib/credits/config";
import type { CreditCycle } from "@/lib/credits/summary";

export type BillingCycle = "monthly" | "yearly" | "founder";

type MembershipTabsProps = {
  balanceDisplay: number;
  currentPlan: Plan;
  currentPlanLabel: string;
  currentCycle: CreditCycle;
};

type PlanCard = {
  id: Plan;
  name: string;
  price: string;
  unit?: string;
  subtitle: string;
  quota: string;
  features: string[];
  recommended?: boolean;
  tier: 0 | 1 | 2;
  scarcity?: {
    joined: string;
    limit: string;
    progress: string;
  };
};

const tabs: Array<{ id: BillingCycle; label: string; badge?: string }> = [
  { id: "monthly", label: "月付" },
  { id: "yearly", label: "年付", badge: "省 16%" },
  { id: "founder", label: "共建者" },
];

const plansByCycle: Record<BillingCycle, PlanCard[]> = {
  monthly: [
    {
      id: "free",
      name: "免费",
      price: "¥0",
      subtitle: "注册即送，先体验核心功能",
      quota: "注册一次性送 50 配额",
      features: ["平台字幕、本地查词、复习", "收藏上限 50"],
      tier: 0,
    },
    {
      id: "premium_m",
      name: "进阶",
      price: "¥38",
      unit: "/月",
      subtitle: "3 天免费试用",
      quota: "500 配额 / 月",
      features: ["无限收藏", "高质量断句字幕与中文对照", "短语 / 搭配高亮"],
      recommended: true,
      tier: 1,
    },
    {
      id: "ultra_m",
      name: "高阶",
      price: "¥48",
      unit: "/月",
      subtitle: "3 天免费试用",
      quota: "1000 配额 / 月",
      features: ["包含进阶全部能力", "新功能优先体验", "优先技术支持"],
      tier: 2,
    },
  ],
  yearly: [
    {
      id: "premium_y",
      name: "进阶",
      price: "¥365",
      unit: "/年",
      subtitle: "约 ¥30 / 月，3 天免费试用",
      quota: "500 配额 / 月",
      features: ["无限收藏", "高质量字幕翻译", "短语提取与高亮"],
      recommended: true,
      tier: 1,
    },
    {
      id: "ultra_y",
      name: "高阶",
      price: "¥458",
      unit: "/年",
      subtitle: "约 ¥38 / 月，3 天免费试用",
      quota: "1000 配额 / 月",
      features: ["包含进阶全部能力", "新功能优先体验", "优先技术支持"],
      tier: 2,
    },
  ],
  founder: [
    {
      id: "lifetime_premium",
      name: "共建者 · 进阶",
      price: "¥1498",
      subtitle: "一次买断 · 永久",
      quota: "500 配额 / 月 · 按月累加",
      features: ["包含进阶全部能力", "专属会员编号"],
      tier: 1,
      scarcity: {
        joined: "188 位共建者已加入",
        limit: "限量 500",
        progress: "38%",
      },
    },
    {
      id: "lifetime_ultra",
      name: "共建者 · 高阶",
      price: "¥1998",
      subtitle: "一次买断 · 永久",
      quota: "1000 配额 / 月 · 按月累加",
      features: ["包含高阶全部能力", "新功能优先体验", "专属会员编号"],
      recommended: true,
      tier: 2,
      scarcity: {
        joined: "350 位共建者已加入",
        limit: "限量 500",
        progress: "70%",
      },
    },
  ],
};

function getPlanTier(plan: Plan): 0 | 1 | 2 {
  if (plan === "free") {
    return 0;
  }

  if (plan === "premium_m" || plan === "premium_y" || plan === "lifetime_premium") {
    return 1;
  }

  return 2;
}

function shouldShowRecommendedBadge(
  plan: PlanCard,
  currentPlan: Plan,
  currentCycle: CreditCycle,
): boolean {
  if (!plan.recommended) {
    return false;
  }

  return currentPlan === "free" && currentCycle === "free";
}

function getVisiblePlansForCycle(
  cycle: BillingCycle,
  currentPlan: Plan,
  currentCycle: CreditCycle,
): PlanCard[] {
  const cards = plansByCycle[cycle];

  if (currentPlan === "free" && currentCycle === "free") {
    return cards;
  }

  if (currentCycle === "founder" && cycle !== "founder") {
    return [];
  }

  if (currentCycle === "monthly" && cycle === "yearly") {
    return [];
  }

  if (currentCycle === "yearly" && cycle === "monthly") {
    return [];
  }

  if (
    (cycle === "monthly" && currentCycle === "monthly") ||
    (cycle === "yearly" && currentCycle === "yearly") ||
    (cycle === "founder" && currentCycle === "founder")
  ) {
    const currentTier = getPlanTier(currentPlan);
    return cards.filter((plan) => plan.tier >= currentTier);
  }

  return cards;
}

function getPlanButtonLabel(
  plan: PlanCard,
  currentPlan: Plan,
  currentCycle: CreditCycle,
): string {
  if (currentPlan === "free" && plan.id === "free") {
    return "当前方案";
  }

  if (plan.id === currentPlan) {
    return currentCycle === "founder" ? "当前方案" : "点击续费";
  }

  if (currentPlan !== "free") {
    return "点击升级";
  }

  return "立即购买";
}

function getPlanButtonTone(
  plan: PlanCard,
  currentPlan: Plan,
  currentCycle: CreditCycle,
): "primary" | "ghost" | "current" {
  if ((currentPlan === "free" && plan.id === "free") || (plan.id === currentPlan && currentCycle === "founder")) {
    return "current";
  }

  if (plan.id === currentPlan) {
    return "primary";
  }

  if (currentPlan !== "free") {
    return "ghost";
  }

  return plan.recommended ? "primary" : "ghost";
}

function isButtonDisabled(plan: PlanCard, currentPlan: Plan, currentCycle: CreditCycle) {
  return (
    (currentPlan === "free" && plan.id === "free") ||
    (plan.id === currentPlan && currentCycle === "founder")
  );
}

export function MembershipTabs({
  balanceDisplay,
  currentPlan,
  currentPlanLabel,
  currentCycle,
}: MembershipTabsProps) {
  const [cycle, setCycle] = useState<BillingCycle>("monthly");
  const cards = useMemo(
    () => getVisiblePlansForCycle(cycle, currentPlan, currentCycle),
    [cycle, currentPlan, currentCycle],
  );

  return (
    <div className="mt-7">
      <div className="flex flex-col items-center gap-3">
        <div className="inline-flex items-center gap-2 rounded-full border border-brand-100 bg-brand-50 px-3 py-1.5 text-[12px] font-semibold text-brand-700">
          <span>⚡</span>
          <span>{balanceDisplay} 配额</span>
          <span className="text-brand-500/70">·</span>
          <span>{currentPlanLabel}</span>
        </div>

        <div className="inline-flex w-full max-w-[520px] rounded-2xl border border-zinc-200 bg-zinc-50 p-1.5">
          {tabs.map((tab) => (
            <button
              aria-pressed={cycle === tab.id}
              className={`flex min-h-[44px] flex-1 items-center justify-center gap-1 rounded-[12px] px-3 text-sm font-semibold transition ${
                cycle === tab.id
                  ? "bg-white text-zinc-950 shadow-sm"
                  : "text-zinc-500 hover:text-zinc-900"
              }`}
              key={tab.id}
              onClick={() => setCycle(tab.id)}
              type="button"
            >
              <span>{tab.label}</span>
              {tab.badge ? (
                <span className="rounded-full bg-brand-50 px-1.5 py-0.5 text-[10px] font-semibold text-brand-700">
                  {tab.badge}
                </span>
              ) : null}
            </button>
          ))}
        </div>
      </div>

      {cards.length === 0 ? (
        <div className="mt-6 rounded-[24px] border border-zinc-200 bg-zinc-50 px-5 py-8 text-center text-sm text-zinc-500">
          当前方案已覆盖这个周期，无需重复购买。
        </div>
      ) : null}

      <div className="mt-6 grid gap-4 lg:grid-cols-3">
        {cards.map((plan) => {
          const current = plan.id === currentPlan;
          const tone = getPlanButtonTone(plan, currentPlan, currentCycle);
          const label = getPlanButtonLabel(plan, currentPlan, currentCycle);
          const disabled = isButtonDisabled(plan, currentPlan, currentCycle);
          const showRecommended = shouldShowRecommendedBadge(plan, currentPlan, currentCycle);

          return (
            <article
              className={`relative overflow-hidden rounded-[24px] border bg-white p-6 shadow-[0_10px_30px_-24px_rgba(15,23,42,0.28)] transition ${
                showRecommended
                  ? "border-brand-400 shadow-[0_18px_40px_-28px_rgba(16,185,129,0.45)]"
                  : "border-zinc-200"
              }`}
              key={plan.id}
            >
              {showRecommended ? (
                <span className="absolute left-5 top-0 -translate-y-1/2 rounded-full bg-brand-500 px-3 py-1 text-[11px] font-semibold text-white">
                  推荐
                </span>
              ) : null}

              <div className="flex items-center justify-between gap-3">
                <div>
                  <h3 className="font-display text-[20px] font-semibold text-zinc-950">{plan.name}</h3>
                  <p className="mt-2 text-sm text-zinc-500">{plan.subtitle}</p>
                </div>
                {current ? (
                  <span className="rounded-full border border-zinc-200 bg-zinc-50 px-3 py-1 text-[11px] font-semibold text-zinc-600">
                    当前方案
                  </span>
                ) : null}
              </div>

              <div className="mt-5 flex items-end gap-1">
                <span className="font-display text-[34px] font-bold leading-none text-zinc-950">{plan.price}</span>
                {plan.unit ? <span className="pb-1 text-sm text-zinc-500">{plan.unit}</span> : null}
              </div>

              <div className="mt-4 inline-flex rounded-xl bg-brand-50 px-3 py-2 text-sm font-semibold text-brand-700">
                {plan.quota}
              </div>

              <ul className="mt-5 space-y-3 text-sm text-zinc-600">
                {plan.features.map((feature) => (
                  <li className="flex items-start gap-2" key={feature}>
                    <span className="mt-0.5 text-brand-500">✓</span>
                    <span>{feature}</span>
                  </li>
                ))}
              </ul>

              {plan.scarcity ? (
                <div className="mt-5">
                  <div className="mb-2 flex items-center justify-between text-[11px] text-zinc-500">
                    <span>{plan.scarcity.joined}</span>
                    <span>{plan.scarcity.limit}</span>
                  </div>
                  <div className="h-1.5 overflow-hidden rounded-full bg-zinc-100">
                    <div
                      className="h-full rounded-full bg-brand-500"
                      style={{ width: plan.scarcity.progress }}
                    />
                  </div>
                </div>
              ) : null}

              <button
                className={`mt-6 min-h-[48px] w-full rounded-full px-4 text-sm font-semibold transition ${
                  tone === "current"
                    ? "border border-zinc-200 bg-white text-zinc-500"
                    : tone === "primary"
                      ? "bg-brand-500 text-white shadow-[0_12px_24px_-16px_rgba(16,185,129,0.8)]"
                      : "bg-zinc-100 text-zinc-900"
                }`}
                disabled={disabled}
                type="button"
              >
                {label}
              </button>
            </article>
          );
        })}
      </div>
    </div>
  );
}
