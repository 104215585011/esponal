// Timestamp: 2026-06-05 11:05
import { getServerSession } from "next-auth";
import { MembershipTabs } from "@/app/membership/MembershipTabs";
import { SiteHeader } from "@/app/components/web/SiteHeader";
import { getAuthOptions } from "@/lib/auth";
import { getCreditSummary } from "@/lib/credits/summary";

type SessionUserWithId = {
  id?: string;
};

export const dynamic = "force-dynamic";

export default async function MembershipPage() {
  const session = await getServerSession(getAuthOptions());
  const userId = (session?.user as SessionUserWithId | undefined)?.id;
  const summary = userId
    ? await getCreditSummary(userId)
    : {
        plan: "free" as const,
        currentPlan: "free" as const,
        currentCycle: "free" as const,
        planLabel: "免费",
        balanceMinor: 0,
        balanceDisplay: 0,
      };

  return (
    <main className="min-h-screen bg-white md:bg-app">
      <SiteHeader />
      <div className="mx-auto w-full max-w-app-shell px-5 pb-[calc(5rem+env(safe-area-inset-bottom))] pt-6 md:px-6 md:py-10 lg:px-8">
        <section className="mx-auto max-w-[1100px] rounded-[32px] border border-zinc-200/70 bg-white px-5 py-7 shadow-[0_24px_80px_-48px_rgba(15,23,42,0.35)] md:px-8 md:py-10">
          <div className="mx-auto max-w-[640px] text-center">
            <div className="inline-flex rounded-full border border-brand-100 bg-brand-50 px-3 py-1 text-[11px] font-semibold uppercase tracking-[0.18em] text-brand-700">
              Membership
            </div>
            <h1 className="mt-4 font-display text-[32px] font-semibold tracking-tight text-zinc-950 md:text-[40px]">
              选择适合你的方案
            </h1>
            <p className="mt-3 text-sm leading-7 text-zinc-500 md:text-[15px]">
              解锁更多配额与功能，把对话、字幕、发音和短语提取放进同一套学习节奏里。
            </p>
          </div>

          <MembershipTabs
            balanceDisplay={summary.balanceDisplay}
            currentPlan={summary.currentPlan}
            currentPlanLabel={summary.planLabel}
            currentCycle={summary.currentCycle}
          />

          <p className="mx-auto mt-8 max-w-[720px] text-center text-xs leading-6 text-zinc-500">
            配额只用于 AI 加工：对话、字幕翻译、发音和短语提取。缓存视频、本地查词、复习与收藏不消耗配额。
          </p>
        </section>
      </div>
    </main>
  );
}
