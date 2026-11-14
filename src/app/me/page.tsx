// Timestamp: 2026-11-15 02:35
import Link from "next/link";
import { getServerSession } from "next-auth";
import { getAuthOptions } from "@/lib/auth";
import { getCreditSummary } from "@/lib/credits/summary";
import { getVocabStats } from "@/lib/vocab";

export const dynamic = "force-dynamic";

type SessionUserWithId = {
  id?: string;
};

const rows = [
  { label: "积分账户", href: "/account/credits" },
  { label: "会员与订阅", href: "/membership" },
  { label: "设置", href: "/settings" },
  { label: "我的语料库", href: "/vocab" },
  { label: "我的导入库", href: "/import/library" },
];

export default async function MobileMePage() {
  const session = await getServerSession(getAuthOptions());
  const userId = (session?.user as SessionUserWithId | undefined)?.id;

  const [stats, creditSummary] = userId
    ? await Promise.all([
        getVocabStats(userId).catch(() => null),
        getCreditSummary(userId).catch(() => null),
      ])
    : [null, null];

  const displayName = session?.user?.name?.trim() || session?.user?.email || "未登录";

  return (
    <main className="px-4 pb-6 pt-5">
      <h1 className="text-[22px] font-extrabold tracking-tight text-zinc-950 dark:text-zinc-50">我的</h1>

      <div className="mt-4 flex items-center justify-between rounded-2xl border border-zinc-200/70 bg-white p-4 dark:border-zinc-800/70 dark:bg-zinc-900">
        <div>
          <div className="text-[15px] font-bold text-zinc-950 dark:text-zinc-50">{displayName}</div>
          <div className="mt-0.5 text-xs text-zinc-500 dark:text-zinc-400">
            {userId
              ? `已收藏 ${stats?.totalSaved ?? 0} 词${creditSummary ? ` · ${creditSummary.balanceDisplay} 配额` : ""}`
              : "登录以同步生词、阅读与观看进度"}
          </div>
        </div>
        {!userId ? (
          <Link
            href="/auth/sign-in?callbackUrl=/me"
            className="rounded-full bg-brand-500 px-3.5 py-1.5 text-xs font-semibold text-white"
          >
            登录
          </Link>
        ) : null}
      </div>

      <div className="mt-4 overflow-hidden rounded-2xl border border-zinc-200/70 bg-white dark:border-zinc-800/70 dark:bg-zinc-900">
        {rows.map((row) => (
          <Link
            className="flex items-center justify-between border-b border-zinc-100 px-4 py-3.5 text-[14px] font-medium text-zinc-800 last:border-b-0 active:bg-zinc-50 dark:border-zinc-800 dark:text-zinc-100 dark:active:bg-zinc-800"
            href={row.href}
            key={row.href}
          >
            <span>{row.label}</span>
            <span className="text-[12px] text-zinc-400">→</span>
          </Link>
        ))}
      </div>

      {userId ? (
        <Link
          href="/api/auth/signout"
          className="mt-4 flex w-full items-center justify-center rounded-2xl border border-zinc-200/70 bg-white py-3 text-xs font-semibold text-zinc-500 dark:border-zinc-800/70 dark:bg-zinc-900 dark:text-zinc-400"
        >
          退出登录
        </Link>
      ) : null}
    </main>
  );
}
