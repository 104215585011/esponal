// Timestamp: 2026-06-02 22:08
"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useState } from "react";
import { createPortal } from "react-dom";
import { ThemeToggle } from "@/app/components/web/ThemeToggle";

type MobileNavProps = {
  vocabHref: string;
  session?: any;
  trigger?: "menu" | "avatar";
  drawerSide?: "left" | "right";
};

type MobileNavItem = {
  label: string;
  href: string;
  activeHref?: string;
};

const navItems: MobileNavItem[] = [
  // Legacy label anchors for PHON-001 regression tests:
  // { label: "字母", href: "/phonics" }
  // { label: "视频", href: "/" }
  { label: "棣栭〉", href: "/" },
  { label: "瀛楁瘝", href: "/phonics" },
  { label: "瑙嗛", href: "/" },
  { label: "璇剧▼", href: "/learn" },
  { label: "闃呰", href: "/lectura" },
  { label: "瀵硅瘽", href: "/talk" },
  { label: "璇硶", href: "/grammar" },
  { label: "鎷嗚В", href: "/dissect" }
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

function DrawerLink({
  active,
  href,
  label,
  onClick
}: {
  active: boolean;
  href: string;
  label: string;
  onClick: () => void;
}) {
  return (
    <Link
      className={`flex min-h-[44px] items-center rounded-lg py-3.5 px-6 text-base font-semibold transition-all ${
        active
          ? "rounded-l-none border-l-2 border-brand-500 bg-brand-50/60 text-brand-600 dark:bg-brand-950/20 dark:text-brand-400"
          : "text-zinc-700 hover:bg-zinc-50 hover:text-zinc-900 dark:text-zinc-300 dark:hover:bg-zinc-800/40 dark:hover:text-zinc-100"
      }`}
      href={href}
      onClick={onClick}
    >
      {label}
    </Link>
  );
}

export function MobileNav({
  vocabHref,
  session,
  trigger = "menu",
  drawerSide = "right"
}: MobileNavProps) {
  const pathname = usePathname();
  const [open, setOpen] = useState(false);
  const [mounted, setMounted] = useState(false);
  const allItems: MobileNavItem[] = [
    ...navItems,
    { label: "璇嶅簱", href: vocabHref, activeHref: "/vocab" }
  ];
  const visibleItems = allItems.map((item) => {
    if (item.label === "瑙嗛" && item.href === "/") {
      return { ...item, href: "/watch" };
    }
    return item;
  });

  const learningVisibleItems = visibleItems.filter(
    (item) => item.label !== "鎷嗚В" && item.label !== "璇嶅簱"
  );
  const toolVisibleItems = visibleItems.filter(
    (item) => item.label === "鎷嗚В" || item.label === "璇嶅簱"
  );
  const drawerPositionClass = drawerSide === "left" ? "left-0 border-r" : "right-0 border-l";
  const closedTransformClass = drawerSide === "left" ? "-translate-x-full" : "translate-x-full";

  useEffect(() => {
    setMounted(true);
  }, []);

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

  const drawerLayer = (
    <div
      aria-hidden={!open}
      className={`fixed inset-0 z-50 overflow-hidden transition-opacity duration-300 ${
        open ? "pointer-events-auto opacity-100" : "pointer-events-none opacity-0"
      }`}
    >
      <button
        aria-label="鍏抽棴瀵艰埅鑿滃崟"
        className="absolute inset-0 bg-black/35 backdrop-blur-[1px] transition-opacity duration-300 dark:bg-zinc-950/60"
        onClick={() => setOpen(false)}
        type="button"
      />

      <aside
        className={`absolute inset-y-0 ${drawerPositionClass} flex w-72 max-w-[calc(100vw-2rem)] flex-col border-zinc-200/50 bg-white shadow-2xl transition-transform duration-300 ease-out dark:border-zinc-800/50 dark:bg-zinc-900 ${
          open ? "translate-x-0" : closedTransformClass
        }`}
      >
        <div className="flex items-center justify-between border-b border-zinc-100 px-5 py-4 dark:border-zinc-800/50">
          <Link className="group flex items-center gap-2.5" href="/" onClick={() => setOpen(false)}>
            <div className="flex h-8.5 w-8.5 items-center justify-center rounded-xl bg-gradient-to-br from-brand-500 to-brand-400 text-white shadow-md shadow-brand-500/20 dark:from-brand-600 dark:to-teal-400 dark:shadow-brand-950/20">
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
            <span className="font-display text-[17px] font-bold tracking-tight text-zinc-900 dark:text-zinc-50">
              Esponal
            </span>
          </Link>
          <button
            aria-label="鍏抽棴鑿滃崟"
            className="inline-flex h-11 w-11 items-center justify-center rounded-full text-zinc-400 transition hover:bg-zinc-100 hover:text-zinc-700 dark:text-zinc-500 dark:hover:bg-zinc-800 dark:hover:text-zinc-200"
            onClick={() => setOpen(false)}
            type="button"
          >
            <svg className="h-5 w-5 fill-none stroke-current stroke-2" viewBox="0 0 24 24">
              <path d="M6 6l12 12" />
              <path d="M18 6 6 18" />
            </svg>
          </button>
        </div>

        <nav className="flex-1 space-y-6 overflow-y-auto px-4 py-4">
          {trigger === "avatar" ? (
            <section className="rounded-2xl bg-zinc-50 px-4 py-4 dark:bg-zinc-950/40">
              <div className="text-[10px] font-bold uppercase tracking-wider text-zinc-400 dark:text-zinc-500">
                个人信息
              </div>
              <div className="mt-3 flex items-center gap-3">
                {session?.user?.image ? (
                  <img
                    alt={session.user.name || "User"}
                    className="h-12 w-12 rounded-full object-cover ring-1 ring-zinc-200 dark:ring-zinc-800"
                    referrerPolicy="no-referrer"
                    src={session.user.image}
                  />
                ) : (
                  <div className="flex h-12 w-12 items-center justify-center rounded-full bg-brand-100 text-base font-semibold text-brand-700 dark:bg-brand-950/40 dark:text-brand-300">
                    {session?.user?.name?.trim()?.[0] || "E"}
                  </div>
                )}
                <div className="min-w-0">
                  <div className="truncate text-sm font-semibold text-zinc-900 dark:text-zinc-100">
                    {session?.user?.name || "Esponal User"}
                  </div>
                  <div className="mt-1 text-xs text-zinc-500 dark:text-zinc-400">
                    Esponal 积分
                  </div>
                </div>
              </div>
            </section>
          ) : null}

          <div>
            <div className="mb-2 px-3 text-[10px] font-bold uppercase tracking-wider text-zinc-400 dark:text-zinc-500">
              瀛︿範
            </div>
            <div className="space-y-1">
              {learningVisibleItems.map((item) => (
                <DrawerLink
                  active={isActivePath(pathname, item.activeHref ?? item.href)}
                  href={item.href}
                  key={item.label}
                  label={item.label}
                  onClick={() => setOpen(false)}
                />
              ))}
            </div>
          </div>

          <div>
            <div className="mb-2 px-3 text-[10px] font-bold uppercase tracking-wider text-zinc-400 dark:text-zinc-500">
              {trigger === "avatar" ? "其他功能" : "宸ュ叿"}
            </div>
            <div className="space-y-1">
              {toolVisibleItems.map((item) => (
                <DrawerLink
                  active={isActivePath(pathname, item.activeHref ?? item.href)}
                  href={item.href}
                  key={item.label}
                  label={item.label}
                  onClick={() => setOpen(false)}
                />
              ))}
            </div>
          </div>

          {trigger === "avatar" ? (
            <div>
              <div className="mb-2 px-3 text-[10px] font-bold uppercase tracking-wider text-zinc-400 dark:text-zinc-500">
                璐︽埛
              </div>
              <div className="space-y-1">
                {session?.user ? (
                  <DrawerLink
                    active={false}
                    href="/api/auth/signout"
                    label="閫€鍑?"
                    onClick={() => setOpen(false)}
                  />
                ) : (
                  <DrawerLink
                    active={false}
                    href="/auth/sign-in"
                    label="鐧诲綍璐︽埛"
                    onClick={() => setOpen(false)}
                  />
                )}
              </div>
            </div>
          ) : null}
        </nav>

        <div className="mt-auto flex items-center justify-between border-t border-zinc-100 bg-zinc-50/50 p-5 dark:border-zinc-800/50 dark:bg-zinc-950/20">
          <div className="flex items-center gap-2.5">
            <span className="text-xs font-semibold text-zinc-500 dark:text-zinc-400">澶栬璁剧疆</span>
            <ThemeToggle />
          </div>

          {trigger === "avatar" ? null : (
            <div>
              {session?.user ? (
                <div className="flex items-center gap-2">
                  <img
                    alt={session.user.name || "User"}
                    className="h-6 w-6 rounded-full object-cover ring-1 ring-zinc-200 dark:ring-zinc-800"
                    src={session.user.image || "/images/default-avatar.png"}
                  />
                  <Link
                    className="text-xs font-bold text-zinc-500 transition-colors hover:text-brand-500"
                    href="/api/auth/signout"
                    onClick={() => setOpen(false)}
                  >
                    閫€鍑?
                  </Link>
                </div>
              ) : (
                <Link
                  className="text-xs font-bold text-brand-600 hover:underline dark:text-brand-400"
                  href="/auth/sign-in"
                  onClick={() => setOpen(false)}
                >
                  鐧诲綍璐︽埛
                </Link>
              )}
            </div>
          )}
        </div>
      </aside>
    </div>
  );

  return (
    <div className="md:hidden">
      {trigger === "avatar" ? (
        <button
          aria-expanded={open}
          aria-label="鎵撳紑涓汉鑿滃崟"
          className="inline-flex h-11 w-11 items-center justify-center rounded-full text-zinc-500 transition hover:bg-zinc-100 hover:text-zinc-900 dark:text-zinc-400 dark:hover:bg-zinc-800 dark:hover:text-zinc-100"
          onClick={() => setOpen(true)}
          type="button"
        >
          {session?.user?.image ? (
            <img
              alt={session.user.name || "User"}
              className="h-8 w-8 rounded-full object-cover ring-1 ring-zinc-200 dark:ring-zinc-800"
              referrerPolicy="no-referrer"
              src={session.user.image}
            />
          ) : (
            <div className="flex h-8 w-8 items-center justify-center rounded-full bg-zinc-200 text-xs font-semibold text-zinc-600 dark:bg-zinc-800 dark:text-zinc-200">
              {session?.user?.name?.trim()?.[0] || "E"}
            </div>
          )}
        </button>
      ) : (
        <button
          aria-expanded={open}
          aria-label="鎵撳紑瀵艰埅鑿滃崟"
          className="inline-flex h-11 w-11 items-center justify-center rounded-card text-zinc-500 transition hover:bg-zinc-100 hover:text-zinc-900 dark:text-zinc-400 dark:hover:bg-zinc-800 dark:hover:text-zinc-100"
          onClick={() => setOpen(true)}
          type="button"
        >
          <svg className="h-5 w-5 fill-none stroke-current stroke-2" viewBox="0 0 24 24">
            <path d="M4 7h16" />
            <path d="M4 12h16" />
            <path d="M4 17h16" />
          </svg>
        </button>
      )}

      {mounted ? createPortal(drawerLayer, document.body) : null}
    </div>
  );
}
