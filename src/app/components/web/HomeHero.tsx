// Timestamp: 2026-05-26 15:54
"use client";

import Link from "next/link";
import { ParticleBackground } from "@/app/components/ui/ParticleBackground";

type HomeHeroProps = {
  isLoggedIn: boolean;
};

export function HomeHero({ isLoggedIn }: HomeHeroProps) {
  return (
    <section className="relative overflow-hidden rounded-hero bg-white dark:bg-zinc-900 border border-zinc-200/50 dark:border-zinc-800/50 shadow-card transition-all duration-300 min-h-[460px] flex items-center p-8 sm:p-16 mb-16">
      {/* Interactive Particle Canvas scoped inside the Hero Card */}
      <ParticleBackground />

      <div className="relative z-10 max-w-2xl">
        <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-semibold bg-brand-50 dark:bg-brand-950/50 text-brand-600 dark:text-brand-400 border border-brand-200/30 mb-6">
          <span className="w-1.5 h-1.5 rounded-full bg-brand-500 animate-pulse"></span>
          全新设计语言 · 极简交互体验
        </span>

        {/* 西班牙语，从听懂开始 */}
        <h1 className="text-4xl sm:text-5xl lg:text-6xl font-extrabold font-display tracking-tight leading-tight text-zinc-950 dark:text-zinc-50">
          西班牙语，<br className="hidden sm:inline" />从<span className="text-brand-500">听懂</span>开始
        </h1>

        <p className="mt-6 text-base sm:text-lg text-zinc-500 dark:text-zinc-400 leading-relaxed font-light">
          {isLoggedIn
            ? "欢迎回来，继续你的西语之旅。下一步发音、阅读、视频和对话都已经帮你排好。"
            : "面向中文母语者的西语学习工具集，从 A1 起步，在真实内容里积累词汇、语感和表达。"}
        </p>
        <p className="mt-1 text-sm text-gray-400">
          A1 起步，在真实内容里积累词汇。
        </p>

        <div className="mt-8 flex flex-wrap gap-4 items-center">
          <Link
            className="px-8 py-3.5 text-sm font-semibold text-white bg-brand-500 hover:bg-brand-600 rounded-full transition-all duration-300 transform hover:scale-105 shadow-lg shadow-brand-500/20"
            href="/phonics"
          >
            开始学习 →
          </Link>
          <a
            className="px-6 py-3.5 text-sm font-semibold text-zinc-700 dark:text-zinc-300 border border-zinc-200 dark:border-zinc-800 hover:bg-zinc-50 dark:hover:bg-zinc-800 rounded-full transition-all duration-300"
            href="#tools"
          >
            查看工具
          </a>
        </div>

        {!isLoggedIn ? (
          <p className="mt-5 text-sm text-zinc-500 dark:text-zinc-400">
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
