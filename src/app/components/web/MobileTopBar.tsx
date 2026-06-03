// Timestamp: 2026-06-03 01:11
"use client";

import { GlobalSearchOverlay } from "@/app/components/web/GlobalSearchOverlay";
import { MobileNav } from "@/app/components/web/MobileNav";

type MobileTopBarProps = {
  searchAction?: string;
  initialQuery?: string;
  session?: any;
};

export function MobileTopBar({
  searchAction = "/search",
  initialQuery = "",
  session
}: MobileTopBarProps) {
  return (
    <>
      <div className="md:hidden fixed inset-x-0 top-0 z-50 border-b border-zinc-200/50 bg-white/70 px-4 backdrop-blur-xl dark:border-zinc-800/50 dark:bg-zinc-950/70">
        <div className="flex h-[52px] items-center justify-between">
          <MobileNav drawerSide="left" session={session} trigger="avatar" vocabHref="/vocab" />

          <button
            aria-disabled="true"
            aria-label="管理 YouTube 订阅"
            className="inline-flex h-11 min-w-[44px] items-center justify-center gap-1.5 rounded-full px-3 text-xs font-semibold text-zinc-500 transition active:scale-95 dark:text-zinc-400"
            title="YouTube 订阅管理稍后开放"
            type="button"
          >
            <svg aria-hidden="true" className="h-[18px] w-[18px] fill-none stroke-current stroke-2" viewBox="0 0 24 24">
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
