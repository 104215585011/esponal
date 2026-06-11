// Timestamp: 2026-06-11 11:05
import { AppShell } from "@/app/components/shell/AppShell";

export default function MobileHomePage() {
  return (
    <AppShell title="Esponal">
      <main className="px-4 py-6">
        <section className="rounded-[28px] border border-zinc-200/70 bg-white px-5 py-6 shadow-[0_18px_48px_-32px_rgba(15,23,42,0.35)]">
          <p className="text-xs font-bold uppercase tracking-[0.18em] text-brand-600">Home</p>
          <h2 className="mt-3 text-2xl font-extrabold tracking-tight text-zinc-950">首页建设中</h2>
          <p className="mt-2 text-sm leading-6 text-zinc-500">
            这里会承接继续学习、待复习、学习路线和工具入口。当前票只搭建移动壳。
          </p>
        </section>
      </main>
    </AppShell>
  );
}
