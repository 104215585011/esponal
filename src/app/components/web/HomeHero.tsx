"use client";

import Link from "next/link";

type HomeHeroProps = {
  isLoggedIn: boolean;
};

export function HomeHero({ isLoggedIn }: HomeHeroProps) {
  return (
    <section className="overflow-hidden rounded-hero bg-gradient-to-br from-brand-50 to-white px-6 py-10 shadow-card sm:px-10 sm:py-12">
      <div className="max-w-3xl">
        <p className="text-sm font-semibold uppercase tracking-[0.18em] text-brand-700">
          Esponal
        </p>
        <h1 className="mt-4 text-3xl font-bold tracking-tight text-gray-950 lg:text-4xl">
          西班牙语，从听懂开始
        </h1>
        <p className="mt-4 max-w-[560px] text-base leading-7 text-gray-600">
          {isLoggedIn
            ? "欢迎回来，继续你的西语之旅。下一步发音、阅读、视频和对话都已经帮你排好。"
            : "面向中文母语者的西语学习工具集，从 A1 起步，在真实内容里积累词汇、语感和表达。"}
        </p>
        <p className="mt-1 text-sm text-gray-400">
          A1 起步，在真实内容里积累词汇。
        </p>

        <div className="mt-7 flex flex-wrap items-center gap-3">
          <Link
            className="rounded-full bg-brand-600 px-8 py-3 text-sm font-semibold text-white transition hover:bg-brand-700"
            href="/phonics"
          >
            开始学习 →
          </Link>
          <a
            className="rounded-full border border-gray-200 px-6 py-3 text-sm font-semibold text-gray-700 transition hover:border-brand-400 hover:text-brand-700"
            href="#tools"
          >
            查看工具
          </a>
        </div>

        {!isLoggedIn ? (
          <p className="mt-5 text-sm text-gray-500">
            已有账号？
            <Link className="ml-1 font-medium text-brand-700 hover:underline" href="/auth/sign-in">
              登录
            </Link>
          </p>
        ) : null}
      </div>
    </section>
  );
}
