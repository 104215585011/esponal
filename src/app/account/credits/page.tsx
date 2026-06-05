// Timestamp: 2026-06-05 14:50
import Link from "next/link";
import { getServerSession } from "next-auth";
import { redirect } from "next/navigation";
import CreditHistoryClient from "@/app/account/credits/CreditHistoryClient";
import { SiteHeader } from "@/app/components/web/SiteHeader";
import { getAuthOptions } from "@/lib/auth";
import { PLAN_CONFIG, toDisplay, type Plan } from "@/lib/credits/config";
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
        <section className="mx-auto max-w-[960px]">
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
