// Timestamp: 2026-05-26 15:50
import Link from "next/link";
import { getServerSession } from "next-auth";
import { PlaybackRateControl } from "@/app/components/audio/PlaybackRateControl";
import { SiteNav } from "@/app/components/web/SiteNav";
import { ThemeToggle } from "@/app/components/web/ThemeToggle";
import { getAuthOptions } from "@/lib/auth";

type SiteHeaderProps = {
  searchAction?: string;
  initialQuery?: string;
};

function getInitials(name: string) {
  return name
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((part) => part[0]?.toUpperCase() ?? "")
    .join("");
}

export async function SiteHeader({
  searchAction = "/search",
  initialQuery = ""
}: SiteHeaderProps) {
  const session = await getServerSession(getAuthOptions());
  const displayName = session?.user?.name?.trim() || "Esponal User";
  const initials = getInitials(displayName) || "ES";
  const vocabHref = session?.user ? "/vocab" : "/auth/sign-in?callbackUrl=/vocab";

  return (
    <header className="sticky top-0 z-50 border-b border-zinc-200/50 dark:border-zinc-800/50 shadow-sm transition-all duration-300">
      <div className="absolute inset-0 z-[-1] glass-header" />
      <div className="mx-auto flex h-16 w-full max-w-app-shell items-center gap-4 px-6">
        <Link className="flex shrink-0 items-center gap-2.5 group" href="/">
          <div className="flex h-8.5 w-8.5 items-center justify-center rounded-xl bg-gradient-to-br from-brand-500 to-brand-400 dark:from-brand-600 dark:to-teal-400 text-white shadow-md shadow-brand-500/20 dark:shadow-brand-950/20 group-hover:scale-105 transition-transform duration-300">
            <svg className="h-4.5 w-4.5 text-white" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
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

        <SiteNav vocabHref={vocabHref} />

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
            placeholder="搜索西语视频..."
            type="search"
          />
        </form>

        <PlaybackRateControl className="shrink-0" />
        <ThemeToggle />

        <div className="shrink-0">
          {session?.user ? (
            <details className="relative">
              <summary className="flex list-none cursor-pointer items-center gap-2 rounded-full p-0.5 text-sm text-gray-600 hover:text-gray-900">
                {session.user.image ? (
                  <img
                    alt={displayName}
                    className="h-8.5 w-8.5 rounded-full object-cover ring-2 ring-zinc-100 dark:ring-zinc-800 transition-transform duration-300 hover:scale-105"
                    referrerPolicy="no-referrer"
                    src={session.user.image}
                  />
                ) : (
                  <span className="relative flex h-8.5 w-8.5 items-center justify-center rounded-full bg-gradient-to-tr from-indigo-500 to-brand-500 dark:from-indigo-600 dark:to-brand-650 text-[11px] font-bold text-white shadow-md shadow-brand-500/10 ring-2 ring-white dark:ring-zinc-900 transition-transform duration-300 hover:scale-105">
                    {initials}
                    <span className="absolute bottom-0 right-0 block h-2 w-2 rounded-full bg-brand-400 ring-1.5 ring-white dark:ring-zinc-900" />
                  </span>
                )}
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
              className="text-sm font-medium text-zinc-600 dark:text-zinc-400 transition hover:text-zinc-900 dark:hover:text-zinc-100"
              href="/auth/sign-in"
            >
              登录
            </Link>
          )}
        </div>
      </div>
    </header>
  );
}
