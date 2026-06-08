// Timestamp: 2026-06-08 20:58
"use client";

import { useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { useRouter } from "next/navigation";
import { Loader2, UploadCloud, X } from "lucide-react";

type ImportSheetMode = "url" | "file";

type ImportSheetProps = {
  mode: ImportSheetMode | null;
  onClose: () => void;
};

type UrlImportResponse = {
  redirect?: string;
};

export function ImportSheet({ mode, onClose }: ImportSheetProps) {
  const router = useRouter();
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [mounted, setMounted] = useState(false);
  const [dragStartY, setDragStartY] = useState<number | null>(null);
  const [url, setUrl] = useState("");
  const [selectedFileName, setSelectedFileName] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => {
    setMounted(true);
  }, []);

  useEffect(() => {
    if (!mode) return;
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.body.style.overflow = previousOverflow;
    };
  }, [mode]);

  useEffect(() => {
    setError("");
    setSubmitting(false);
    setSelectedFileName("");
  }, [mode]);

  if (!mounted || !mode) {
    return null;
  }

  function closeSheet() {
    if (submitting) return;
    onClose();
  }

  function handlePointerDown(event: React.PointerEvent<HTMLDivElement>) {
    setDragStartY(event.clientY);
  }

  function handlePointerUp(event: React.PointerEvent<HTMLDivElement>) {
    if (dragStartY !== null && event.clientY - dragStartY > 72) {
      closeSheet();
    }
    setDragStartY(null);
  }

  async function pasteFromClipboard() {
    try {
      const text = await navigator.clipboard.readText();
      setUrl(text);
    } catch {
      setError("无法读取剪贴板，请手动粘贴。");
    }
  }

  async function submitUrl() {
    if (!url.trim()) {
      setError("先粘贴一个 YouTube 链接。");
      return;
    }

    setSubmitting(true);
    setError("");
    try {
      const response = await fetch("/api/import/url", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ url }),
      });
      const payload = (await response.json()) as UrlImportResponse;
      if (!response.ok || !payload.redirect) {
        setError("暂时只支持 YouTube 链接。");
        return;
      }
      router.push(payload.redirect);
      onClose();
    } catch {
      setError("解析失败，请稍后再试。");
    } finally {
      setSubmitting(false);
    }
  }

  async function submitFile(file: File) {
    setSubmitting(true);
    setError("");
    setSelectedFileName(file.name);
    try {
      const formData = new FormData();
      formData.append("file", file);
      const response = await fetch("/api/import/file", {
        method: "POST",
        body: formData,
      });
      if (!response.ok) {
        setError("上传失败，请确认文件格式与大小。");
        return;
      }
      router.push("/import/library");
      onClose();
    } catch {
      setError("上传失败，请稍后再试。");
    } finally {
      setSubmitting(false);
    }
  }

  return createPortal(
    <div className="fixed inset-0 z-50 flex flex-col justify-end" role="dialog" aria-modal="true">
      <button className="absolute inset-0 bg-black/45 backdrop-blur-sm" aria-label="关闭导入面板" onClick={closeSheet} type="button" />
      <div className="relative bg-white rounded-t-3xl pb-[safe-area] shadow-[0_-20px_60px_-24px_rgba(0,0,0,0.35)]">
        <div onPointerDown={handlePointerDown} onPointerUp={handlePointerUp} className="touch-none pb-1 pt-3">
          <div className="w-10 h-1.5 bg-zinc-200 rounded-full mt-3 mx-auto" />
        </div>
        <button
          aria-label="关闭"
          className="absolute right-4 top-4 flex h-9 w-9 items-center justify-center rounded-full border border-zinc-200 text-zinc-500"
          onClick={closeSheet}
          type="button"
        >
          <X className="h-4 w-4" aria-hidden />
        </button>

        <div className="px-5 pb-[calc(env(safe-area-inset-bottom)+24px)] pt-4">
          {mode === "url" ? (
            <>
              <h2 className="text-center text-lg font-bold text-zinc-900">导入外部视频</h2>
              <div className="mt-6 relative">
                <input
                  className="w-full bg-zinc-50 border border-zinc-200 rounded-[20px] pl-4 pr-12 py-5 text-[15px] focus:border-brand-500 focus:ring-4 focus:ring-brand-500/10 outline-none transition-all placeholder:text-zinc-400"
                  placeholder="粘贴 YouTube 链接"
                  value={url}
                  onChange={(event) => setUrl(event.target.value)}
                />
                <button
                  className="absolute right-3 top-1/2 -translate-y-1/2 rounded-md bg-brand-50 px-2 py-1 text-xs font-semibold text-brand-600"
                  onClick={pasteFromClipboard}
                  type="button"
                >
                  粘贴
                </button>
              </div>
              <button
                className="w-full mt-6 h-14 bg-brand-500 text-white rounded-full font-semibold shadow-md active:scale-[0.98] disabled:cursor-not-allowed disabled:opacity-60"
                disabled={submitting}
                onClick={submitUrl}
                type="button"
              >
                {submitting ? <Loader2 className="mr-2 inline h-4 w-4 animate-spin" aria-hidden /> : null}
                立即解析视频
              </button>
            </>
          ) : (
            <>
              <h2 className="text-center text-lg font-bold text-zinc-900">导入电子书或文档</h2>
              <button
                className="mt-6 border-2 border-dashed border-zinc-200 bg-zinc-50 rounded-[28px] flex flex-col items-center justify-center p-10 active:bg-zinc-100 transition-colors w-full disabled:cursor-not-allowed disabled:opacity-60"
                disabled={submitting}
                onClick={() => fileInputRef.current?.click()}
                type="button"
              >
                <span className="w-16 h-16 rounded-full bg-brand-50 flex items-center justify-center mb-4">
                  {submitting ? <Loader2 className="h-6 w-6 animate-spin text-brand-500" aria-hidden /> : <UploadCloud className="h-7 w-7 text-brand-500" aria-hidden />}
                </span>
                <span className="text-[15px] font-semibold text-zinc-800">{selectedFileName || "点击选择文件"}</span>
                <span className="text-[12px] text-zinc-500 mt-1">支持 EPUB、PDF (≤100MB)</span>
              </button>
              <input
                ref={fileInputRef}
                className="hidden"
                type="file"
                accept=".epub,.pdf,application/epub+zip,application/pdf"
                onChange={(event) => {
                  const file = event.target.files?.[0];
                  if (file) void submitFile(file);
                }}
              />
            </>
          )}

          {error ? <p className="mt-4 rounded-2xl bg-red-50 px-4 py-3 text-sm font-medium text-red-600">{error}</p> : null}
        </div>
      </div>
    </div>,
    document.body,
  );
}
