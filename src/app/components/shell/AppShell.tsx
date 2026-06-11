// Timestamp: 2026-06-11 11:05
"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useRef, useState, type ReactNode } from "react";
import { Plus, Search } from "lucide-react";
import { ImportSheet } from "@/app/components/web/ImportSheet";
import { getParentTabForPath, shellTabRoutes } from "./routes";

type AppShellProps = {
  title: string;
  children: ReactNode;
};

function scrollKey(pathname: string) {
  return `esponal.mobile-shell.scroll:${pathname}`;
}

export function AppShell({ title, children }: AppShellProps) {
  const pathname = usePathname();
  const scrollRef = useRef<HTMLDivElement>(null);
  const [sheetMode, setSheetMode] = useState<"url" | "file" | null>(null);
  const activeTab = getParentTabForPath(pathname);

  useEffect(() => {
    const container = scrollRef.current;
    if (!container) return;
    const saved = Number(sessionStorage.getItem(scrollKey(pathname)) ?? 0);
    const frame = requestAnimationFrame(() => {
      container.scrollTop = Number.isFinite(saved) ? saved : 0;
    });

    return () => {
      cancelAnimationFrame(frame);
      sessionStorage.setItem(scrollKey(pathname), String(container.scrollTop));
    };
  }, [pathname]);

  return (
    <>
      <section className="md:hidden" data-testid="mobile-app-shell">
        <div className="fixed inset-x-0 top-0 z-50 border-b border-zinc-200/70 bg-white/90 px-4 backdrop-blur-[16px]">
          <div className="flex h-[52px] items-center justify-between gap-2">
            <h1 className="min-w-0 flex-1 truncate text-[17px] font-extrabold tracking-tight text-zinc-950">
              {title}
            </h1>
            <Link
              aria-label="搜索"
              className="flex h-11 w-11 shrink-0 items-center justify-center rounded-full text-zinc-600 active:bg-zinc-100"
              href="/search"
            >
              <Search className="h-[18px] w-[18px]" aria-hidden />
            </Link>
            <button
              aria-label="导入"
              className="flex h-11 w-11 shrink-0 items-center justify-center rounded-full bg-brand-500 text-white shadow-[0_10px_24px_-12px_rgba(16,185,129,0.8)] active:scale-95"
              onClick={() => setSheetMode("file")}
              type="button"
            >
              <Plus className="h-5 w-5" aria-hidden />
            </button>
          </div>
        </div>

        <div
          className="h-[100dvh] overflow-y-auto bg-app pb-[calc(74px+env(safe-area-inset-bottom))] pt-[52px]"
          ref={scrollRef}
        >
          <div className="transition-opacity duration-[150ms]">{children}</div>
        </div>

        <nav
          aria-label="主导航"
          className="fixed inset-x-0 bottom-0 z-50 border-t border-zinc-200/70 bg-white/92 px-2 pb-[calc(8px+env(safe-area-inset-bottom))] pt-2 backdrop-blur-[18px]"
          data-testid="mobile-shell-tabbar"
        >
          <ul className="grid grid-cols-5">
            {shellTabRoutes.map(({ path, label, Icon }) => {
              const active = activeTab === path;
              const TabIcon = Icon;

              return (
                <li key={path}>
                  <Link
                    aria-current={active ? "page" : undefined}
                    className={`flex min-h-[50px] flex-col items-center justify-center gap-1 rounded-2xl text-[10.5px] font-semibold transition active:scale-95 ${
                      active ? "text-brand-700" : "text-zinc-500"
                    }`}
                    href={path}
                  >
                    {TabIcon ? <TabIcon className="h-[21px] w-[21px]" strokeWidth={active ? 2.4 : 1.9} aria-hidden /> : null}
                    <span>{label}</span>
                  </Link>
                </li>
              );
            })}
          </ul>
        </nav>

        <ImportSheet mode={sheetMode} onClose={() => setSheetMode(null)} />
      </section>

      <section className="hidden md:block">{children}</section>
    </>
  );
}
