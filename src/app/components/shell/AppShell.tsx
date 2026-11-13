// Timestamp: 2026-11-13 13:50
"use client";

import Link from "next/link";
import { usePathname, useSearchParams } from "next/navigation";
import { useEffect, useState } from "react";
import { ArrowLeft, Plus, Search } from "lucide-react";
import { ImportSheet } from "@/app/components/web/ImportSheet";
import { getShellRouteForPath, isImmersivePath, isShellHiddenPath, shellTabRoutes } from "./routes";
import { useIsMobile } from "./useIsMobile";
import { useShellBack } from "./useShellBack";

const SCROLL_KEY_PREFIX = "esponal.shell.scroll:";

/**
 * 移动端持久壳:顶栏 + 底栏。
 *
 * 硬约束:
 * 1. 只允许在根 layout 挂载一次。任何页面再包一层 = 回到"每页一套 chrome"的老问题。
 * 2. 桌面端不渲染任何壳 DOM(靠 useIsMobile 判断,不是 CSS 藏起来)。
 * 3. 内容让位(safe area / 顶栏高度 / 底栏高度)由 body[data-shell] 在 globals.css 里统一给,
 *    壳本身不包 children —— 避免 children 被 Suspense 包住导致整页消失。
 */
export function AppShell() {
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const isMobile = useIsMobile();
  const [sheetMode, setSheetMode] = useState<"url" | "file" | null>(null);
  const [fanOpen, setFanOpen] = useState(false);

  const route = getShellRouteForPath(pathname);
  const immersive = isImmersivePath(pathname, searchParams.get("v"));
  const shellActive = isMobile && !isShellHiddenPath(pathname);
  const chromeVisible = shellActive && !immersive;
  const isTab = route?.level === "tab";
  const isRootLanding = pathname === "/";
  const title = isRootLanding ? "" : route?.label ?? "Esponal";

  const goBack = useShellBack({
    closeSheet: () => setSheetMode(null),
    sheetOpen: Boolean(sheetMode)
  });

  // 路由变化时收起导入浮层,避免跨页残留
  useEffect(() => {
    setFanOpen(false);
  }, [pathname]);

  // 把壳的状态写到 body 上,让 CSS 统一处理内容让位(顶栏 52px / 底栏高度 + safe area)
  useEffect(() => {
    if (!shellActive) {
      delete document.body.dataset.shell;
      return;
    }
    document.body.dataset.shell = chromeVisible ? (isTab ? "tab" : "push") : "immersive";
    return () => {
      delete document.body.dataset.shell;
    };
  }, [chromeVisible, isTab, shellActive]);

  // 滚动位置记忆:每个路径一份,切走再回来不丢
  useEffect(() => {
    if (!chromeVisible) return;
    const key = `${SCROLL_KEY_PREFIX}${pathname}`;
    const frame = requestAnimationFrame(() => {
      const saved = Number(sessionStorage.getItem(key) ?? "0");
      if (Number.isFinite(saved) && saved > 0) {
        window.scrollTo({ top: saved, behavior: "auto" });
      }
    });

    return () => {
      cancelAnimationFrame(frame);
      sessionStorage.setItem(key, String(window.scrollY));
    };
  }, [chromeVisible, pathname]);

  return (
    <>
      {chromeVisible ? (
        <header
          className="fixed inset-x-0 top-0 z-50 border-b border-zinc-200/70 bg-white/88 backdrop-blur-[16px] transition-opacity duration-[150ms] dark:border-zinc-800/70 dark:bg-zinc-950/85 md:hidden"
          data-testid="mobile-app-shell"
        >
          <div className="flex h-[52px] items-center gap-1 px-3">
            {isRootLanding ? (
              <span className="px-2 font-display text-[19px] font-extrabold tracking-[-0.03em] text-zinc-950 dark:text-zinc-50">
                Esponal<span className="text-brand-500">.</span>
              </span>
            ) : (
              <>
                {isTab ? null : (
                  <button
                    aria-label="返回"
                    className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full text-zinc-700 transition active:bg-zinc-100 dark:text-zinc-200 dark:active:bg-zinc-800"
                    onClick={goBack}
                    type="button"
                  >
                    <ArrowLeft className="h-[19px] w-[19px]" aria-hidden />
                  </button>
                )}
                <h1 className="min-w-0 flex-1 truncate text-[17px] font-extrabold tracking-tight text-zinc-950 dark:text-zinc-50">
                  {title}
                </h1>
              </>
            )}

            <div className="ml-auto flex shrink-0 items-center gap-1">
              <Link
                aria-label="搜索"
                className="flex h-10 w-10 items-center justify-center rounded-full text-zinc-600 transition active:bg-zinc-100 dark:text-zinc-300 dark:active:bg-zinc-800"
                href="/search"
              >
                <Search className="h-[19px] w-[19px]" aria-hidden />
              </Link>
              <button
                aria-expanded={fanOpen}
                aria-label="导入"
                className="flex h-9 w-9 items-center justify-center rounded-full bg-brand-500 text-white shadow-[0_8px_18px_-8px_rgba(16,185,129,0.75)] transition active:scale-95"
                data-testid="mobile-import-trigger"
                onClick={() => setFanOpen((open) => !open)}
                type="button"
              >
                <Plus className={`h-[18px] w-[18px] transition-transform ${fanOpen ? "rotate-45" : ""}`} aria-hidden />
              </button>
            </div>
          </div>

          {fanOpen ? (
            <div className="absolute right-3 top-[50px] z-50 w-[calc(100vw-24px)] max-w-[260px] rounded-[20px] border border-zinc-200/70 bg-white p-2 shadow-[0_20px_60px_-16px_rgba(0,0,0,0.15)] dark:border-zinc-800 dark:bg-zinc-900">
              <div className="grid grid-cols-2 gap-2">
                <button
                  className="flex flex-col items-center gap-1.5 rounded-[16px] bg-zinc-50 px-2 py-3 transition active:scale-[0.97] dark:bg-zinc-800"
                  onClick={() => {
                    setFanOpen(false);
                    setSheetMode("url");
                  }}
                  type="button"
                >
                  <span className="text-[13px] font-semibold text-zinc-900 dark:text-zinc-50">视频链接</span>
                  <span className="text-[10.5px] text-zinc-500">贴 YouTube 地址</span>
                </button>
                <button
                  className="flex flex-col items-center gap-1.5 rounded-[16px] bg-brand-50 px-2 py-3 transition active:scale-[0.97]"
                  onClick={() => {
                    setFanOpen(false);
                    setSheetMode("file");
                  }}
                  type="button"
                >
                  <span className="text-[13px] font-semibold text-brand-700">EPUB/PDF</span>
                  <span className="text-[10.5px] text-brand-600/80">上传电子书</span>
                </button>
              </div>
            </div>
          ) : null}
        </header>
      ) : null}

      {chromeVisible && isTab ? (
        <nav
          aria-label="主导航"
          className="fixed inset-x-0 bottom-0 z-50 border-t border-zinc-200/70 bg-white/92 pb-[calc(8px+env(safe-area-inset-bottom))] pt-2 backdrop-blur-[18px] dark:border-zinc-800/70 dark:bg-zinc-950/92 md:hidden"
          data-testid="mobile-shell-tabbar"
        >
          <ul className="grid grid-cols-5">
            {shellTabRoutes.map(({ path, label, Icon }) => {
              const active = route?.parentTab === path;
              const TabIcon = Icon;

              return (
                <li key={path}>
                  <Link
                    aria-current={active ? "page" : undefined}
                    className={`flex min-h-[50px] flex-col items-center justify-center gap-1 rounded-2xl text-[10.5px] font-semibold transition active:scale-95 ${
                      active ? "text-brand-700 dark:text-brand-400" : "text-zinc-500 dark:text-zinc-400"
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
      ) : null}

      {chromeVisible ? <ImportSheet mode={sheetMode} onClose={() => setSheetMode(null)} /> : null}
    </>
  );
}
