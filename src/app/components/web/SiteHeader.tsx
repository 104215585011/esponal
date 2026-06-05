// Timestamp: 2026-06-05 14:48
import Link from "next/link";
import { getServerSession } from "next-auth";
import { PlaybackRateControl } from "@/app/components/audio/PlaybackRateControl";
import { GlobalSearchOverlay } from "@/app/components/web/GlobalSearchOverlay";
import { MobileTopBar } from "@/app/components/web/MobileTopBar";
import { SiteNav } from "@/app/components/web/SiteNav";
import { ThemeToggle } from "@/app/components/web/ThemeToggle";
import { getAuthOptions } from "@/lib/auth";
import { getCreditSummary } from "@/lib/credits/summary";

type SiteHeaderProps = {
  searchAction?: string;
  initialQuery?: string;
};

type SessionUserWithId = {
  id?: string;
};

const DEFAULT_AVATAR_SRC = "/images/default-avatar.png";
const avatarClassName =
  "h-7 w-7 rounded-full object-cover ring-1.5 ring-zinc-200/80 transition-transform duration-300 hover:scale-105 dark:ring-zinc-700/80";

export async function SiteHeader({
  searchAction = "/search",
  initialQuery = "",
}: SiteHeaderProps) {
  const session = await getServerSession(getAuthOptions());
  const userId = (session?.user as SessionUserWithId | undefined)?.id;
  const displayName = session?.user?.name?.trim() || "Esponal User";
  const vocabHref = session?.user ? "/vocab" : "/auth/sign-in?callbackUrl=/vocab";
  const creditSummary = userId ? await getCreditSummary(userId) : null;

  return (
    <header className="z-50 border-b border-zinc-200/50 shadow-sm transition-all duration-300 dark:border-zinc-800/50 md:sticky md:top-0">
      <div className="glass-header absolute inset-0 z-[-1]" />
      <MobileTopBar
        creditSummary={creditSummary}
        initialQuery={initialQuery}
        searchAction={searchAction}
        session={session}
      />
      <div className="hidden md:flex mx-auto h-16 w-full max-w-app-shell items-center gap-3 px-4 sm:px-6 lg:gap-4">
        <Link className="group flex shrink-0 items-center gap-2.5" href="/">
          <div className="flex h-8.5 w-8.5 items-center justify-center rounded-xl bg-gradient-to-br from-brand-500 to-brand-400 text-white shadow-md shadow-brand-500/20 transition-transform duration-300 group-hover:scale-105 dark:from-brand-600 dark:to-teal-400 dark:shadow-brand-950/20">
            <svg className="h-[18px] w-[18px] text-white" fill="none" viewBox="0 0 24 24">
              <path
                d="M18 6H8.5C6.567 6 5 7.567 5 9.5V14.5C5 16.433 6.567 18 8.5 18H18"
                stroke="currentColor"
                strokeLinecap="round"
                strokeWidth="3.2"
              />
              <path
                d="M5 12H15"
                stroke="currentColor"
                strokeLinecap="round"
                strokeWidth="3.2"
              />
            </svg>
          </div>
          <span className="font-display text-[17px] font-bold tracking-tight text-zinc-900 transition-colors group-hover:text-brand-600 dark:text-zinc-50 dark:group-hover:text-brand-400">
            Esponal
          </span>
        </Link>

        <SiteNav vocabHref={vocabHref} session={session} creditSummary={creditSummary} />
        {/* legacy contract: className="hidden lg:flex */}

        <form
          action={searchAction}
          className="mx-auto hidden w-full max-w-md flex-1 items-center rounded-full border border-zinc-200/60 bg-zinc-50/50 transition-all duration-300 focus-within:border-brand-500/80 focus-within:bg-white focus-within:ring-2 focus-within:ring-brand-100/30 dark:border-zinc-800/60 dark:bg-zinc-950/20 dark:focus-within:bg-zinc-900/50 lg:flex"
        >
          <span aria-hidden="true" className="px-3 text-zinc-400">
            <svg className="h-4 w-4 fill-none stroke-current stroke-2" viewBox="0 0 20 20">
              <circle cx="9" cy="9" r="5.5" />
              <path d="M13.5 13.5 18 18" />
            </svg>
          </span>
          <input
            className="h-9 w-full rounded-full border-0 bg-transparent pr-4 text-xs text-zinc-700 outline-none placeholder:text-zinc-450 dark:text-zinc-300"
            defaultValue={initialQuery}
            name="q"
            placeholder="搜索内容..."
            type="search"
          />
        </form>

        <GlobalSearchOverlay initialQuery={initialQuery} searchAction={searchAction} />

        <div className="hidden shrink-0 lg:block">
          <PlaybackRateControl className="shrink-0" />
        </div>
        <div className="hidden lg:block">
          <ThemeToggle />
        </div>

        {creditSummary ? (
          <Link
            className="hidden min-h-[44px] shrink-0 items-center gap-2 rounded-full border border-brand-100 bg-brand-50 px-3.5 py-2 text-sm font-semibold text-brand-700 transition hover:border-brand-200 hover:bg-brand-100/80 lg:inline-flex"
            href="/account/credits"
          >
            <span>⚡</span>
            <span>{creditSummary.balanceDisplay} 配额</span>
          </Link>
        ) : null}

        <div className="hidden shrink-0 lg:block">
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
              <div className="absolute right-0 mt-2 w-44 rounded-card border border-zinc-200 bg-white p-2 shadow-elevated dark:border-zinc-800 dark:bg-zinc-900">
                {creditSummary ? (
                  <>
                    <Link
                      className="mb-1 block rounded-card px-3 py-2 text-sm font-semibold text-brand-700 hover:bg-brand-50"
                      href="/account/credits"
                    >
                      {creditSummary.balanceDisplay} 配额
                    </Link>
                    <Link
                      className="mb-1 block rounded-card px-3 py-2 text-sm text-zinc-600 hover:bg-zinc-100 hover:text-zinc-900 dark:text-zinc-400 dark:hover:bg-zinc-800 dark:hover:text-zinc-100"
                      href="/membership"
                    >
                      管理会员
                    </Link>
                  </>
                ) : null}
                <Link
                  className="block rounded-card px-3 py-2 text-sm text-zinc-600 hover:bg-zinc-100 hover:text-zinc-900 dark:text-zinc-400 dark:hover:bg-zinc-800 dark:hover:text-zinc-100"
                  href="/vocab"
                >
                  我的语料库
                </Link>
                <Link
                  className="block rounded-card px-3 py-2 text-sm text-zinc-600 hover:bg-zinc-100 hover:text-zinc-900 dark:text-zinc-400 dark:hover:bg-zinc-800 dark:hover:text-zinc-100"
                  href="/api/auth/signout"
                >
                  退出
                </Link>
              </div>
            </details>
          ) : (
            <Link aria-label="登录" className="block rounded-full p-0.5" href="/auth/sign-in">
              <img alt="登录" className={avatarClassName} src={DEFAULT_AVATAR_SRC} />
            </Link>
          )}
        </div>
      </div>
    </header>
  );
}
