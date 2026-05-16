"use client";

import Link from "next/link";
import { signIn } from "next-auth/react";
import { FormEvent, useEffect, useState } from "react";

function safeCallbackUrl(raw: string | null): string {
  if (!raw) return "/";
  // Only allow same-origin internal paths to avoid open-redirect attacks
  if (raw.startsWith("/") && !raw.startsWith("//")) return raw;
  return "/";
}

export default function SignInPage() {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [callbackUrl, setCallbackUrl] = useState("/");

  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    if (params.get("error") === "CredentialsSignin") {
      setError("邮箱或密码错误");
    }
    setCallbackUrl(safeCallbackUrl(params.get("callbackUrl")));
  }, []);

  async function handleCredentialsSignIn(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError("");
    setIsSubmitting(true);

    const result = await signIn("credentials", {
      email,
      password,
      callbackUrl,
      redirect: false
    });

    setIsSubmitting(false);

    if (result?.error) {
      setError("邮箱或密码错误");
      return;
    }

    window.location.href = result?.url ?? callbackUrl;
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

        <h1 className="text-center text-xl font-medium text-gray-900">欢迎回来</h1>
        <p className="mb-7 mt-1.5 text-center text-[13px] text-gray-500">
          登录后保存生词、跟踪学习进度
        </p>

        <button
          type="button"
          onClick={() => signIn("google", { callbackUrl })}
          className="flex w-full items-center justify-center gap-2.5 rounded-[10px] border border-gray-200 bg-white px-5 py-2.5 text-[14.5px] font-medium text-gray-700 transition hover:border-gray-300 hover:bg-gray-50 hover:shadow-sm"
        >
          <svg className="h-5 w-5" viewBox="0 0 48 48" aria-hidden="true">
            <path
              fill="#EA4335"
              d="M24 9.5c3.54 0 6.71 1.22 9.21 3.6l6.85-6.85C35.9 2.38 30.47 0 24 0 14.62 0 6.51 5.38 2.56 13.22l7.98 6.19C12.43 13.72 17.74 9.5 24 9.5z"
            />
            <path
              fill="#4285F4"
              d="M46.98 24.55c0-1.57-.15-3.09-.38-4.55H24v9.02h12.94c-.58 2.96-2.26 5.48-4.78 7.18l7.73 6c4.51-4.18 7.09-10.36 7.09-17.65z"
            />
            <path
              fill="#FBBC05"
              d="M10.53 28.59c-.48-1.45-.76-2.99-.76-4.59s.27-3.14.76-4.59l-7.98-6.19C.92 16.46 0 20.12 0 24c0 3.88.92 7.54 2.56 10.78l7.97-6.19z"
            />
            <path
              fill="#34A853"
              d="M24 48c6.48 0 11.93-2.13 15.89-5.81l-7.73-6c-2.18 1.48-4.97 2.31-8.16 2.31-6.26 0-11.57-4.22-13.47-9.91l-7.98 6.19C6.51 42.62 14.62 48 24 48z"
            />
          </svg>
          使用 Google 账号登录
        </button>

        <div className="my-5 flex w-full items-center gap-3 text-xs text-gray-400">
          <span className="h-px flex-1 bg-gray-200" />
          <span>或</span>
          <span className="h-px flex-1 bg-gray-200" />
        </div>

        <form onSubmit={handleCredentialsSignIn} className="flex w-full flex-col gap-3.5">
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
            <span className="flex items-baseline justify-between">
              密码
              <Link href="/auth/sign-in" className="text-xs font-normal text-gray-400 hover:text-green-700">
                忘记密码？
              </Link>
            </span>
            <input
              value={password}
              onChange={(event) => setPassword(event.target.value)}
              type="password"
              autoComplete="current-password"
              placeholder="••••••••"
              className="rounded-lg border border-gray-200 px-3.5 py-2.5 text-sm text-gray-900 outline-none transition placeholder:text-gray-400 focus:border-green-600 focus:ring-4 focus:ring-green-600/10"
              required
            />
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
            {isSubmitting ? "登录中..." : "登录"}
          </button>
        </form>

        <p className="mt-5 text-center text-[12.5px] text-gray-400">
          没有账号？{" "}
          <Link href="/auth/sign-up" className="font-medium text-green-700 hover:underline">
            创建账号
          </Link>
        </p>

        <p className="mt-4 text-center text-[11.5px] leading-6 text-gray-400">
          登录即代表同意
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
