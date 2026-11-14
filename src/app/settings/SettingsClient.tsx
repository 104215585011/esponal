// Timestamp: 2026-11-15 02:32
"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { Moon, Sun, Gauge, BookOpen, FolderOpen, Sparkles, Puzzle } from "lucide-react";
import { getPlaybackRate, setPlaybackRate } from "@/lib/playback-rate";

const RATE_OPTIONS = [0.75, 0.85, 1, 1.25, 1.5];

export function SettingsClient() {
  const [isDark, setIsDark] = useState(false);
  const [rate, setRate] = useState(1);

  useEffect(() => {
    setIsDark(document.documentElement.classList.contains("dark"));
    setRate(getPlaybackRate());
  }, []);

  function handleThemeChange(nextDark: boolean) {
    setIsDark(nextDark);
    document.documentElement.classList.toggle("dark", nextDark);
    try {
      window.localStorage.setItem("color-theme", nextDark ? "dark" : "light");
    } catch {
      // ignore storage errors
    }
  }

  function handleRateChange(nextRate: number) {
    setRate(nextRate);
    setPlaybackRate(nextRate);
  }

  return (
    <div className="space-y-4">
      <section className="rounded-surface border border-zinc-200/70 bg-white p-5 shadow-card dark:border-zinc-800/70 dark:bg-zinc-900">
        <div className="flex items-center gap-2 text-xs font-semibold text-zinc-500 dark:text-zinc-400">
          {isDark ? <Moon className="h-4 w-4 text-brand-500" /> : <Sun className="h-4 w-4 text-brand-500" />}
          <span>外观主题</span>
        </div>
        <div className="mt-3 flex items-center justify-between gap-4">
          <div>
            <div className="text-sm font-semibold text-zinc-900 dark:text-zinc-50">界面配色</div>
            <div className="mt-0.5 text-xs text-zinc-500 dark:text-zinc-400">
              默认浅色阅读体验，夜间可切换深色模式
            </div>
          </div>
          <div className="inline-flex rounded-full border border-zinc-200 bg-zinc-50 p-1 dark:border-zinc-700 dark:bg-zinc-800">
            <button
              type="button"
              onClick={() => handleThemeChange(false)}
              className={`rounded-full px-3.5 py-1.5 text-xs font-semibold transition ${
                !isDark
                  ? "bg-white text-zinc-900 shadow-sm dark:bg-zinc-700 dark:text-zinc-50"
                  : "text-zinc-500 dark:text-zinc-400"
              }`}
            >
              浅色
            </button>
            <button
              type="button"
              onClick={() => handleThemeChange(true)}
              className={`rounded-full px-3.5 py-1.5 text-xs font-semibold transition ${
                isDark
                  ? "bg-zinc-900 text-zinc-50 shadow-sm dark:bg-brand-500 dark:text-white"
                  : "text-zinc-500 dark:text-zinc-400"
              }`}
            >
              深色
            </button>
          </div>
        </div>
      </section>

      <section className="rounded-surface border border-zinc-200/70 bg-white p-5 shadow-card dark:border-zinc-800/70 dark:bg-zinc-900">
        <div className="flex items-center gap-2 text-xs font-semibold text-zinc-500 dark:text-zinc-400">
          <Gauge className="h-4 w-4 text-brand-500" />
          <span>播放与朗读</span>
        </div>
        <div className="mt-3">
          <div className="text-sm font-semibold text-zinc-900 dark:text-zinc-50">默认倍速</div>
          <div className="mt-0.5 text-xs text-zinc-500 dark:text-zinc-400">
            应用于视频播放器与短文朗读，可随时在播放页微调
          </div>
          <div className="mt-3 flex flex-wrap gap-2">
            {RATE_OPTIONS.map((option) => (
              <button
                key={option}
                type="button"
                onClick={() => handleRateChange(option)}
                className={`rounded-full border px-3.5 py-1.5 text-xs font-semibold transition ${
                  rate === option
                    ? "border-brand-500 bg-brand-50 text-brand-700 dark:bg-brand-950/50 dark:text-brand-400"
                    : "border-zinc-200 bg-white text-zinc-600 hover:bg-zinc-50 dark:border-zinc-700 dark:bg-zinc-800 dark:text-zinc-300"
                }`}
              >
                {option}x
              </button>
            ))}
          </div>
        </div>
      </section>

      <section className="overflow-hidden rounded-surface border border-zinc-200/70 bg-white shadow-card dark:border-zinc-800/70 dark:bg-zinc-900">
        <Link
          href="/vocab"
          className="flex items-center justify-between border-b border-zinc-100 px-5 py-3.5 text-sm font-medium text-zinc-800 transition hover:bg-zinc-50 dark:border-zinc-800 dark:text-zinc-100 dark:hover:bg-zinc-800/70"
        >
          <span className="flex items-center gap-2.5">
            <BookOpen className="h-4 w-4 text-brand-500" />
            <span>我的语料库</span>
          </span>
          <span className="text-xs text-zinc-400">→</span>
        </Link>
        <Link
          href="/import/library"
          className="flex items-center justify-between border-b border-zinc-100 px-5 py-3.5 text-sm font-medium text-zinc-800 transition hover:bg-zinc-50 dark:border-zinc-800 dark:text-zinc-100 dark:hover:bg-zinc-800/70"
        >
          <span className="flex items-center gap-2.5">
            <FolderOpen className="h-4 w-4 text-brand-500" />
            <span>我的导入库</span>
          </span>
          <span className="text-xs text-zinc-400">→</span>
        </Link>
        <Link
          href="/account/credits"
          className="flex items-center justify-between border-b border-zinc-100 px-5 py-3.5 text-sm font-medium text-zinc-800 transition hover:bg-zinc-50 dark:border-zinc-800 dark:text-zinc-100 dark:hover:bg-zinc-800/70"
        >
          <span className="flex items-center gap-2.5">
            <Sparkles className="h-4 w-4 text-brand-500" />
            <span>积分与配额</span>
          </span>
          <span className="text-xs text-zinc-400">→</span>
        </Link>
        <Link
          href="/extension"
          className="flex items-center justify-between px-5 py-3.5 text-sm font-medium text-zinc-800 transition hover:bg-zinc-50 dark:text-zinc-100 dark:hover:bg-zinc-800/70"
        >
          <span className="flex items-center gap-2.5">
            <Puzzle className="h-4 w-4 text-brand-500" />
            <span>浏览器扩展</span>
          </span>
          <span className="text-xs text-zinc-400">→</span>
        </Link>
      </section>
    </div>
  );
}
