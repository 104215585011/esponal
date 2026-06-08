// Timestamp: 2026-06-08 22:20
"use client";

import { useCallback, useEffect, useState } from "react";
import { ExternalLink, Loader2, RefreshCw } from "lucide-react";

type ImportReaderClientProps = {
  documentId: string;
  title: string;
  kind: "epub" | "pdf";
  unitCount: number;
  lastPosition: string;
};

export function ImportReaderClient({
  documentId,
  title,
  kind,
  unitCount,
  lastPosition,
}: ImportReaderClientProps) {
  const [readerUrl, setReaderUrl] = useState("");
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  const loadReaderUrl = useCallback(async () => {
    setLoading(true);
    setError("");
    try {
      const response = await fetch(`/api/import/${documentId}/url`);
      const payload = (await response.json()) as { url?: string };
      if (!response.ok || !payload.url) {
        setError("无法读取导入文件，请稍后重试。");
        return;
      }
      setReaderUrl(payload.url);
    } catch {
      setError("无法读取导入文件，请稍后重试。");
    } finally {
      setLoading(false);
    }
  }, [documentId]);

  useEffect(() => {
    void loadReaderUrl();
  }, [loadReaderUrl]);

  useEffect(() => {
    if (!lastPosition && unitCount <= 0) return;
    void fetch(`/api/import/${documentId}/progress`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ lastPosition, unitCount }),
    });
  }, [documentId, lastPosition, unitCount]);

  return (
    <div className="relative rounded-[28px] border border-zinc-200/70 bg-white p-4 shadow-card md:p-6" data-testid="import-reader">
      <div className="mb-4 flex flex-wrap items-center justify-between gap-3 border-b border-zinc-100 pb-4">
        <div>
          <p className="text-xs font-semibold text-brand-600">
            {kind === "epub" ? "EPUB Reader" : "PDF Reader"}
          </p>
          <h2 className="text-base font-semibold text-zinc-900">{title}</h2>
        </div>
        {readerUrl ? (
          <a
            className="hidden min-h-[44px] items-center gap-2 rounded-full bg-brand-500 px-4 text-sm font-semibold text-white md:inline-flex"
            href={readerUrl}
            rel="noreferrer"
            target="_blank"
          >
            新窗口打开
            <ExternalLink className="h-4 w-4" aria-hidden />
          </a>
        ) : null}
      </div>

      {loading ? (
        <div className="flex min-h-[360px] items-center justify-center rounded-3xl bg-zinc-50 text-sm font-medium text-zinc-500">
          <Loader2 className="mr-2 h-4 w-4 animate-spin text-brand-500" aria-hidden />
          正在签发阅读链接
        </div>
      ) : error ? (
        <div className="rounded-3xl bg-red-50 p-6 text-sm font-medium text-red-600">{error}</div>
      ) : (
        <iframe
          className="h-[72vh] min-h-[520px] w-full rounded-3xl border border-zinc-200 bg-zinc-50"
          src={readerUrl}
          title={title}
        />
      )}

      <p className="mt-4 text-xs leading-5 text-zinc-400">
        当前版本先保留原件阅读体验；epub.js / pdf.js 文本层点词会接在这一层短签 URL 之上继续推进。
      </p>

      <div className="fixed inset-x-4 bottom-[calc(env(safe-area-inset-bottom)+12px)] z-40 flex items-center justify-between rounded-full border border-zinc-200/60 bg-white/90 px-2 py-2 shadow-[0_14px_40px_-22px_rgba(0,0,0,0.45)] backdrop-blur md:hidden">
        <button
          className="flex h-11 w-11 items-center justify-center rounded-full bg-zinc-100 text-zinc-700"
          onClick={loadReaderUrl}
          type="button"
        >
          <RefreshCw className="h-4 w-4" aria-hidden />
        </button>
        <span className="px-3 text-xs font-semibold text-zinc-600">
          {kind === "epub" ? "epub.js 待接入" : "pdf.js 待接入"}
        </span>
        {readerUrl ? (
          <a
            className="flex h-11 w-11 items-center justify-center rounded-full bg-brand-500 text-white"
            href={readerUrl}
            rel="noreferrer"
            target="_blank"
          >
            <ExternalLink className="h-4 w-4" aria-hidden />
          </a>
        ) : (
          <span className="h-11 w-11" />
        )}
      </div>
    </div>
  );
}
