// Timestamp: 2026-06-11 10:15
"use client";

import { useCallback, useEffect, useMemo, useRef, useState, type CSSProperties, type KeyboardEvent, type MouseEvent, type TouchEvent } from "react";
import Link from "next/link";
import { BookOpen, ChevronLeft, ChevronRight, ExternalLink, List, Loader2, Type } from "lucide-react";
import {
  DEFAULT_IMPORT_READER_SETTINGS,
  IMPORT_READER_FONT_SIZES,
  IMPORT_READER_SETTINGS_STORAGE_KEY,
  clampImportReaderSettings,
  type ImportReaderSettings,
} from "@/lib/import/reader-settings";
import { EpubReader, type EpubChapter } from "./EpubReader";
import { PdfReader } from "./PdfReader";

type ImportReaderClientProps = {
  documentId: string;
  title: string;
  kind: "epub" | "pdf";
  unitCount: number;
  lastPosition: string;
};

const PAPER_CLASS: Record<ImportReaderSettings["paper"], string> = {
  white: "bg-[#fbfbfa] text-zinc-950",
  sepia: "bg-[#f7efdc] text-[#40392a]",
  night: "bg-[#15181b] text-[#d9ded9]",
};

function loadStoredReaderSettings() {
  if (typeof window === "undefined") return DEFAULT_IMPORT_READER_SETTINGS;
  try {
    const raw = window.localStorage.getItem(IMPORT_READER_SETTINGS_STORAGE_KEY);
    return clampImportReaderSettings(raw ? JSON.parse(raw) : null);
  } catch {
    return DEFAULT_IMPORT_READER_SETTINGS;
  }
}

