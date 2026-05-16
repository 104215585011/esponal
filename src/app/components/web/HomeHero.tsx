"use client";

import Link from "next/link";

export function HomeHero() {
  return (
    <section className="mb-10 overflow-hidden rounded-hero bg-gradient-to-br from-brand-50 to-white px-6 py-8 shadow-card sm:px-10 sm:py-12">
      <div className="max-w-3xl">
        <p className="text-sm font-semibold uppercase tracking-[0.18em] text-brand-700">
          Esponal
        </p>
        <h1 className="mt-4 text-3xl font-bold tracking-tight text-gray-950 lg:text-4xl">
          用真实的西语视频，慢慢学会一门语言
        </h1>
        <p className="mt-4 max-w-[560px] text-base leading-7 text-gray-600">
          不用打卡、不刷题。看 YouTube、点词、查义项，下次自动记得。你需要的只是好奇心。
        </p>
        <div className="mt-7 flex flex-wrap items-center gap-3">
          <Link
            className="rounded-card bg-brand-600 px-6 py-3 text-sm font-semibold text-white transition hover:bg-brand-700"
            href="/auth/sign-up"
          >
            立即注册 →
          </Link>
          <button
            className="rounded-card border border-gray-200 px-6 py-3 text-sm font-semibold text-gray-700 transition hover:border-brand-400 hover:text-brand-700"
            onClick={() => {
              document.getElementById("video-sections")?.scrollIntoView({
                behavior: "smooth",
                block: "start"
              });
            }}
            type="button"
          >
            浏览视频
          </button>
          <Link
            className="rounded-card border border-gray-200 px-6 py-3 text-sm font-semibold text-gray-700 transition hover:border-brand-400 hover:text-brand-700"
            href="/extension"
          >
            安装 Chrome 插件
          </Link>
        </div>
        <p className="mt-5 text-sm text-gray-500">
          已有账号？{" "}
          <Link className="font-medium text-brand-700 hover:underline" href="/auth/sign-in">
            登录
          </Link>
        </p>
      </div>
    </section>
  );
}
