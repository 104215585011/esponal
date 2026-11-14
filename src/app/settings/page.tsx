// Timestamp: 2026-11-15 02:32
import { SiteHeader } from "@/app/components/web/SiteHeader";
import { SettingsClient } from "./SettingsClient";

export default function SettingsPage() {
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
      </div>
    </main>
  );
}
