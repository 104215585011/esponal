// Timestamp: 2026-06-11 11:05
import Link from "next/link";
import { AppShell } from "@/app/components/shell/AppShell";

export default function MobileMePage() {
  return (
    <AppShell title="我的">
      <main className="px-4 py-6">
        <section className="rounded-[28px] border border-zinc-200/70 bg-white px-5 py-6 shadow-[0_18px_48px_-32px_rgba(15,23,42,0.35)]">
          <p className="text-xs font-bold uppercase tracking-[0.18em] text-brand-600">Me</p>
          <h2 className="mt-3 text-2xl font-extrabold tracking-tight text-zinc-950">我的建设中</h2>
          <p className="mt-2 text-sm leading-6 text-zinc-500">
            这里会承接资料、积分账户、会员和设置。当前票只搭建移动壳。
          </p>
          <div className="mt-5 grid gap-2">
            <Link className="rounded-2xl bg-zinc-50 px-4 py-3 text-sm font-semibold text-zinc-700" href="/account/credits">
              积分账户
            </Link>
            <Link className="rounded-2xl bg-zinc-50 px-4 py-3 text-sm font-semibold text-zinc-700" href="/membership">
              会员
            </Link>
          </div>
        </section>
      </main>
    </AppShell>
  );
}
