import Link from "next/link";
import { getServerSession } from "next-auth";
import { SiteNav } from "@/app/components/web/SiteNav";
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
    <header className="sticky top-0 z-50 border-b border-gray-100 bg-surface shadow-card">
      <div className="mx-auto flex h-16 w-full max-w-screen-xl items-center gap-4 px-4">
        <Link className="flex shrink-0 items-center gap-2" href="/">
          <span className="flex h-8 w-8 items-center justify-center rounded-card bg-brand-500 text-sm font-semibold text-white">
            E
          </span>
          <span className="text-xl font-bold text-gray-900">Esponal</span>
        </Link>

        <SiteNav vocabHref={vocabHref} />

        <form
          action={searchAction}
          className="mx-auto flex w-full max-w-md flex-1 items-center rounded-full border border-gray-200 bg-muted focus-within:border-brand-400 focus-within:ring-2 focus-within:ring-brand-100"
        >
          <span aria-hidden="true" className="px-3 text-gray-400">
            <svg className="h-4 w-4 fill-none stroke-current stroke-2" viewBox="0 0 20 20">
              <circle cx="9" cy="9" r="5.5" />
              <path d="M13.5 13.5 18 18" />
            </svg>
          </span>
          <input
            className="h-10 w-full rounded-full border-0 bg-transparent pr-4 text-sm text-gray-700 outline-none placeholder:text-gray-400"
            defaultValue={initialQuery}
            name="q"
            placeholder="搜索西语视频..."
            type="search"
          />
        </form>

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
              <div className="absolute right-0 mt-2 w-40 rounded-card border border-gray-100 bg-surface p-2 shadow-elevated">
                <Link
                  className="block rounded-card px-3 py-2 text-sm text-gray-600 hover:bg-muted hover:text-gray-900"
                  href="/vocab"
                >
                  我的词库
                </Link>
                <Link
                  className="block rounded-card px-3 py-2 text-sm text-gray-600 hover:bg-muted hover:text-gray-900"
                  href="/api/auth/signout"
                >
                  退出
                </Link>
              </div>
            </details>
          ) : (
            <Link
              className="text-sm font-medium text-gray-600 transition hover:text-gray-900"
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
