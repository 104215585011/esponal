"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { MobileNav } from "@/app/components/web/MobileNav";

type SiteNavProps = {
  vocabHref: string;
};

type SiteNavItem = {
  label: string;
  href: string;
  activeHref?: string;
};

const navItems: SiteNavItem[] = [
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

export function SiteNav({ vocabHref }: SiteNavProps) {
  const pathname = usePathname();
  const allItems: SiteNavItem[] = [
    ...navItems,
    { label: "词库", href: vocabHref, activeHref: "/vocab" }
  ];

  const visibleItems = allItems.map((item) => {
    if (item.label === "视频" && item.href === "/") {
      return { ...item, href: "/watch" };
    }
    return item;
  });

  return (
    <>
      <nav className="hidden lg:flex items-center gap-1">
        {visibleItems.map((item) => {
          const active = isActivePath(pathname, item.activeHref ?? item.href);

          return (
            <Link
              className={`border-b-2 px-3 py-5 text-sm transition ${
                active
                  ? "border-brand-500 font-semibold text-brand-600"
                  : "border-transparent text-gray-600 hover:text-gray-900"
              }`}
              href={item.href}
              key={item.label}
            >
              {item.label}
            </Link>
          );
        })}
      </nav>
      <div className="lg:hidden">
        <MobileNav vocabHref={vocabHref} />
      </div>
    </>
  );
}
