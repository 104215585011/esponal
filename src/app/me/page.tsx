// Timestamp: 2026-11-13 14:02
import Link from "next/link";

const rows = [
  { label: "积分账户", href: "/account/credits" },
  { label: "会员与订阅", href: "/membership" },
  { label: "设置", href: "/settings" },
  { label: "语料库", href: "/vocab" }
];

export default function MobileMePage() {
  return (
    <main className="px-4 pb-2 pt-5">
      <h1 className="text-[22px] font-extrabold tracking-tight text-zinc-950 dark:text-zinc-50">我的</h1>
      <p className="mt-1.5 text-[12.5px] leading-6 text-zinc-500">
        资料、积分、会员、设置收在这一页。正式版在 P2 迁入。
      </p>

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
    </main>
  );
}
