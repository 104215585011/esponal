import Link from "next/link";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";

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
  const session = await getServerSession(authOptions);
  const displayName = session?.user?.name?.trim() || "Esponal User";
  const initials = getInitials(displayName) || "ES";

  return (
    <header className="sticky top-0 z-50 border-b border-gray-100 bg-white shadow-[0_1px_3px_rgba(0,0,0,0.05)]">
      <div className="mx-auto flex h-16 w-full max-w-screen-xl items-center gap-4 px-4">
        <Link className="flex shrink-0 items-center gap-2" href="/">
          <span className="flex h-8 w-8 items-center justify-center rounded-lg bg-emerald-500 text-sm font-semibold text-white">
            E
          </span>
          <span className="text-xl font-bold text-gray-900">Esponal</span>
        </Link>

        <form
          action={searchAction}
          className="mx-auto flex w-full max-w-md flex-1 items-center rounded-full border border-gray-200 bg-gray-50 focus-within:border-emerald-400 focus-within:ring-2 focus-within:ring-emerald-100"
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
            placeholder="搜索西语视频…"
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
                  <span className="flex h-8 w-8 items-center justify-center rounded-full bg-emerald-100 text-xs font-semibold text-emerald-700">
                    {initials}
                  </span>
                )}
              </summary>
              <div className="absolute right-0 mt-2 w-40 rounded-lg border border-gray-100 bg-white p-2 shadow-lg">
                <Link
                  className="block rounded-md px-3 py-2 text-sm text-gray-600 hover:bg-gray-50 hover:text-gray-900"
                  href="/vocab"
                >
                  我的词库
                </Link>
                <span className="block rounded-md px-3 py-2 text-sm text-gray-300">
                  设置
                </span>
                <Link
                  className="block rounded-md px-3 py-2 text-sm text-gray-600 hover:bg-gray-50 hover:text-gray-900"
                  href="/api/auth/signout"
                >
                  退出
                </Link>
              </div>
            </details>
          ) : (
            <Link
              className="text-sm text-gray-600 transition hover:text-gray-900"
              href="/api/auth/signin"
            >
              登录
            </Link>
          )}
        </div>
      </div>
    </header>
  );
}
