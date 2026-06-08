// Timestamp: 2026-06-08 22:08
"use client";

import { useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { CirclePlay as Youtube, FileText, Loader2, UploadCloud } from "lucide-react";
import { uploadImportedDocument } from "@/lib/import/upload-client";

type UrlImportResponse = {
  redirect?: string;
  error?: string;
};

type Status = {
  tone: "neutral" | "error";
  message: string;
} | null;

export function UnifiedImportClient() {
  const router = useRouter();
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [url, setUrl] = useState("");
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [urlSubmitting, setUrlSubmitting] = useState(false);
  const [fileSubmitting, setFileSubmitting] = useState(false);
  const [uploadProgress, setUploadProgress] = useState(0);
  const [status, setStatus] = useState<Status>(null);

  async function submitUrl() {
    if (!url.trim()) {
      setStatus({ tone: "error", message: "先粘贴一个 YouTube 链接。" });
      return;
    }

    setUrlSubmitting(true);
    setStatus(null);
    try {
      const response = await fetch("/api/import/url", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ url }),
      });
      const payload = (await response.json()) as UrlImportResponse;

      if (!response.ok || !payload.redirect) {
        setStatus({ tone: "error", message: "暂时只支持 YouTube 链接。" });
        return;
      }

      router.push(payload.redirect);
    } catch {
      setStatus({ tone: "error", message: "解析失败，请稍后再试。" });
    } finally {
      setUrlSubmitting(false);
    }
  }

  async function submitFile(file = selectedFile) {
    if (!file) {
      setStatus({ tone: "error", message: "先选择 EPUB 或 PDF 文件。" });
      return;
    }

    setFileSubmitting(true);
    setUploadProgress(0);
    setStatus(null);
    try {
      await uploadImportedDocument({
        file,
        onProgress: setUploadProgress,
      });
      router.push("/import/library");
    } catch {
      setStatus({ tone: "error", message: "上传失败，请确认文件格式与大小。" });
    } finally {
      setFileSubmitting(false);
    }
  }

  const busy = urlSubmitting || fileSubmitting;

  return (
    <section className="max-w-2xl mx-auto mt-10 bg-white border border-zinc-200 rounded-[32px] p-10 shadow-elevated">
      <div className="mx-auto max-w-xl text-center">
        <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-2xl bg-brand-50 text-brand-600">
          <UploadCloud className="h-6 w-6" aria-hidden />
        </div>
        <h1 className="mt-5 text-3xl font-bold tracking-normal text-zinc-950">统一导入引擎</h1>
        <p className="mt-3 text-sm leading-6 text-zinc-500">
          将视频、电子书、PDF 转化为可交互的双语学习材料。
        </p>
      </div>

      <div className="mt-8 grid gap-4 md:grid-cols-2">
        <div className="rounded-[24px] border border-zinc-200 bg-zinc-50/60 p-4">
          <div className="flex items-center gap-2 text-sm font-semibold text-zinc-900">
            <Youtube className="h-5 w-5 text-red-500" aria-hidden />
            视频链接
          </div>
          <textarea
            className="mt-4 min-h-[132px] w-full resize-none rounded-[20px] border border-zinc-200 bg-white px-4 py-3 text-[15px] leading-6 text-zinc-900 outline-none transition focus:border-brand-500 focus:ring-4 focus:ring-brand-500/10"
            placeholder="粘贴 YouTube 链接"
            value={url}
            onChange={(event) => setUrl(event.target.value)}
          />
          <button
            className="mt-3 inline-flex h-11 w-full items-center justify-center rounded-full bg-brand-500 text-sm font-semibold text-white shadow-md transition active:scale-[0.98] disabled:cursor-not-allowed disabled:opacity-60"
            disabled={urlSubmitting}
            onClick={submitUrl}
            type="button"
          >
            {urlSubmitting ? <Loader2 className="mr-2 h-4 w-4 animate-spin" aria-hidden /> : null}
            解析
          </button>
        </div>

        <div className="rounded-[24px] border border-dashed border-zinc-200 bg-zinc-50/60 p-4">
          <div className="flex items-center gap-2 text-sm font-semibold text-zinc-900">
            <FileText className="h-5 w-5 text-brand-500" aria-hidden />
            EPUB/PDF
          </div>
          <button
            className="mt-4 flex min-h-[132px] w-full flex-col items-center justify-center rounded-[22px] border border-zinc-200 bg-white px-4 py-6 text-center transition active:scale-[0.99] disabled:cursor-not-allowed disabled:opacity-60"
            disabled={fileSubmitting}
            onClick={() => fileInputRef.current?.click()}
            type="button"
          >
            <span className="flex h-12 w-12 items-center justify-center rounded-full bg-brand-50 text-brand-500">
              {fileSubmitting ? <Loader2 className="h-5 w-5 animate-spin" aria-hidden /> : <UploadCloud className="h-5 w-5" aria-hidden />}
            </span>
            <span className="mt-4 text-[15px] font-semibold text-zinc-800">
              {selectedFile ? selectedFile.name : "点击选择文件"}
            </span>
            <span className="mt-1 text-xs text-zinc-500">支持 EPUB、PDF (≤100MB)</span>
            {fileSubmitting ? (
              <span className="mt-3 h-1.5 w-full max-w-[180px] overflow-hidden rounded-full bg-zinc-100">
                <span className="block h-full rounded-full bg-brand-500 transition-all" style={{ width: `${uploadProgress}%` }} />
              </span>
            ) : null}
          </button>
          <input
            ref={fileInputRef}
            className="hidden"
            type="file"
            accept=".epub,.pdf,application/epub+zip,application/pdf"
            onChange={(event) => {
              const file = event.target.files?.[0] ?? null;
              setSelectedFile(file);
              if (file) void submitFile(file);
            }}
          />
        </div>
      </div>

      {status ? (
        <p className={`mt-4 rounded-2xl px-4 py-3 text-sm font-medium ${status.tone === "error" ? "bg-red-50 text-red-600" : "bg-zinc-50 text-zinc-600"}`}>
          {status.message}
        </p>
      ) : null}

      <div className="mt-6 grid gap-3 sm:grid-cols-2">
        {["本地音视频", "Bilibili 链接"].map((label) => (
          <div className="opacity-40 grayscale rounded-2xl border border-zinc-200 bg-zinc-50 px-4 py-3" key={label}>
            <div className="flex items-center justify-between gap-3">
              <span className="text-sm font-semibold text-zinc-700">{label}</span>
              <span className="rounded-md bg-zinc-100 px-2 py-0.5 text-[10px] font-semibold text-zinc-500">即将支持</span>
            </div>
          </div>
        ))}
      </div>
      <p className="mt-5 text-center text-xs text-zinc-400">
        上传后可在导入库继续阅读，缓存视频与本地阅读不重复消耗积分。
      </p>
    </section>
  );
}
