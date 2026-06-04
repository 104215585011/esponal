// Timestamp: 2026-06-04 12:08
"use client";

import Link from "next/link";
import { ParticleBackground } from "@/app/components/ui/ParticleBackground";

type HomeHeroProps = {
  isLoggedIn: boolean;
};

export function HomeHero({ isLoggedIn }: HomeHeroProps) {
  return (
    <section className="relative min-h-[240px] overflow-hidden bg-white px-[22px] pb-1 pt-[30px] md:mb-16 md:flex md:min-h-[460px] md:items-center md:rounded-hero md:border md:border-zinc-200/50 md:p-16 md:shadow-card md:transition-all md:duration-300 dark:md:border-zinc-800/50 dark:md:bg-zinc-900">
      <div className="pointer-events-none absolute -right-16 -top-16 h-44 w-44 rounded-full bg-brand-500/10 blur-3xl md:hidden" />
      <div className="hidden md:block">
        <ParticleBackground />
      </div>

      <div className="relative z-10 max-w-2xl">
        <span className="mb-[14px] inline-flex items-center gap-[7px] text-[13px] font-semibold tracking-[0.02em] text-brand-700 md:mb-6 md:rounded-full md:border md:border-brand-200/30 md:bg-brand-50 md:px-3 md:py-1 md:text-xs dark:md:bg-brand-950/50 dark:md:text-brand-400">
          <span className="h-1.5 w-1.5 rounded-full bg-brand-500 shadow-[0_0_0_4px_rgba(16,185,129,0.12)]" />
          {isLoggedIn ? "欢迎回来" : "面向中文母语者"}
        </span>

        <h1 className="font-display text-[33px] font-bold leading-[1.32] tracking-[-0.01em] text-zinc-950 md:text-6xl md:font-extrabold md:leading-tight dark:text-zinc-50">
          西班牙语，
          <br className="md:hidden" />
          从<span className="text-brand-700 md:text-brand-500">听懂</span>开始
        </h1>

        <p className="mt-[14px] max-w-[300px] text-sm font-light leading-[1.8] text-zinc-500 md:mt-6 md:max-w-none md:text-lg md:leading-relaxed dark:text-zinc-400">
          {isLoggedIn
            ? "继续你的西语之旅。发音、阅读、视频和对话，都已经帮你排好。"
            : "继续你的西语之旅。下一步发音、阅读、视频和对话，都已经帮你排好。"}
        </p>

        <div className="mt-[22px] flex flex-wrap items-center gap-4 md:mt-8">
          <Link
            className="inline-flex min-h-[46px] items-center gap-2 rounded-[14px] bg-brand-500 px-[24px] py-[13px] text-[15px] font-semibold text-white shadow-[0_8px_20px_-8px_rgba(16,185,129,0.5)] transition-all duration-200 active:translate-y-px active:scale-[0.99] md:px-8 md:py-3.5 md:hover:scale-105 md:hover:bg-brand-600"
            href={isLoggedIn ? "/learn" : "/phonics"}
          >
            {isLoggedIn ? "继续学习" : "开始学习"}
            <span aria-hidden="true">→</span>
          </Link>
          <a
            className="hidden rounded-full border border-zinc-200 px-6 py-3.5 text-sm font-semibold text-zinc-700 transition-all duration-300 hover:bg-zinc-50 md:inline-flex dark:border-zinc-800 dark:text-zinc-300 dark:hover:bg-zinc-800"
            href="#tools"
          >
            查看工具
          </a>
        </div>

        {!isLoggedIn ? (
          <p className="mt-5 text-sm text-zinc-500 dark:text-zinc-400">
            已有账号？
            <Link className="ml-1 font-medium text-brand-700 hover:underline dark:text-brand-400" href="/auth/sign-in">
              登录
            </Link>
          </p>
        ) : null}
      </div>
    </section>
  );
}
