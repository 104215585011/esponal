"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

type SiteNavProps = {
  vocabHref: string;
};

type SiteNavItem = {
  label: string;
  href: string;
  activeHref?: string;
};

const navItems: SiteNavItem[] = [
  { label: "视频", href: "/" },
  { label: "课程", href: "/learn" },
  { label: "语法", href: "/grammar" }
];

function isActivePath(pathname: string, href: string) {
  if (href === "/") {
    return pathname === "/" || pathname === "/search" || pathname === "/watch";
  }

  return pathname === href || pathname.startsWith(`${href}/`);
}

export function SiteNav({ vocabHref }: SiteNavProps) {
  const pathname = usePathname();
  const allItems: SiteNavItem[] = [
    ...navItems,
    { label: "词库", href: vocabHref, activeHref: "/vocab" }
  ];

  return (
    <nav className="hidden items-center gap-1 lg:flex">
      {allItems.map((item) => {
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
  );
}
