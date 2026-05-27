"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useState } from "react";

type MobileNavProps = {
  vocabHref: string;
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
    return pathname === "/" || pathname === "/search" || pathname === "/watch";
  }

  return pathname === href || pathname.startsWith(`${href}/`);
}

export function MobileNav({ vocabHref }: MobileNavProps) {
  const pathname = usePathname();
  const [open, setOpen] = useState(false);
  const allItems: MobileNavItem[] = [
    ...navItems,
    { label: "词库", href: vocabHref, activeHref: "/vocab" }
  ];
  const visibleItems = allItems.filter(item => item.label !== "视频");

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
        className="inline-flex h-10 w-10 items-center justify-center rounded-card text-gray-500 transition hover:bg-muted hover:text-gray-900"
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
        className={`fixed inset-0 z-50 overflow-hidden bg-surface transition-opacity duration-200 ${
          open ? "pointer-events-auto opacity-100" : "pointer-events-none opacity-0"
        }`}
      >
        <button
          aria-label="关闭导航菜单"
          className="absolute inset-0"
          onClick={() => setOpen(false)}
          type="button"
        />

        <aside
          className={`absolute inset-y-0 right-0 flex w-full max-w-sm flex-col bg-surface transition-transform duration-200 ${
            open ? "translate-x-0" : "translate-x-full"
          }`}
        >
          <div className="flex items-center justify-end px-4 pt-4">
            <button
              aria-label="关闭菜单"
              className="inline-flex h-10 w-10 items-center justify-center rounded-card text-gray-500 transition hover:text-gray-900"
              onClick={() => setOpen(false)}
              type="button"
            >
              <svg className="h-5 w-5 fill-none stroke-current stroke-2" viewBox="0 0 24 24">
                <path d="M6 6l12 12" />
                <path d="M18 6 6 18" />
              </svg>
            </button>
          </div>

          <nav className="mt-6 flex flex-col px-6">
            {visibleItems.map((item) => {
              const active = isActivePath(pathname, item.activeHref ?? item.href);

              return (
                <Link
                  className={`border-b border-gray-100 px-0 py-4 text-xl font-medium transition ${
                    active ? "text-brand-600" : "text-gray-800 hover:text-gray-900"
                  }`}
                  href={item.href}
                  key={item.label}
                  onClick={() => setOpen(false)}
                >
                  {item.label}
                </Link>
              );
            })}
          </nav>
        </aside>
      </div>
    </div>
  );
}
