"use client";

import Link from "next/link";
import { signIn } from "next-auth/react";
import { FormEvent, useState } from "react";

export default function SignUpPage() {
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);

  async function handleSignUp(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError("");
    setIsSubmitting(true);

    const response = await fetch("/api/auth/register", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ name, email, password })
    });

    if (!response.ok) {
      const body = (await response.json().catch(() => null)) as { error?: string } | null;
      setError(body?.error ?? "注册失败，请稍后重试");
      setIsSubmitting(false);
      return;
    }

    const result = await signIn("credentials", {
      email,
      password,
      callbackUrl: "/",
      redirect: false
    });

    setIsSubmitting(false);

    if (result?.error) {
      setError("账号已创建，请返回登录页登录");
      return;
    }

    window.location.href = result?.url ?? "/";
  }

  return (
    <main className="flex min-h-screen items-center justify-center bg-gray-50 px-6 py-10 text-gray-900">
      <section className="flex w-full max-w-[400px] flex-col items-center rounded-2xl bg-white px-10 pb-8 pt-10 shadow-[0_4px_6px_-1px_rgba(0,0,0,0.07),0_10px_24px_-4px_rgba(0,0,0,0.09)]">
        <Link href="/" className="mb-6 flex items-center gap-2.5 no-underline">
          <span className="flex h-[34px] w-[34px] items-center justify-center rounded-[9px] bg-green-600 text-base font-extrabold text-white shadow-[0_2px_8px_rgba(22,163,74,0.32)]">
            E
          </span>
          <span className="text-xl font-bold tracking-normal text-gray-900">
            Espo<span className="text-green-600">nal</span>
          </span>
        </Link>

        <h1 className="text-center text-xl font-medium text-gray-900">创建你的账号</h1>
        <p className="mb-7 mt-1.5 text-center text-[13px] text-gray-500">
          开始你的西语学习之旅
        </p>

        <form onSubmit={handleSignUp} className="flex w-full flex-col gap-3.5">
          <label className="flex flex-col gap-1.5 text-[13px] font-medium text-gray-700">
            昵称
            <input
              value={name}
              onChange={(event) => setName(event.target.value)}
              type="text"
              autoComplete="name"
              placeholder="你的名字"
              className="rounded-lg border border-gray-200 px-3.5 py-2.5 text-sm text-gray-900 outline-none transition placeholder:text-gray-400 focus:border-green-600 focus:ring-4 focus:ring-green-600/10"
            />
          </label>

          <label className="flex flex-col gap-1.5 text-[13px] font-medium text-gray-700">
            邮箱
            <input
              value={email}
              onChange={(event) => setEmail(event.target.value)}
              type="email"
              autoComplete="email"
              placeholder="your@email.com"
              className="rounded-lg border border-gray-200 px-3.5 py-2.5 text-sm text-gray-900 outline-none transition placeholder:text-gray-400 focus:border-green-600 focus:ring-4 focus:ring-green-600/10"
              required
            />
          </label>

          <label className="flex flex-col gap-1.5 text-[13px] font-medium text-gray-700">
            密码
            <input
              value={password}
              onChange={(event) => setPassword(event.target.value)}
              type="password"
              autoComplete="new-password"
              placeholder="至少 8 位"
              className="rounded-lg border border-gray-200 px-3.5 py-2.5 text-sm text-gray-900 outline-none transition placeholder:text-gray-400 focus:border-green-600 focus:ring-4 focus:ring-green-600/10"
              required
            />
            <span className="text-[11.5px] font-normal text-gray-400">
              建议包含字母和数字
            </span>
          </label>

          {error ? (
            <p role="alert" className="rounded-lg bg-red-50 px-3 py-2 text-sm text-red-600">
              {error}
            </p>
          ) : null}

          <button
            type="submit"
            disabled={isSubmitting}
            className="mt-0.5 rounded-[10px] bg-green-600 px-4 py-2.5 text-[15px] font-medium text-white transition hover:bg-green-700 hover:shadow-[0_2px_10px_rgba(22,163,74,0.28)] disabled:cursor-not-allowed disabled:bg-green-300"
          >
            {isSubmitting ? "创建中..." : "创建账号"}
          </button>
        </form>

        <p className="mt-5 text-center text-[12.5px] text-gray-400">
          已有账号？{" "}
          <Link href="/auth/sign-in" className="font-medium text-green-700 hover:underline">
            登录
          </Link>
        </p>

        <p className="mt-4 text-center text-[11.5px] leading-6 text-gray-400">
          注册即代表同意
          <Link href="/" className="mx-1 text-gray-500 underline underline-offset-2 hover:text-green-700">
            服务条款
          </Link>
          与
          <Link href="/" className="ml-1 text-gray-500 underline underline-offset-2 hover:text-green-700">
            隐私政策
          </Link>
        </p>
      </section>
    </main>
  );
}
