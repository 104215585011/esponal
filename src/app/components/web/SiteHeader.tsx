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
        <Link className="flex shrink-0 items-center gap-2.5" href="/">
          <span className="flex h-9 w-9 items-center justify-center rounded-card bg-brand-500 text-base font-bold text-white shadow-lg shadow-brand-500/20">
            E
          </span>
          <span className="text-xl font-bold font-display tracking-tight text-zinc-900 dark:text-zinc-50">Esponal</span>
        </Link>

        <SiteNav vocabHref={vocabHref} />

        <form
          action={searchAction}
          className="hidden lg:flex mx-auto w-full max-w-md flex-1 items-center rounded-full border border-zinc-200 dark:border-zinc-800 bg-zinc-50 dark:bg-zinc-900/50 focus-within:border-brand-500 focus-within:ring-2 focus-within:ring-brand-100/50 transition-all duration-300"
        >
          <span aria-hidden="true" className="px-3 text-zinc-400">
            <svg className="h-4 w-4 fill-none stroke-current stroke-2" viewBox="0 0 20 20">
              <circle cx="9" cy="9" r="5.5" />
              <path d="M13.5 13.5 18 18" />
            </svg>
          </span>
          <input
            className="h-10 w-full rounded-full border-0 bg-transparent pr-4 text-sm text-zinc-700 dark:text-zinc-300 outline-none placeholder:text-zinc-400"
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
              <summary className="flex list-none cursor-pointer items-center gap-2 rounded-full p-1 text-sm text-gray-600 hover:text-gray-900">
                {session.user.image ? (
                  <img
                    alt={displayName}
                    className="h-8 w-8 rounded-full object-cover"
                    referrerPolicy="no-referrer"
                    src={session.user.image}
                  />
                ) : (
                  <span className="flex h-8 w-8 items-center justify-center rounded-full bg-brand-100 text-xs font-semibold text-brand-700">
                    {initials}
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
