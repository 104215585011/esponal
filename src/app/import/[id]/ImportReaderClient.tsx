// Timestamp: 2026-06-09 09:03
"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { ChevronLeft, ChevronRight, ExternalLink, Loader2, RefreshCw } from "lucide-react";

type ImportReaderClientProps = {
  documentId: string;
  title: string;
  kind: "epub" | "pdf";
  unitCount: number;
  lastPosition: string;
};

type PdfDocumentProxy = {
  numPages: number;
  getPage(pageNumber: number): Promise<PdfPageProxy>;
};

type PdfPageProxy = {
  getViewport(input: { scale: number }): { width: number; height: number };
  render(input: { canvasContext: CanvasRenderingContext2D; viewport: { width: number; height: number } }): { promise: Promise<void> };
};

export function ImportReaderClient({
  documentId,
  title,
  kind,
  unitCount,
  lastPosition,
}: ImportReaderClientProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [readerUrl, setReaderUrl] = useState("");
  const [loading, setLoading] = useState(true);
  const [pdfLoading, setPdfLoading] = useState(false);
  const [error, setError] = useState("");
  const [pdfDocument, setPdfDocument] = useState<PdfDocumentProxy | null>(null);
  const [pageNumber, setPageNumber] = useState(() => {
    const match = /^pdf:(\d+)$/.exec(lastPosition);
    return match ? Math.max(1, Number(match[1])) : 1;
  });
  const [pageCount, setPageCount] = useState(unitCount);

  const loadReaderUrl = useCallback(async () => {
    setLoading(true);
    setError("");
    try {
      if (kind === "pdf") {
        setReaderUrl(`/api/import/${documentId}/file`);
        return;
      }

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
  }, [documentId, kind]);

  useEffect(() => {
    void loadReaderUrl();
  }, [loadReaderUrl]);

  useEffect(() => {
    if (!readerUrl || kind !== "pdf") return;
    let cancelled = false;

    async function loadPdf() {
      setPdfLoading(true);
      setError("");
      try {
        const response = await fetch(readerUrl, { cache: "no-store", credentials: "same-origin" });
        const contentType = response.headers.get("content-type") ?? "";
        if (!response.ok) {
          throw new Error(`PDF fetch failed: ${response.status} ${contentType}`);
        }
        const buffer = await response.arrayBuffer();
        const bytes = new Uint8Array(buffer);
        if (bytes.byteLength === 0) {
          throw new Error("PDF fetch returned an empty body");
        }

        const pdfjs = await import("pdfjs-dist/build/pdf.mjs");
        pdfjs.GlobalWorkerOptions.workerSrc = "/api/import/pdf-worker";
        const task = pdfjs.getDocument({
          data: bytes,
        });
        const loaded = (await task.promise) as PdfDocumentProxy;
        if (cancelled) return;
        setPdfDocument(loaded);
        setPageCount(loaded.numPages);
        setPageNumber((current) => Math.min(Math.max(1, current), loaded.numPages));
      } catch (renderError) {
        console.error("Imported PDF load failed", renderError);
        if (!cancelled) {
          setError("PDF 渲染失败，请刷新阅读链接或在新窗口打开。");
        }
      } finally {
        if (!cancelled) {
          setPdfLoading(false);
        }
      }
    }

    void loadPdf();
    return () => {
      cancelled = true;
    };
  }, [kind, readerUrl]);

  useEffect(() => {
    if (!pdfDocument || kind !== "pdf") return;
    let cancelled = false;
    const activeDocument = pdfDocument;

    async function renderPage() {
      const canvas = canvasRef.current;
      const context = canvas?.getContext("2d");
      if (!canvas || !context) return;

      setPdfLoading(true);
      try {
        const page = await activeDocument.getPage(pageNumber);
        if (cancelled) return;
        const containerWidth = Math.min(760, canvas.parentElement?.clientWidth ?? 360);
        const baseViewport = page.getViewport({ scale: 1 });
        const cssScale = containerWidth / baseViewport.width;
        const pixelRatio = Math.min(window.devicePixelRatio || 1, 2);
        const viewport = page.getViewport({ scale: cssScale * pixelRatio });

        canvas.width = Math.floor(viewport.width);
        canvas.height = Math.floor(viewport.height);
        canvas.style.width = `${Math.floor(viewport.width / pixelRatio)}px`;
        canvas.style.height = `${Math.floor(viewport.height / pixelRatio)}px`;

        await page.render({ canvasContext: context, viewport }).promise;
      } catch (renderError) {
        console.error("Imported PDF page render failed", renderError);
        if (!cancelled) {
          setError("PDF 页面渲染失败，请刷新阅读链接或在新窗口打开。");
        }
      } finally {
        if (!cancelled) {
          setPdfLoading(false);
        }
      }
    }

    void renderPage();
    return () => {
      cancelled = true;
    };
  }, [kind, pageNumber, pdfDocument]);

  useEffect(() => {
    if (kind !== "pdf" || pageCount <= 0) return;
    void fetch(`/api/import/${documentId}/progress`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ lastPosition: `pdf:${pageNumber}`, unitCount: pageCount }),
    });
  }, [documentId, kind, pageCount, pageNumber]);

  const canGoPrevious = kind === "pdf" && pageNumber > 1;
  const canGoNext = kind === "pdf" && pageCount > 0 && pageNumber < pageCount;

  return (
    <div className="relative rounded-[28px] border border-zinc-200/70 bg-white p-4 shadow-card md:p-6" data-testid="import-reader">
      <div className="mb-4 flex flex-wrap items-center justify-between gap-3 border-b border-zinc-100 pb-4">
        <div>
          <p className="text-xs font-semibold text-brand-600">
            {kind === "epub" ? "EPUB Reader" : "PDF Reader"}
          </p>
          <h2 className="text-base font-semibold text-zinc-900">{title}</h2>
          {kind === "pdf" && pageCount > 0 ? (
            <p className="mt-1 text-xs font-medium text-zinc-500">
              第 {pageNumber} / {pageCount} 页
            </p>
          ) : null}
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
          正在准备阅读器
        </div>
      ) : error ? (
        <div className="rounded-3xl bg-red-50 p-6 text-sm font-medium text-red-600">{error}</div>
      ) : kind === "pdf" ? (
        <div className="relative flex min-h-[520px] justify-center rounded-3xl border border-zinc-200 bg-zinc-50 p-2">
          {pdfLoading ? (
            <div className="absolute inset-0 z-10 flex items-center justify-center rounded-3xl bg-white/70 text-sm font-medium text-zinc-500 backdrop-blur-sm">
              <Loader2 className="mr-2 h-4 w-4 animate-spin text-brand-500" aria-hidden />
              正在渲染 PDF
            </div>
          ) : null}
          <canvas ref={canvasRef} className="max-w-full rounded-2xl bg-white shadow-sm" />
        </div>
      ) : (
        <iframe
          className="h-[72vh] min-h-[520px] w-full rounded-3xl border border-zinc-200 bg-zinc-50"
          src={readerUrl}
          title={title}
        />
      )}

      <p className="mt-4 text-xs leading-5 text-zinc-400">
        PDF 使用 pdf.js 同源渲染；EPUB 原件阅读会继续接入 epub.js 文本层点词。
      </p>

      <div className="fixed inset-x-4 bottom-[calc(env(safe-area-inset-bottom)+12px)] z-40 flex items-center justify-between rounded-full border border-zinc-200/60 bg-white/90 px-2 py-2 shadow-[0_14px_40px_-22px_rgba(0,0,0,0.45)] backdrop-blur md:hidden">
        {kind === "pdf" ? (
          <button
            className="flex h-11 w-11 items-center justify-center rounded-full bg-zinc-100 text-zinc-700 disabled:opacity-35"
            disabled={!canGoPrevious}
            onClick={() => setPageNumber((current) => Math.max(1, current - 1))}
            type="button"
          >
            <ChevronLeft className="h-4 w-4" aria-hidden />
          </button>
        ) : (
          <button
            className="flex h-11 w-11 items-center justify-center rounded-full bg-zinc-100 text-zinc-700"
            onClick={loadReaderUrl}
            type="button"
          >
            <RefreshCw className="h-4 w-4" aria-hidden />
          </button>
        )}
        <span className="px-3 text-xs font-semibold text-zinc-600">
          {kind === "pdf" && pageCount > 0 ? `${pageNumber} / ${pageCount}` : kind === "epub" ? "epub.js 待接入" : "pdf.js"}
        </span>
        {kind === "pdf" ? (
          <button
            className="flex h-11 w-11 items-center justify-center rounded-full bg-brand-500 text-white disabled:opacity-35"
            disabled={!canGoNext}
            onClick={() => setPageNumber((current) => Math.min(pageCount, current + 1))}
            type="button"
          >
            <ChevronRight className="h-4 w-4" aria-hidden />
          </button>
        ) : readerUrl ? (
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
