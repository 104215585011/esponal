// Timestamp: 2026-06-03 16:34
"use client";

import Link from "next/link";
import { ParticleBackground } from "@/app/components/ui/ParticleBackground";

type HomeHeroProps = {
  isLoggedIn: boolean;
};

export function HomeHero({ isLoggedIn }: HomeHeroProps) {
  return (
    <section className="relative mb-8 flex min-h-[240px] items-center overflow-hidden rounded-hero border border-zinc-200/50 bg-white p-6 shadow-card transition-all duration-300 dark:border-zinc-800/50 dark:bg-zinc-900 sm:p-8 md:mb-16 md:min-h-[460px] md:p-16">
      <div aria-hidden className="pointer-events-none absolute -right-16 -top-16 h-48 w-48 rounded-full bg-brand-500/10 blur-3xl md:hidden" />
      <div className="hidden md:block">
        <ParticleBackground />
      </div>

      <div className="relative z-10 max-w-2xl">
        <span className="mb-4 inline-flex items-center gap-1.5 rounded-full border border-brand-200/30 bg-brand-50 px-3 py-1 text-xs font-semibold text-brand-600 dark:bg-brand-950/50 dark:text-brand-400 md:mb-6">
          <span className="w-1.5 h-1.5 rounded-full bg-brand-500 animate-pulse"></span>
          全新设计语言 · 极简交互体验
        </span>

        {/* 西班牙语，从听懂开始 */}
        <h1 className="font-display text-[26px] font-extrabold leading-tight tracking-tight text-zinc-950 dark:text-zinc-50 sm:text-4xl md:text-5xl lg:text-6xl">
          西班牙语，<br className="hidden sm:inline" />从<span className="text-brand-500">听懂</span>开始
        </h1>

        <p className="mt-3 text-sm font-light leading-relaxed text-zinc-500 dark:text-zinc-400 md:mt-6 md:text-lg">
          {isLoggedIn
            ? "欢迎回来，继续你的西语之旅。下一步发音、阅读、视频和对话都已经帮你排好。"
            : "面向中文母语者的西语学习工具集，从 A1 起步，在真实内容里积累词汇、语感和表达。"}
        </p>
        <p className="mt-1 hidden text-sm text-zinc-400 dark:text-zinc-500 md:block">
          A1 起步，在真实内容里积累词汇。
        </p>

        <div className="mt-6 flex flex-col gap-3 sm:flex-row sm:flex-wrap sm:items-center md:mt-8">
          <Link
            className="inline-flex w-full items-center justify-center rounded-full bg-brand-500 px-8 py-3.5 text-sm font-semibold text-white shadow-lg shadow-brand-500/20 transition-all duration-300 hover:bg-brand-600 active:scale-[0.98] sm:w-auto"
            href={isLoggedIn ? "/learn" : "/phonics"}
          >
            开始学习 →
          </Link>
          <a
            className="hidden items-center justify-center rounded-full border border-zinc-200 px-6 py-3.5 text-sm font-semibold text-zinc-700 transition-all duration-300 hover:bg-zinc-50 dark:border-zinc-800 dark:text-zinc-300 dark:hover:bg-zinc-800 sm:inline-flex"
            href="#tools"
          >
            查看工具
          </a>
        </div>

        {!isLoggedIn ? (
          <p className="mt-4 text-sm text-zinc-500 dark:text-zinc-400 md:mt-5">
            已有账号？
            <Link className="ml-1 font-medium text-brand-700 dark:text-brand-400 hover:underline" href="/auth/sign-in">
              登录
            </Link>
          </p>
        ) : null}
      </div>
    </section>
  );
}
