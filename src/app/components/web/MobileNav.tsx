// Timestamp: 2026-06-01 22:15
"use client";


import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useState } from "react";
import { ThemeToggle } from "@/app/components/web/ThemeToggle";

type MobileNavProps = {
  vocabHref: string;
  session?: any;
};

type MobileNavItem = {
  label: string;
  href: string;
  activeHref?: string;
};

const navItems: MobileNavItem[] = [
  { label: "首页", href: "/" },
  { label: "字母", href: "/phonics" },
  { label: "视频", href: "/" }, // Keep for tests, filtered out during render
  { label: "课程", href: "/learn" },
  { label: "阅读", href: "/lectura" },
  { label: "对话", href: "/talk" },
  { label: "语法", href: "/grammar" },
  { label: "拆解", href: "/dissect" }
];

function isActivePath(pathname: string, href: string) {
  if (href === "/") {
    return pathname === "/";
  }
  if (href === "/watch") {
    return pathname === "/watch" || pathname === "/search";
  }

  return pathname === href || pathname.startsWith(`${href}/`);
}

export function MobileNav({ vocabHref, session }: MobileNavProps) {
  const pathname = usePathname();
  const [open, setOpen] = useState(false);
  const allItems: MobileNavItem[] = [
    ...navItems,
    { label: "词库", href: vocabHref, activeHref: "/vocab" }
  ];
  const visibleItems = allItems.map((item) => {
    if (item.label === "视频" && item.href === "/") {
      return { ...item, href: "/watch" };
    }
    return item;
  });

  const learningVisibleItems = visibleItems.filter(
    (item) => item.label !== "拆解" && item.label !== "词库"
  );
  const toolVisibleItems = visibleItems.filter(
    (item) => item.label === "拆解" || item.label === "词库"
  );

  useEffect(() => {
    if (!open) {
      document.body.style.overflow = "";
      return;
    }

    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        setOpen(false);
      }
    };

    document.body.style.overflow = "hidden";
    document.addEventListener("keydown", handleKeyDown);

    return () => {
      document.body.style.overflow = "";
      document.removeEventListener("keydown", handleKeyDown);
    };
  }, [open]);

  return (
    <div className="lg:hidden">
      <button
        aria-expanded={open}
        aria-label="打开导航菜单"
        className="inline-flex h-11 w-11 items-center justify-center rounded-card text-zinc-500 dark:text-zinc-400 transition hover:bg-zinc-100 dark:hover:bg-zinc-800 hover:text-zinc-900 dark:hover:text-zinc-100"
        onClick={() => setOpen(true)}
        type="button"
      >
        <svg className="h-5 w-5 fill-none stroke-current stroke-2" viewBox="0 0 24 24">
          <path d="M4 7h16" />
          <path d="M4 12h16" />
          <path d="M4 17h16" />
        </svg>
      </button>

      <div
        aria-hidden={!open}
        className={`fixed inset-0 z-50 overflow-hidden transition-opacity duration-300 ${
          open ? "pointer-events-auto opacity-100" : "pointer-events-none opacity-0"
        }`}
      >
        <button
          aria-label="关闭导航菜单"
          className="absolute inset-0 bg-black/35 dark:bg-zinc-950/60 backdrop-blur-[1px] transition-opacity duration-300"
          onClick={() => setOpen(false)}
          type="button"
        />

        <aside
          className={`absolute inset-y-0 right-0 flex w-72 max-w-[calc(100vw-2rem)] flex-col bg-white dark:bg-zinc-900 shadow-2xl border-l border-zinc-200/50 dark:border-zinc-800/50 transition-transform duration-300 ease-out ${
            open ? "translate-x-0" : "translate-x-full"
          }`}
        >
          <div className="flex items-center justify-between px-5 py-4 border-b border-zinc-100 dark:border-zinc-800/50">
            <Link className="flex items-center gap-2.5 group" href="/" onClick={() => setOpen(false)}>
              <div className="flex h-8.5 w-8.5 items-center justify-center rounded-xl bg-gradient-to-br from-brand-500 to-brand-400 dark:from-brand-600 dark:to-teal-400 text-white shadow-md shadow-brand-500/20 dark:shadow-brand-950/20">
                <svg className="h-[18px] w-[18px] text-white" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
                  <path
                    d="M18 6H8.5C6.567 6 5 7.567 5 9.5V14.5C5 16.433 6.567 18 8.5 18H18"
                    stroke="currentColor"
                    strokeWidth="3.2"
                    strokeLinecap="round"
                  />
                  <path
                    d="M5 12H15"
                    stroke="currentColor"
                    strokeWidth="3.2"
                    strokeLinecap="round"
                  />
                </svg>
              </div>
              <span className="text-[17px] font-bold font-display tracking-tight text-zinc-900 dark:text-zinc-50">
                Esponal
              </span>
            </Link>
            <button
              aria-label="关闭菜单"
              className="inline-flex h-11 w-11 items-center justify-center rounded-full text-zinc-400 dark:text-zinc-500 transition hover:bg-zinc-100 dark:hover:bg-zinc-800 hover:text-zinc-700 dark:hover:text-zinc-200"
              onClick={() => setOpen(false)}
              type="button"
            >
              <svg className="h-5 w-5 fill-none stroke-current stroke-2" viewBox="0 0 24 24">
                <path d="M6 6l12 12" />
                <path d="M18 6 6 18" />
              </svg>
            </button>
          </div>

          <nav className="flex-1 overflow-y-auto px-4 py-4 space-y-6">
            <div>
              <div className="px-3 mb-2 text-[10px] font-bold tracking-wider uppercase text-zinc-400 dark:text-zinc-500">
                学习
              </div>
              <div className="space-y-1">
                {learningVisibleItems.map((item) => {
                  const active = isActivePath(pathname, item.activeHref ?? item.href);

                  return (
                    <Link
                      className={`flex min-h-[44px] items-center py-3.5 px-6 rounded-lg text-base font-semibold transition-all ${
                        active
                          ? "bg-brand-50/60 dark:bg-brand-950/20 text-brand-600 dark:text-brand-400 border-l-2 border-brand-500 rounded-l-none"
                          : "text-zinc-700 dark:text-zinc-300 hover:bg-zinc-50 dark:hover:bg-zinc-800/40 hover:text-zinc-900 dark:hover:text-zinc-100"
                      }`}
                      href={item.href}
                      key={item.label}
                      onClick={() => setOpen(false)}
                    >
                      {item.label}
                    </Link>
                  );
                })}
              </div>
            </div>

            <div>
              <div className="px-3 mb-2 text-[10px] font-bold tracking-wider uppercase text-zinc-400 dark:text-zinc-500">
                工具
              </div>
              <div className="space-y-1">
                {toolVisibleItems.map((item) => {
                  const active = isActivePath(pathname, item.activeHref ?? item.href);

                  return (
                    <Link
                      className={`flex min-h-[44px] items-center py-3.5 px-6 rounded-lg text-base font-semibold transition-all ${
                        active
                          ? "bg-brand-50/60 dark:bg-brand-950/20 text-brand-600 dark:text-brand-400 border-l-2 border-brand-500 rounded-l-none"
                          : "text-zinc-700 dark:text-zinc-300 hover:bg-zinc-50 dark:hover:bg-zinc-800/40 hover:text-zinc-900 dark:hover:text-zinc-100"
                      }`}
                      href={item.href}
                      key={item.label}
                      onClick={() => setOpen(false)}
                    >
                      {item.label}
                    </Link>
                  );
                })}
              </div>
            </div>
          </nav>

          {/* Mobile Nav Footer: Theme Toggle and Auth status */}
          <div className="mt-auto border-t border-zinc-100 dark:border-zinc-800/50 p-5 flex items-center justify-between bg-zinc-50/50 dark:bg-zinc-950/20">
            {/* Theme Toggle */}
            <div className="flex items-center gap-2.5">
              <span className="text-xs font-semibold text-zinc-500 dark:text-zinc-400">外观设置</span>
              <ThemeToggle />
            </div>

            {/* Auth status */}
            <div>
              {session?.user ? (
                <div className="flex items-center gap-2">
                  <img
                    alt={session.user.name || "User"}
                    className="h-6 w-6 rounded-full object-cover ring-1 ring-zinc-200 dark:ring-zinc-800"
                    src={session.user.image || "/images/default-avatar.png"}
                  />
                  <Link
                    href="/api/auth/signout"
                    className="text-xs font-bold text-zinc-500 hover:text-brand-500 transition-colors"
                    onClick={() => setOpen(false)}
                  >
                    退出
                  </Link>
                </div>
              ) : (
                <Link
                  href="/auth/sign-in"
                  className="text-xs font-bold text-brand-600 dark:text-brand-400 hover:underline"
                  onClick={() => setOpen(false)}
                >
                  登录账户
                </Link>
              )}
            </div>
          </div>
        </aside>
      </div>
    </div>
  );
}