export function ImportReaderClient({ documentId, title, kind, unitCount, lastPosition }: ImportReaderClientProps) {
  const touchStartRef = useRef<{ x: number; y: number } | null>(null);
  const [readerUrl, setReaderUrl] = useState("");
  const [loading, setLoading] = useState(kind === "pdf");
  const [error, setError] = useState("");
  const [readerChromeVisible, setReaderChromeVisible] = useState(true);
  const [settingsOpen, setSettingsOpen] = useState(false);
  const [tocOpen, setTocOpen] = useState(false);
  const [settings, setSettings] = useState<ImportReaderSettings>(DEFAULT_IMPORT_READER_SETTINGS);
  const [epubChapters, setEpubChapters] = useState<EpubChapter[]>([]);
  const [currentChapterPageCount, setCurrentChapterPageCount] = useState(1);
  const [pageNumber, setPageNumber] = useState(() => Math.max(1, Number(/^pdf:(\d+)$/.exec(lastPosition)?.[1] ?? 1)));
  const [epubChapterIndex, setEpubChapterIndex] = useState(() => Math.max(0, Number(/^epub:(\d+)(?::\d+)?$/.exec(lastPosition)?.[1] ?? 0)));
  const [epubPageInChapter, setEpubPageInChapter] = useState(() => Math.max(0, Number(/^epub:\d+:(\d+)$/.exec(lastPosition)?.[1] ?? 0)));
  const [pdfPageCount, setPdfPageCount] = useState(unitCount);
  const readerUnitCount = Math.max(1, currentChapterPageCount);
  const readerPosition = epubPageInChapter + 1;
  const pageLabel = `${readerPosition} / ${readerUnitCount}`;
  const displayPageLabel = kind === "pdf" ? `${pageNumber} / ${Math.max(1, pdfPageCount)}` : pageLabel;
  const paperClass = PAPER_CLASS[settings.paper];
  const readerStyle = useMemo(() => ({
    "--reader-font-size": `${settings.fontSize}px`,
    "--reader-line-height": settings.lineHeight === "compact" ? "1.58" : settings.lineHeight === "loose" ? "1.95" : "1.76",
    "--reader-font-family": settings.fontFamily === "serif" ? '"Literata","Noto Serif SC",serif' : '"Noto Sans SC","Plus Jakarta Sans",sans-serif',
  }) as CSSProperties, [settings]);

  useEffect(() => setSettings(loadStoredReaderSettings()), []);
  useEffect(() => {
    window.localStorage.setItem(IMPORT_READER_SETTINGS_STORAGE_KEY, JSON.stringify(settings));
  }, [settings]);

  const updateSettings = (patch: Partial<ImportReaderSettings>) => setSettings((current) => clampImportReaderSettings({ ...current, ...patch }));
  const showReaderChrome = useCallback(() => setReaderChromeVisible(true), []);
  const toggleReaderChrome = useCallback(() => {
    if (settingsOpen || tocOpen) return;
    setReaderChromeVisible((current) => !current);
  }, [settingsOpen, tocOpen]);

  useEffect(() => {
    if (kind !== "pdf") return;
    setLoading(true);
    setError("");
    setReaderUrl(`/api/import/${documentId}/file`);
    setLoading(false);
  }, [documentId, kind]);

  useEffect(() => {
    if (kind !== "pdf" || pdfPageCount <= 0) return;
    void fetch(`/api/import/${documentId}/progress`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ lastPosition: `pdf:${pageNumber}`, unitCount: pdfPageCount }),
    });
  }, [documentId, kind, pageNumber, pdfPageCount]);

  useEffect(() => {
    if (kind !== "epub" || currentChapterPageCount <= 0) return;
    void fetch(`/api/import/${documentId}/progress`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ lastPosition: `epub:${epubChapterIndex}:${epubPageInChapter}`, unitCount: epubChapters.length || unitCount }),
    });
  }, [currentChapterPageCount, documentId, epubChapterIndex, epubChapters.length, epubPageInChapter, kind, unitCount]);

  const canGoPrevious = kind === "pdf" ? pageNumber > 1 : epubChapterIndex > 0 || epubPageInChapter > 0;
  const canGoNext = kind === "pdf" ? pdfPageCount > 0 && pageNumber < pdfPageCount : epubPageInChapter < currentChapterPageCount - 1 || epubChapterIndex < epubChapters.length - 1;

  const goPreviousPage = useCallback((options: { revealChrome?: boolean } = {}) => {
    if (!canGoPrevious) return;
    if (options.revealChrome) showReaderChrome();
    if (kind === "pdf") setPageNumber((current) => Math.max(1, current - 1));
    else if (epubPageInChapter > 0) setEpubPageInChapter((current) => Math.max(0, current - 1));
    else setEpubChapterIndex((current) => Math.max(0, current - 1));
  }, [canGoPrevious, epubPageInChapter, kind, showReaderChrome]);

  const goNextPage = useCallback((options: { revealChrome?: boolean } = {}) => {
    if (!canGoNext) return;
    if (options.revealChrome) showReaderChrome();
    if (kind === "pdf") setPageNumber((current) => Math.min(pdfPageCount, current + 1));
    else if (epubPageInChapter < currentChapterPageCount - 1) setEpubPageInChapter((current) => Math.min(currentChapterPageCount - 1, current + 1));
    else {
      setEpubChapterIndex((current) => Math.min(epubChapters.length - 1, current + 1));
      setEpubPageInChapter(0);
    }
  }, [canGoNext, currentChapterPageCount, epubChapters.length, epubPageInChapter, kind, pdfPageCount, showReaderChrome]);

  const jumpToReaderPosition = (value: number) => {
    showReaderChrome();
    if (kind === "pdf") setPageNumber(Math.max(1, Math.min(pdfPageCount, value)));
    else setEpubPageInChapter(Math.max(0, Math.min(currentChapterPageCount - 1, value - 1)));
  };

  const jumpToChapter = (index: number) => {
    setEpubChapterIndex(index);
    setEpubPageInChapter(0);
    setTocOpen(false);
    showReaderChrome();
  };

  const handleReaderSurfaceClick = (event: MouseEvent<HTMLDivElement>) => {
    if (event.defaultPrevented) return;
    if (kind === "pdf") return toggleReaderChrome();
    const rect = event.currentTarget.getBoundingClientRect();
    const zoneRatio = (event.clientX - rect.left) / Math.max(1, rect.width);
    if (zoneRatio <= 0.25) return goPreviousPage();
    if (zoneRatio >= 0.75) return goNextPage();
    toggleReaderChrome();
  };

  const handleReaderKeyDown = (event: KeyboardEvent<HTMLDivElement>) => {
    if (event.key === "Enter" || event.key === " ") {
      event.preventDefault();
      toggleReaderChrome();
    }
    if (kind === "epub" && event.key === "ArrowLeft") goPreviousPage();
    if (kind === "epub" && event.key === "ArrowRight") goNextPage();
  };

  const handleReaderTouchStart = (event: TouchEvent<HTMLDivElement>) => {
    const touch = event.changedTouches[0];
    touchStartRef.current = touch ? { x: touch.clientX, y: touch.clientY } : null;
  };

  const handleReaderTouchEnd = (event: TouchEvent<HTMLDivElement>) => {
    const start = touchStartRef.current;
    const touch = event.changedTouches[0];
    touchStartRef.current = null;
    if (kind === "pdf") return;
    if (!start || !touch) return;
    const deltaX = touch.clientX - start.x;
    const deltaY = touch.clientY - start.y;
    if (Math.abs(deltaX) < 52 || Math.abs(deltaX) < Math.abs(deltaY) * 1.2) return;
    if (deltaX < 0) goNextPage();
    else goPreviousPage();
  };

  return (
    <div className={`relative h-[100dvh] w-screen overflow-hidden ${paperClass}`} data-testid="import-reader" style={readerStyle}>
      <div aria-label="显示或隐藏阅读控件" className="relative h-[100dvh] w-screen touch-pan-y overflow-hidden" onClick={handleReaderSurfaceClick} onKeyDown={handleReaderKeyDown} onTouchEnd={handleReaderTouchEnd} onTouchStart={handleReaderTouchStart} role="button" tabIndex={0}>
        {loading ? <div className="flex h-[100dvh] w-full items-center justify-center text-sm font-medium text-zinc-500"><Loader2 className="mr-2 h-4 w-4 animate-spin text-brand-500" aria-hidden />正在准备阅读器</div> : error ? <div className="mx-4 mt-[18vh] rounded-3xl bg-red-50 px-6 py-8 text-center text-sm font-medium text-red-600">{error}</div> : kind === "pdf" ? (
          <PdfReader documentId={documentId} pageNumber={pageNumber} readerUrl={readerUrl} setPageCount={setPdfPageCount} setPageNumber={setPageNumber} settings={settings} showReaderChrome={showReaderChrome} />
        ) : (
          <EpubReader documentId={documentId} title={title} chapterIndex={epubChapterIndex} pageInChapter={epubPageInChapter} setChapterCount={(count) => setCurrentChapterPageCount(count)} setChapterIndex={setEpubChapterIndex} setChapterList={setEpubChapters} setPageInChapter={setEpubPageInChapter} settings={settings} showReaderChrome={showReaderChrome} />
        )}
      </div>

      {!readerChromeVisible ? <><div className="pointer-events-none fixed left-4 top-3 z-40 max-w-[50%] truncate text-[10px] text-zinc-400" data-testid="import-reader-title-watermark">{title}</div><div className="pointer-events-none fixed bottom-3 right-4 z-40 text-[10px] text-zinc-400" data-testid="import-reader-page-watermark">{displayPageLabel}</div></> : null}

      <div className={`fixed inset-x-0 top-0 z-50 flex h-14 items-center gap-2 border-b border-black/5 bg-white/80 px-2 text-zinc-800 shadow-sm backdrop-blur-md transition-transform duration-300 ${readerChromeVisible ? "translate-y-0" : "-translate-y-full"} ${settings.paper === "night" ? "border-white/10 bg-zinc-950/80 text-zinc-100" : ""}`} data-testid="import-reader-chrome" onClick={(event) => event.stopPropagation()}>
        <Link aria-label="退出阅读器" className="flex h-10 w-10 items-center justify-center rounded-full active:bg-black/5" href="/import/library"><ChevronLeft className="h-6 w-6" aria-hidden /></Link>
        <span className="rounded bg-black/5 px-1.5 py-0.5 text-[10px] font-bold uppercase">{kind}</span>
        <h2 className="flex-1 truncate text-center text-sm font-bold">{title}</h2>
        {kind === "pdf" && readerUrl ? <a aria-label="新窗口打开原文" className="flex h-10 w-10 items-center justify-center rounded-full active:bg-black/5" href={readerUrl} rel="noreferrer" target="_blank"><ExternalLink className="h-4 w-4" aria-hidden /></a> : <span className="h-10 w-10" />}
      </div>

      {kind === "epub" ? <div className={`fixed inset-x-4 bottom-4 z-50 rounded-full border border-black/10 bg-white/85 pb-[env(safe-area-inset-bottom)] shadow-xl backdrop-blur-md transition-transform duration-300 ${readerChromeVisible ? "translate-y-0" : "translate-y-[140%]"} ${settings.paper === "night" ? "border-white/10 bg-zinc-950/85 text-zinc-100" : ""}`} data-testid="import-reader-bottom-chrome" onClick={(event) => event.stopPropagation()}>
        <div className="flex items-center gap-3 px-5 pt-4">
          <span className="w-8 text-right text-xs font-medium text-zinc-500">{readerPosition}</span>
          <input aria-label="跳转页码" className="flex-1 accent-brand-500" data-testid="import-reader-progress-slider" disabled={readerUnitCount <= 1} max={readerUnitCount} min={1} onChange={(event) => jumpToReaderPosition(Number(event.currentTarget.value))} type="range" value={Math.max(1, Math.min(readerPosition, readerUnitCount))} />
          <span className="w-8 text-xs font-medium text-zinc-500">{readerUnitCount}</span>
        </div>
        <div className="flex items-center justify-between px-6 py-2">
          <button aria-label="阅读设置" className="flex h-10 w-10 items-center justify-center rounded-full active:bg-black/5" onClick={() => setSettingsOpen(true)} type="button"><Type className="h-5 w-5" aria-hidden /></button>
          <button aria-label="目录" className="flex h-10 w-10 items-center justify-center rounded-full active:bg-black/5" onClick={() => setTocOpen(true)} type="button"><List className="h-5 w-5" aria-hidden /></button>
          <button aria-label="上一页" className="flex h-10 w-10 items-center justify-center rounded-full active:bg-black/5 disabled:opacity-30" disabled={!canGoPrevious} onClick={() => goPreviousPage({ revealChrome: true })} type="button"><ChevronLeft className="h-5 w-5" aria-hidden /></button>
          <span className="min-w-16 text-center text-xs font-bold">{pageLabel}</span>
          <button aria-label="下一页" className="flex h-10 w-10 items-center justify-center rounded-full bg-brand-500 text-white active:bg-brand-600 disabled:opacity-30" disabled={!canGoNext} onClick={() => goNextPage({ revealChrome: true })} type="button"><ChevronRight className="h-5 w-5" aria-hidden /></button>
        </div>
      </div> : null}

      {(settingsOpen || tocOpen) ? <button aria-label="关闭阅读器弹层" className="fixed inset-0 z-[58] bg-black/35 backdrop-blur-[1px]" onClick={() => { setSettingsOpen(false); setTocOpen(false); }} type="button" /> : null}
      <section className={`fixed inset-x-0 bottom-0 z-[60] rounded-t-3xl bg-white px-5 pb-[calc(env(safe-area-inset-bottom)+24px)] pt-3 text-zinc-950 shadow-2xl transition-transform duration-300 ${settingsOpen ? "translate-y-0" : "translate-y-full"}`} data-testid="import-reader-settings-sheet" onClick={(event) => event.stopPropagation()}>
        <div className="mx-auto mb-5 h-1 w-12 rounded-full bg-zinc-200" />
        <h3 className="mb-4 text-base font-bold">阅读设置</h3>
        <div className="mb-5"><p className="mb-2 text-xs font-semibold text-zinc-500">字号</p><div className="grid grid-cols-6 gap-2">{IMPORT_READER_FONT_SIZES.map((size) => <button className={`h-10 rounded-xl text-sm font-bold ${settings.fontSize === size ? "bg-brand-500 text-white" : "bg-zinc-100"}`} key={size} onClick={() => updateSettings({ fontSize: size })} type="button">{size}</button>)}</div></div>
        <div className="mb-5"><p className="mb-2 text-xs font-semibold text-zinc-500">字体</p><div className="grid grid-cols-2 gap-2"><button className={`h-11 rounded-xl text-sm font-semibold ${settings.fontFamily === "sans" ? "bg-brand-500 text-white" : "bg-zinc-100"}`} onClick={() => updateSettings({ fontFamily: "sans" })} type="button">无衬线</button><button className={`h-11 rounded-xl text-sm font-semibold ${settings.fontFamily === "serif" ? "bg-brand-500 text-white" : "bg-zinc-100"}`} onClick={() => updateSettings({ fontFamily: "serif" })} type="button">衬线</button></div></div>
        <div className="mb-5"><p className="mb-2 text-xs font-semibold text-zinc-500">行距</p><div className="grid grid-cols-3 gap-2">{(["compact", "normal", "loose"] as const).map((lineHeight) => <button className={`h-11 rounded-xl text-sm font-semibold ${settings.lineHeight === lineHeight ? "bg-brand-500 text-white" : "bg-zinc-100"}`} key={lineHeight} onClick={() => updateSettings({ lineHeight })} type="button">{lineHeight === "compact" ? "紧凑" : lineHeight === "normal" ? "标准" : "宽松"}</button>)}</div></div>
        <div className="mb-5"><p className="mb-2 text-xs font-semibold text-zinc-500">纸张</p><div className="grid grid-cols-3 gap-2">{(["white", "sepia", "night"] as const).map((paper) => <button className={`h-12 rounded-xl border text-sm font-semibold ${settings.paper === paper ? "border-brand-500" : "border-zinc-200"} ${paper === "white" ? "bg-white" : paper === "sepia" ? "bg-[#f7efdc]" : "bg-[#15181b] text-zinc-100"}`} key={paper} onClick={() => updateSettings({ paper })} type="button">{paper === "white" ? "纯白" : paper === "sepia" ? "米黄" : "夜间"}</button>)}</div></div>
        <div><p className="mb-2 text-xs font-semibold text-zinc-500">翻页</p><div className="grid grid-cols-2 gap-2"><button className={`h-11 rounded-xl text-sm font-semibold ${settings.pageTurn === "slide" ? "bg-brand-500 text-white" : "bg-zinc-100"}`} onClick={() => updateSettings({ pageTurn: "slide" })} type="button">滑动</button><button className={`h-11 rounded-xl text-sm font-semibold ${settings.pageTurn === "none" ? "bg-brand-500 text-white" : "bg-zinc-100"}`} onClick={() => updateSettings({ pageTurn: "none" })} type="button">无动画</button></div></div>
      </section>
      <section className={`fixed inset-x-0 bottom-0 z-[60] max-h-[70vh] overflow-y-auto rounded-t-3xl bg-white px-5 pb-[calc(env(safe-area-inset-bottom)+24px)] pt-3 text-zinc-950 shadow-2xl transition-transform duration-300 ${tocOpen ? "translate-y-0" : "translate-y-full"}`} data-testid="import-reader-toc-sheet" onClick={(event) => event.stopPropagation()}>
        <div className="mx-auto mb-5 h-1 w-12 rounded-full bg-zinc-200" />
        <h3 className="mb-4 flex items-center gap-2 text-base font-bold"><BookOpen className="h-4 w-4" aria-hidden />目录</h3>
        {kind === "epub" && epubChapters.length > 0 ? epubChapters.map((chapter, index) => <button className={`mb-2 flex w-full items-center justify-between rounded-2xl px-4 py-3 text-left text-sm ${index === epubChapterIndex ? "bg-brand-50 text-brand-700" : "bg-zinc-50"}`} key={chapter.href} onClick={() => jumpToChapter(index)} type="button"><span className="truncate">{chapter.title}</span><span className="text-xs text-zinc-400">{index + 1}</span></button>) : <p className="rounded-2xl bg-zinc-50 px-4 py-6 text-center text-sm text-zinc-500">PDF 可使用上方滑块跳页。</p>}
      </section>
    </div>
  );
}
