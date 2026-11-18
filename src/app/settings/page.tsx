// Timestamp: 2026-11-18 10:58
import Link from "next/link";
import { getServerSession } from "next-auth";
import { SiteHeader } from "@/app/components/web/SiteHeader";
import { findAdminUser } from "@/lib/admin";
import { getAuthOptions } from "@/lib/auth";
import { SettingsClient } from "./SettingsClient";

export default async function SettingsPage() {
  const session = await getServerSession(getAuthOptions());
  const admin = await findAdminUser((session?.user as { id?: string } | undefined)?.id);
  return (
    <main className="min-h-screen bg-app">
      <SiteHeader />
      <div className="mx-auto w-full max-w-3xl px-4 py-6 sm:px-6 md:py-10">
        <header className="mb-6">
          <h1 className="font-display text-2xl font-bold tracking-tight text-zinc-950 dark:text-zinc-50">
            设置
          </h1>
          <p className="mt-1.5 text-sm text-zinc-500 dark:text-zinc-400">
            管理你的外观主题、默认朗读倍速与常用学习入口。
          </p>
        </header>
        <SettingsClient />
        {admin && (
          <Link href="/admin" className="mt-5 inline-flex rounded-lg border border-brand-200 px-4 py-2 font-medium text-brand-700 dark:border-brand-900 dark:text-brand-300">
            打开管理后台
          </Link>
        )}
      </div>
    </main>
  );
}
