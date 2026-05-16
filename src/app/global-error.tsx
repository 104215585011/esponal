"use client";

import * as Sentry from "@sentry/nextjs";
import { useEffect } from "react";

export default function GlobalError({
  error,
  reset
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    Sentry.captureException(error);
  }, [error]);

  return (
    <html lang="zh-CN">
      <body>
        <main className="flex min-h-screen flex-col items-center justify-center bg-app px-6 py-10 text-center text-gray-900">
          <h1 className="text-2xl font-semibold">出了点小问题</h1>
          <p className="mt-2 max-w-md text-sm text-gray-500">
            页面渲染失败。我们已经记录这个错误，你可以刷新一下重试。
          </p>
          <button
            type="button"
            onClick={() => reset()}
            className="mt-6 rounded-card bg-brand-500 px-5 py-2 text-sm font-medium text-white transition hover:bg-brand-600"
          >
            重试
          </button>
        </main>
      </body>
    </html>
  );
}
