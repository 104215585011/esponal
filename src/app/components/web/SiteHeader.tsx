// Timestamp: 2026-06-01 22:15
import Link from "next/link";
import { getServerSession } from "next-auth";
import { PlaybackRateControl } from "@/app/components/audio/PlaybackRateControl";
import { SiteNav } from "@/app/components/web/SiteNav";
import { ThemeToggle } from "@/app/components/web/ThemeToggle";
import { GlobalSearchOverlay } from "@/app/components/web/GlobalSearchOverlay";
import { getAuthOptions } from "@/lib/auth";

type SiteHeaderProps = {
  searchAction?: string;
  initialQuery?: string;
};

const DEFAULT_AVATAR_SRC = "/images/default-avatar.png";
const avatarClassName =
  "h-7 w-7 rounded-full object-cover ring-1.5 ring-zinc-200/80 dark:ring-zinc-700/80 transition-transform duration-300 hover:scale-105";

export async function SiteHeader({
  searchAction = "/search",
  initialQuery = ""
}: SiteHeaderProps) {
  const session = await getServerSession(getAuthOptions());
  const displayName = session?.user?.name?.trim() || "Esponal User";
  const vocabHref = session?.user ? "/vocab" : "/auth/sign-in?callbackUrl=/vocab";

  return (
    <header className="sticky top-0 z-50 border-b border-zinc-200/50 dark:border-zinc-800/50 shadow-sm transition-all duration-300">
      <div className="absolute inset-0 z-[-1] glass-header" />
      <div className="mx-auto flex h-16 w-full max-w-app-shell items-center gap-3 px-4 sm:px-6 lg:gap-4">
        <Link className="flex shrink-0 items-center gap-2.5 group" href="/">
          <div className="flex h-8.5 w-8.5 items-center justify-center rounded-xl bg-gradient-to-br from-brand-500 to-brand-400 dark:from-brand-600 dark:to-teal-400 text-white shadow-md shadow-brand-500/20 dark:shadow-brand-950/20 group-hover:scale-105 transition-transform duration-300">
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
          <span className="text-[17px] font-bold font-display tracking-tight text-zinc-900 dark:text-zinc-50 group-hover:text-brand-600 dark:group-hover:text-brand-400 transition-colors">
            Esponal
          </span>
        </Link>

        <SiteNav vocabHref={vocabHref} session={session} />

        <form
          action={searchAction}
          className="hidden lg:flex mx-auto w-full max-w-md flex-1 items-center rounded-full border border-zinc-200/60 dark:border-zinc-800/60 bg-zinc-50/50 dark:bg-zinc-950/20 focus-within:border-brand-500/80 focus-within:bg-white dark:focus-within:bg-zinc-900/50 focus-within:ring-2 focus-within:ring-brand-100/30 transition-all duration-300"
        >
          <span aria-hidden="true" className="px-3 text-zinc-400">
            <svg className="h-4 w-4 fill-none stroke-current stroke-2" viewBox="0 0 20 20">
              <circle cx="9" cy="9" r="5.5" />
              <path d="M13.5 13.5 18 18" />
            </svg>
          </span>
          <input
            className="h-9 w-full rounded-full border-0 bg-transparent pr-4 text-xs text-zinc-700 dark:text-zinc-300 outline-none placeholder:text-zinc-450"
            defaultValue={initialQuery}
            name="q"
            placeholder="搜索内容..."
            type="search"
          />
        </form>

        <GlobalSearchOverlay searchAction={searchAction} initialQuery={initialQuery} />

        <div className="hidden lg:block shrink-0">
          <PlaybackRateControl className="shrink-0" />
        </div>
        <div className="hidden lg:block">
          <ThemeToggle />
        </div>

        <div className="hidden lg:block shrink-0">
          {session?.user ? (
            <details className="relative">
              <summary className="flex list-none cursor-pointer items-center gap-2 rounded-full p-0.5 text-sm text-gray-600 hover:text-gray-900">
                <img
                  alt={displayName}
                  className={avatarClassName}
                  referrerPolicy="no-referrer"
                  src={session.user.image || DEFAULT_AVATAR_SRC}
                />
              </summary>
              <div className="absolute right-0 mt-2 w-40 rounded-card border border-zinc-200 dark:border-zinc-800 bg-white dark:bg-zinc-900 p-2 shadow-elevated">
                <Link
                  className="block rounded-card px-3 py-2 text-sm text-zinc-600 dark:text-zinc-400 hover:bg-zinc-100 dark:hover:bg-zinc-800 hover:text-zinc-900 dark:hover:text-zinc-100"
                  href="/vocab"
                >
                  我的词库
                </Link>
                <Link
                  className="block rounded-card px-3 py-2 text-sm text-zinc-600 dark:text-zinc-400 hover:bg-zinc-100 dark:hover:bg-zinc-800 hover:text-zinc-900 dark:hover:text-zinc-100"
                  href="/api/auth/signout"
                >
                  退出
                </Link>
              </div>
            </details>
          ) : (
            <Link
              aria-label="登录"
              className="block rounded-full p-0.5"
              href="/auth/sign-in"
            >
              <img
                alt="登录"
                className={avatarClassName}
                src={DEFAULT_AVATAR_SRC}
              />
            </Link>
          )}
        </div>
      </div>
    </header>
  );
}
