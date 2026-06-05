// Timestamp: 2026-06-05 14:46
"use client";

import { GlobalSearchOverlay } from "@/app/components/web/GlobalSearchOverlay";
import { MobileNav } from "@/app/components/web/MobileNav";
import type { CreditSummary } from "@/lib/credits/summary";

type MobileTopBarProps = {
  searchAction?: string;
  initialQuery?: string;
  session?: any;
  creditSummary?: CreditSummary | null;
};

export function MobileTopBar({
  searchAction = "/search",
  initialQuery = "",
  session,
  creditSummary = null,
}: MobileTopBarProps) {
  return (
    <>
      <div className="md:hidden fixed inset-x-0 top-0 z-50 border-b border-zinc-200/60 bg-white/78 px-5 backdrop-blur-[16px] dark:border-zinc-800/60 dark:bg-zinc-950/78">
        <div className="flex h-[52px] items-center justify-between">
          <MobileNav
            creditSummary={creditSummary}
            drawerSide="left"
            session={session}
            trigger="avatar"
            vocabHref="/vocab"
          />

          <button
            aria-disabled="true"
            aria-label="管理 YouTube 订阅"
            className="inline-flex h-11 min-w-[44px] items-center justify-center gap-1.5 rounded-full px-3 text-[13px] font-medium text-zinc-600 transition active:scale-95 dark:text-zinc-300"
            title="订阅管理稍后开放"
            type="button"
          >
            <svg
              aria-hidden="true"
              className="h-[18px] w-[18px] fill-none stroke-current stroke-2"
              viewBox="0 0 24 24"
            >
              <path d="M7 7h10" />
              <path d="M7 12h10" />
              <path d="M7 17h6" />
            </svg>
            <span>订阅</span>
          </button>

          <GlobalSearchOverlay searchAction={searchAction} initialQuery={initialQuery} />
        </div>
      </div>
      <div aria-hidden="true" className="h-[52px] md:hidden" />
    </>
  );
}
