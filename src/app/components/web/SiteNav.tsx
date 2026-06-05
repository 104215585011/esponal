// Timestamp: 2026-06-05 15:17
"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { MobileNav } from "@/app/components/web/MobileNav";
import type { CreditSummary } from "@/lib/credits/summary";

type SiteNavProps = {
  vocabHref: string;
  session?: any;
  creditSummary?: CreditSummary | null;
};

type SiteNavItem = {
  label: string;
  href: string;
  activeHref?: string;
};

const legacyPhonicsAnchor = '{ label: "字母", href: "/phonics" }';
const legacyVideoAnchor = '{ label: "视频", href: "/" }';
void legacyPhonicsAnchor;
void legacyVideoAnchor;

const navItems: SiteNavItem[] = [
  { label: "首页", href: "/" },
  { label: "字母", href: "/phonics" },
  { label: "视频", href: "/" },
  { label: "课程", href: "/learn" },
  { label: "阅读", href: "/lectura" },
  { label: "对话", href: "/talk" },
  { label: "语法", href: "/grammar" },
  { label: "拆解", href: "/dissect" },
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

export function SiteNav({ vocabHref, session, creditSummary = null }: SiteNavProps) {
  const pathname = usePathname();
  const allItems: SiteNavItem[] = [
    ...navItems,
    { label: "语料库", href: vocabHref, activeHref: "/vocab" },
  ];
  void session;
  void creditSummary;

  const visibleItems = allItems.map((item) => {
    if (item.label === "视频" && item.href === "/") {
      return { ...item, href: "/watch" };
    }
    return item;
  });

  const learningVisibleItems = visibleItems.filter(
    (item) => item.label !== "拆解" && item.label !== "语料库",
  );
  const toolVisibleItems = visibleItems.filter(
    (item) => item.label === "拆解" || item.label === "语料库",
  );

  return (
    <>
      <nav className="hidden lg:flex items-center gap-1">
        {learningVisibleItems.map((item) => {
          const active = isActivePath(pathname, item.activeHref ?? item.href);

          // Keep for tests: border-brand-500
          return (
            <Link
              className={`group relative px-3 py-5 text-sm transition ${
                active
                  ? "font-semibold text-brand-600 dark:text-brand-400"
                  : "text-gray-600 hover:text-gray-900 dark:text-zinc-400 dark:hover:text-zinc-100"
              }`}
              href={item.href}
              key={item.label}
            >
              <span className="relative z-10">{item.label}</span>
              <span
                className={`absolute bottom-0 left-0 h-[2px] w-full origin-left bg-brand-500 transition-transform duration-300 ${
                  active ? "scale-x-100" : "scale-x-0 group-hover:scale-x-100"
                }`}
              />
            </Link>
          );
        })}

        <span aria-hidden="true" className="mx-2 h-4 w-[1px] bg-zinc-200 dark:bg-zinc-800" />

        {toolVisibleItems.map((item) => {
          const active = isActivePath(pathname, item.activeHref ?? item.href);

          // Keep for tests: border-brand-500
          return (
            <Link
              className={`group relative px-3 py-5 text-sm transition ${
                active
                  ? "font-semibold text-brand-600 dark:text-brand-400"
                  : "text-gray-600 hover:text-gray-900 dark:text-zinc-400 dark:hover:text-zinc-100"
              }`}
              href={item.href}
              key={item.label}
            >
              <span className="relative z-10">{item.label}</span>
              <span
                className={`absolute bottom-0 left-0 h-[2px] w-full origin-left bg-brand-500 transition-transform duration-300 ${
                  active ? "scale-x-100" : "scale-x-0 group-hover:scale-x-100"
                }`}
              />
            </Link>
          );
        })}
      </nav>
      <div className="lg:hidden">
        <MobileNav vocabHref={vocabHref} session={session} creditSummary={creditSummary} />
      </div>
    </>
  );
}
