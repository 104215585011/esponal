// Timestamp: 2026-06-03 01:33
"use client";

import Link from "next/link";
import { usePathname, useSearchParams } from "next/navigation";

type IconProps = {
  className?: string;
  strokeWidth?: number;
};

type BottomTab = {
  label: string;
  href: string;
  matchBase: string;
  Icon: (props: IconProps) => JSX.Element;
};

function PlayIcon({ className, strokeWidth = 2 }: IconProps) {
  return (
    <svg aria-hidden="true" className={className} fill="none" stroke="currentColor" strokeLinecap="round" strokeLinejoin="round" strokeWidth={strokeWidth} viewBox="0 0 24 24">
      <path d="M8 5v14l11-7z" />
    </svg>
  );
}

function BookOpenIcon({ className, strokeWidth = 2 }: IconProps) {
  return (
    <svg aria-hidden="true" className={className} fill="none" stroke="currentColor" strokeLinecap="round" strokeLinejoin="round" strokeWidth={strokeWidth} viewBox="0 0 24 24">
      <path d="M12 7v14" />
      <path d="M4 5.5A3.5 3.5 0 0 1 7.5 2H12v19H7.5A3.5 3.5 0 0 0 4 17.5z" />
      <path d="M20 5.5A3.5 3.5 0 0 0 16.5 2H12v19h4.5a3.5 3.5 0 0 1 3.5-3.5z" />
    </svg>
  );
}

function GraduationCapIcon({ className, strokeWidth = 2 }: IconProps) {
  return (
    <svg aria-hidden="true" className={className} fill="none" stroke="currentColor" strokeLinecap="round" strokeLinejoin="round" strokeWidth={strokeWidth} viewBox="0 0 24 24">
      <path d="M22 10 12 5 2 10l10 5z" />
      <path d="M6 12v5c3 2 9 2 12 0v-5" />
      <path d="M20 11.5V17" />
    </svg>
  );
}

function LibraryIcon({ className, strokeWidth = 2 }: IconProps) {
  return (
    <svg aria-hidden="true" className={className} fill="none" stroke="currentColor" strokeLinecap="round" strokeLinejoin="round" strokeWidth={strokeWidth} viewBox="0 0 24 24">
      <path d="M4 19.5V5a2 2 0 0 1 2-2h2v18H6a2 2 0 0 1-2-1.5z" />
      <path d="M10 3h4v18h-4z" />
      <path d="M16 3h2a2 2 0 0 1 2 2v14.5a2 2 0 0 1-2 1.5h-2z" />
    </svg>
  );
}

const tabs: BottomTab[] = [
  { label: "视频", href: "/watch", matchBase: "/watch", Icon: PlayIcon },
  { label: "阅读", href: "/lectura", matchBase: "/lectura", Icon: BookOpenIcon },
  { label: "课程", href: "/learn", matchBase: "/learn", Icon: GraduationCapIcon },
  { label: "语料库", href: "/vocab", matchBase: "/vocab", Icon: LibraryIcon }
];

const primaryTabLandingPaths = new Set(["/watch", "/lectura", "/learn", "/vocab"]);

function startsWith(pathname: string, base: string) {
  return pathname === base || pathname.startsWith(`${base}/`);
}

export function shouldHideTabBar(pathname: string, hasWatchVideo = false) {
  if (pathname.startsWith("/watch/")) {
    return true;
  }

  if (pathname === "/watch") {
    return hasWatchVideo;
  }

  const isPrimaryLandingPath = primaryTabLandingPaths.has(pathname);

  return !isPrimaryLandingPath;
}

export function BottomTabBar() {
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const videoId = searchParams.get("v")?.trim() ?? "";

  if (shouldHideTabBar(pathname, Boolean(videoId))) {
    return null;
  }

  return (
    <nav
      aria-label="主导航"
      className="fixed inset-x-0 bottom-0 z-40 border-t border-zinc-200/60 bg-white/80 pb-safe shadow-[0_-1px_12px_rgba(0,0,0,0.04)] backdrop-blur-xl dark:border-zinc-800/60 dark:bg-zinc-950/80 dark:shadow-[0_-1px_12px_rgba(0,0,0,0.4)] md:hidden"
    >
      <ul className="grid h-14 grid-cols-4 items-stretch">
        {tabs.map(({ label, href, matchBase, Icon }) => {
          const active = startsWith(pathname, matchBase);

          return (
            <li className="flex min-h-[44px]" key={href}>
              <Link
                aria-current={active ? "page" : undefined}
                className={`group flex flex-1 select-none flex-col items-center justify-center gap-0.5 transition-[color,transform] duration-150 active:scale-95 ${
                  active
                    ? "text-brand-600 dark:text-brand-400"
                    : "text-zinc-500 hover:text-zinc-700 dark:text-zinc-400 dark:hover:text-zinc-200"
                }`}
                href={href}
              >
                <Icon className="h-[22px] w-[22px]" strokeWidth={active ? 2.4 : 2} />
                <span className={`text-[10px] leading-none tracking-tight ${active ? "font-semibold" : "font-medium"}`}>
                  {label}
                </span>
              </Link>
            </li>
          );
        })}
      </ul>
    </nav>
  );
}
