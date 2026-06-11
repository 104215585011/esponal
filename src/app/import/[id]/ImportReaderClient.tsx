// Timestamp: 2026-06-11 09:30
"use client";

import { useCallback, useEffect, useRef, useState, type KeyboardEvent, type MouseEvent, type TouchEvent } from "react";
import Link from "next/link";
import { ChevronLeft, ChevronRight, ExternalLink, List, Loader2, Sun, Type } from "lucide-react";
import { EpubReader } from "./EpubReader";
import { PdfReader } from "./PdfReader";

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
  const touchStartRef = useRef<{ x: number; y: number } | null>(null);
  const [readerUrl, setReaderUrl] = useState("");
  const [loading, setLoading] = useState(kind === "pdf");
  const [error, setError] = useState("");
  const [readerChromeVisible, setReaderChromeVisible] = useState(false);
  const [pageNumber, setPageNumber] = useState(() => {
    const match = /^pdf:(\d+)$/.exec(lastPosition);
    return match ? Math.max(1, Number(match[1])) : 1;
  });
  const [epubChapterIndex, setEpubChapterIndex] = useState(() => {
    const match = /^epub:(\d+)$/.exec(lastPosition);
    return match ? Math.max(0, Number(match[1])) : 0;
  });
  const [pageCount, setPageCount] = useState(unitCount);
  const readerUnitCount = Math.max(1, pageCount);
  const readerPosition = kind === "pdf" ? pageNumber : epubChapterIndex + 1;
  const pageLabel = pageCount > 0 ? `${readerPosition} / ${pageCount}` : kind === "epub" ? "EPUB" : "PDF";

  const showReaderChrome = useCallback(() => {
    setReaderChromeVisible(true);
  }, []);

  const toggleReaderChrome = useCallback(() => {
    setReaderChromeVisible((current) => !current);
  }, []);

  const loadReaderUrl = useCallback(async () => {
    if (kind !== "pdf") return;
    setLoading(true);
    setError("");
    try {
      setReaderUrl(`/api/import/${documentId}/file`);
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
    if (kind !== "pdf" || pageCount <= 0) return;
    void fetch(`/api/import/${documentId}/progress`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ lastPosition: `pdf:${pageNumber}`, unitCount: pageCount }),
    });
  }, [documentId, kind, pageCount, pageNumber]);

  useEffect(() => {
    if (kind !== "epub" || pageCount <= 0) return;
    void fetch(`/api/import/${documentId}/progress`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ lastPosition: `epub:${epubChapterIndex}`, unitCount: pageCount }),
    });
  }, [documentId, epubChapterIndex, kind, pageCount]);

  useEffect(() => {
    if (!readerChromeVisible) return;
    const timer = window.setTimeout(() => setReaderChromeVisible(false), 3200);
    return () => window.clearTimeout(timer);
  }, [epubChapterIndex, pageNumber, readerChromeVisible]);

  const canGoPrevious = kind === "pdf" ? pageNumber > 1 : epubChapterIndex > 0;
  const canGoNext = kind === "pdf" ? pageCount > 0 && pageNumber < pageCount : pageCount > 0 && epubChapterIndex < pageCount - 1;

  const goPreviousPage = useCallback((options: { revealChrome?: boolean } = {}) => {
    if (!canGoPrevious) return;
    if (options.revealChrome) showReaderChrome();
    if (kind === "pdf") {
      setPageNumber((current) => Math.max(1, current - 1));
    } else {
      setEpubChapterIndex((current) => Math.max(0, current - 1));
    }
  }, [canGoPrevious, kind, showReaderChrome]);

  const goNextPage = useCallback((options: { revealChrome?: boolean } = {}) => {
    if (!canGoNext) return;
    if (options.revealChrome) showReaderChrome();
    if (kind === "pdf") {
      setPageNumber((current) => Math.min(pageCount, current + 1));
    } else {
      setEpubChapterIndex((current) => Math.min(pageCount - 1, current + 1));
    }
  }, [canGoNext, kind, pageCount, showReaderChrome]);

  const jumpToReaderPosition = (value: number) => {
    showReaderChrome();
    if (kind === "pdf") {
      setPageNumber(Math.max(1, Math.min(pageCount, value)));
      return;
    }
    setEpubChapterIndex(Math.max(0, Math.min(pageCount - 1, value - 1)));
  };

  const handleReaderSurfaceClick = (event: MouseEvent<HTMLDivElement>) => {
    if (event.defaultPrevented) return;
    const rect = event.currentTarget.getBoundingClientRect();
    const zoneRatio = (event.clientX - rect.left) / Math.max(1, rect.width);
    if (zoneRatio <= 0.3) return goPreviousPage();
    if (zoneRatio >= 0.7) return goNextPage();
    toggleReaderChrome();
  };

  const handleReaderKeyDown = (event: KeyboardEvent<HTMLDivElement>) => {
    if (event.key === "Enter" || event.key === " ") {
      event.preventDefault();
      toggleReaderChrome();
    }
    if (event.key === "ArrowLeft") goPreviousPage();
    if (event.key === "ArrowRight") goNextPage();
  };

  const handleReaderTouchStart = (event: TouchEvent<HTMLDivElement>) => {
    const touch = event.changedTouches[0];
    touchStartRef.current = touch ? { x: touch.clientX, y: touch.clientY } : null;
  };

  const handleReaderTouchEnd = (event: TouchEvent<HTMLDivElement>) => {
    const start = touchStartRef.current;
    const touch = event.changedTouches[0];
    touchStartRef.current = null;
    if (!start || !touch) return;
    const deltaX = touch.clientX - start.x;
    const deltaY = touch.clientY - start.y;
    if (Math.abs(deltaX) < 52 || Math.abs(deltaX) < Math.abs(deltaY) * 1.2) return;
    if (deltaX < 0) goNextPage();
    else goPreviousPage();
  };

  return (
    <div className="relative h-[100dvh] w-screen overflow-hidden bg-[#f9f9f9] dark:bg-[#121212]" data-testid="import-reader">
      <div
        aria-label="显示或隐藏阅读控件"
        className="relative flex h-[100dvh] w-screen touch-pan-y items-start justify-center overflow-auto"
        onClick={handleReaderSurfaceClick}
        onKeyDown={handleReaderKeyDown}
        onTouchEnd={handleReaderTouchEnd}
        onTouchStart={handleReaderTouchStart}
        role="button"
        tabIndex={0}
      >
        {loading ? (
          <div className="flex h-[100dvh] w-full items-center justify-center text-sm font-medium text-zinc-500">
            <Loader2 className="mr-2 h-4 w-4 animate-spin text-brand-500" aria-hidden />
            正在准备阅读器
          </div>
        ) : error ? (
          <div className="mx-4 mt-[18vh] rounded-3xl bg-red-50 px-6 py-8 text-center text-sm font-medium text-red-600">{error}</div>
        ) : kind === "pdf" ? (
          <PdfReader documentId={documentId} pageNumber={pageNumber} readerUrl={readerUrl} setPageCount={setPageCount} setPageNumber={setPageNumber} showReaderChrome={showReaderChrome} />
        ) : (
          <EpubReader documentId={documentId} title={title} chapterIndex={epubChapterIndex} setChapterCount={setPageCount} setChapterIndex={setEpubChapterIndex} showReaderChrome={showReaderChrome} />
        )}
      </div>

      {!readerChromeVisible ? (
        <>
          <div className="pointer-events-none fixed left-4 top-3 z-40 max-w-[50%] truncate text-[10px] text-zinc-400" data-testid="import-reader-title-watermark">{title}</div>
          <div className="pointer-events-none fixed bottom-3 right-4 z-40 text-[10px] text-zinc-400" data-testid="import-reader-page-watermark">{pageLabel}</div>
        </>
      ) : null}

      <div className={`fixed top-0 inset-x-0 h-14 bg-white/95 backdrop-blur-md border-b border-zinc-200/50 z-50 flex items-center px-2 shadow-sm transition-transform duration-300 ${readerChromeVisible ? "translate-y-0" : "-translate-y-full"}`} data-testid="import-reader-chrome" onClick={(event) => event.stopPropagation()}>
        <Link aria-label="退出阅读器" className="flex h-10 w-10 items-center justify-center rounded-full text-zinc-700 active:bg-zinc-100" href="/import/library"><ChevronLeft className="h-6 w-6" aria-hidden /></Link>
        <span className="shrink-0 rounded bg-zinc-100 px-1.5 py-0.5 text-[10px] font-bold uppercase text-zinc-500">{kind === "epub" ? "EPUB" : "PDF"}</span>
        <h2 className="flex-1 truncate text-center text-sm font-bold text-zinc-900 px-4">{title}</h2>
        {kind === "pdf" && readerUrl ? <a aria-label="新窗口打开原文" className="flex h-10 w-10 items-center justify-center rounded-full text-zinc-700 active:bg-zinc-100" href={readerUrl} rel="noreferrer" target="_blank"><ExternalLink className="h-4 w-4" aria-hidden /></a> : <span className="h-10 w-10" />}
      </div>

      <div className={`fixed bottom-0 inset-x-0 bg-white/95 backdrop-blur-md border-t border-zinc-200/50 z-50 pb-[env(safe-area-inset-bottom)] transition-transform duration-300 ${readerChromeVisible ? "translate-y-0" : "translate-y-full"}`} data-testid="import-reader-bottom-chrome" onClick={(event) => event.stopPropagation()}>
        <div className="flex items-center gap-4 px-6 py-4">
          <span className="w-8 text-right text-xs font-medium text-zinc-500">{readerPosition}</span>
          <input aria-label="跳转页码" className="flex-1 accent-brand-500" disabled={readerUnitCount <= 1} max={readerUnitCount} min={1} onChange={(event) => jumpToReaderPosition(Number(event.currentTarget.value))} type="range" value={Math.max(1, Math.min(readerPosition, readerUnitCount))} />
          <span className="w-8 text-xs font-medium text-zinc-500">{readerUnitCount}</span>
        </div>
        <div className="flex items-center justify-between px-8 pb-4 pt-2">
          <button aria-label={kind === "pdf" ? "上一页" : "上一章"} className="flex h-10 w-10 items-center justify-center rounded-full text-zinc-600 active:bg-zinc-100 disabled:opacity-30" disabled={!canGoPrevious} onClick={() => goPreviousPage({ revealChrome: true })} type="button"><ChevronLeft className="h-5 w-5" aria-hidden /></button>
          <button aria-label="目录" className="flex h-10 w-10 items-center justify-center rounded-full text-zinc-600 active:bg-zinc-100" type="button"><List className="h-5 w-5" aria-hidden /></button>
          <button aria-label="护眼模式" className="flex h-10 w-10 items-center justify-center rounded-full text-zinc-600 active:bg-zinc-100" type="button"><Sun className="h-5 w-5" aria-hidden /></button>
          <button aria-label="排版设置" className="flex h-10 w-10 items-center justify-center rounded-full text-zinc-600 active:bg-zinc-100" type="button"><Type className="h-5 w-5" aria-hidden /></button>
          <button aria-label={kind === "pdf" ? "下一页" : "下一章"} className="flex h-10 w-10 items-center justify-center rounded-full bg-brand-500 text-white active:bg-brand-600 disabled:opacity-30" disabled={!canGoNext} onClick={() => goNextPage({ revealChrome: true })} type="button"><ChevronRight className="h-5 w-5" aria-hidden /></button>
        </div>
      </div>
    </div>
  );
}
