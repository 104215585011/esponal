// Timestamp: 2026-06-09 15:50
"use client";

import { useCallback, useEffect, useRef, useState, type KeyboardEvent, type MouseEvent, type TouchEvent } from "react";
import Link from "next/link";
import { ChevronLeft, ChevronRight, ExternalLink, List, Loader2, Sun, Type, ZoomIn, ZoomOut } from "lucide-react";
import { LookupCardStack } from "@/app/watch/LookupCard";

type ImportReaderClientProps = {
  documentId: string;
  title: string;
  kind: "epub" | "pdf";
  unitCount: number;
  lastPosition: string;
};

type EpubChapter = {
  index: number;
  title: string;
  href: string;
  text: string;
};

type PdfDocumentProxy = {
  numPages: number;
  getPage(pageNumber: number): Promise<PdfPageProxy>;
};

type PdfPageProxy = {
  getTextContent(): Promise<PdfTextContent>;
  getViewport(input: { scale: number }): PdfViewport;
  render(input: { canvasContext: CanvasRenderingContext2D; viewport: { width: number; height: number } }): { promise: Promise<void> };
};

type PdfJsModule = typeof import("pdfjs-dist/build/pdf.mjs");
type PdfViewport = {
  width: number;
  height: number;
  convertToViewportPoint?: (x: number, y: number) => [number, number];
};
type PdfTextContent = {
  items: Array<{
    str?: string;
    transform?: number[];
    width?: number;
    height?: number;
  }>;
};
type PdfTextLayerItem = {
  id: string;
  text: string;
  lineText: string;
  left: number;
  top: number;
  width: number;
  height: number;
};
type PdfLookupCard = {
  id: string;
  form: string;
  lookupKind: "word" | "phrase";
  phraseKind?: "collocation" | "phrase" | "idiom";
};
type PdfLookupStack = {
  anchorX: number;
  anchorY: number;
  lineText: string;
  cards: PdfLookupCard[];
};

const PDF_WORKER_SRC = "/api/import/pdf-worker";
const PDF_AUTO_MIN_ZOOM = 1;
const PDF_AUTO_MAX_ZOOM = 1;
const PDF_MIN_ZOOM = 1;
const PDF_MAX_ZOOM = 2.2;
const PDF_WORD_PATTERN = /[\p{L}ÁÉÍÓÚÜÑáéíóúüñ]+/gu;
let sharedPdfWorker: Worker | null = null;

function configurePdfJsWorker(pdfjs: PdfJsModule) {
  pdfjs.GlobalWorkerOptions.workerSrc = PDF_WORKER_SRC;

  if (typeof window === "undefined") return;

  try {
    sharedPdfWorker ??= new Worker(PDF_WORKER_SRC, { type: "module" });
    pdfjs.GlobalWorkerOptions.workerPort = sharedPdfWorker;
  } catch (workerError) {
    console.warn("Imported PDF workerPort setup failed; falling back to workerSrc", workerError);
  }

  if (!pdfjs.GlobalWorkerOptions.workerPort && pdfjs.GlobalWorkerOptions.workerSrc !== PDF_WORKER_SRC) {
    throw new Error("PDF worker configuration failed before loading document");
  }
}

function clampPdfZoom(value: number) {
  return Math.max(PDF_MIN_ZOOM, Math.min(PDF_MAX_ZOOM, Number(value.toFixed(2))));
}

function calculateAdaptivePdfZoom(frameWidth: number) {
  if (frameWidth <= 0) return PDF_AUTO_MIN_ZOOM;
  return Math.max(PDF_AUTO_MIN_ZOOM, Math.min(PDF_AUTO_MAX_ZOOM, 1));
}

function buildPdfTextLayerItems(textContent: PdfTextContent, viewport: PdfViewport, scale: number) {
  const items: PdfTextLayerItem[] = [];

  textContent.items.forEach((item, itemIndex) => {
    const lineText = typeof item.str === "string" ? item.str.trim() : "";
    const transform = Array.isArray(item.transform) ? item.transform : null;
    if (!lineText || !transform || transform.length < 6) return;

    const [x, y] = viewport.convertToViewportPoint
      ? viewport.convertToViewportPoint(transform[4], transform[5])
      : [transform[4] * scale, viewport.height - transform[5] * scale];
    const lineWidth = Math.max(18, (item.width ?? lineText.length * 5) * scale);
    const lineHeight = Math.max(18, Math.abs(item.height ?? transform[3] ?? 10) * scale);

    for (const match of lineText.matchAll(PDF_WORD_PATTERN)) {
      const text = match[0];
      const startRatio = (match.index ?? 0) / Math.max(1, lineText.length);
      const widthRatio = text.length / Math.max(1, lineText.length);
      items.push({
        id: `${itemIndex}-${match.index ?? 0}-${text}`,
        text,
        lineText,
        left: x + lineWidth * startRatio,
        top: y - lineHeight,
        width: Math.max(24, lineWidth * widthRatio),
        height: Math.max(24, lineHeight * 1.2),
      });
    }
  });

  return items;
}

export function ImportReaderClient({
  documentId,
  title,
  kind,
  unitCount,
  lastPosition,
}: ImportReaderClientProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const pdfFrameRef = useRef<HTMLDivElement>(null);
  const touchStartRef = useRef<{ x: number; y: number } | null>(null);
  const [readerUrl, setReaderUrl] = useState("");
  const [loading, setLoading] = useState(true);
  const [pdfLoading, setPdfLoading] = useState(false);
  const [epubLoading, setEpubLoading] = useState(false);
  const [error, setError] = useState("");
  const [epubChapters, setEpubChapters] = useState<EpubChapter[]>([]);
  const [pdfDocument, setPdfDocument] = useState<PdfDocumentProxy | null>(null);
  const [pdfZoom, setPdfZoom] = useState(1);
  const [pdfZoomMode, setPdfZoomMode] = useState<"auto" | "manual">("auto");
  const [pdfFrameWidth, setPdfFrameWidth] = useState(0);
  const [pdfFrameHeight, setPdfFrameHeight] = useState(0);
  const [canvasCssSize, setCanvasCssSize] = useState({ width: 0, height: 0 });
  const [pdfTextLayerItems, setPdfTextLayerItems] = useState<PdfTextLayerItem[]>([]);
  const [activePdfLookup, setActivePdfLookup] = useState<PdfLookupStack | null>(null);
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
  const effectivePdfZoom = pdfZoomMode === "auto" ? calculateAdaptivePdfZoom(pdfFrameWidth) : pdfZoom;
  const pdfPageFitsViewport = canvasCssSize.height > 0 && pdfFrameHeight > 0 && canvasCssSize.height < pdfFrameHeight - 24;
  const activeEpubChapter = epubChapters[epubChapterIndex] ?? null;
  const readerUnitCount = kind === "pdf" ? pageCount : epubChapters.length;
  const readerPosition = kind === "pdf" ? pageNumber : epubChapterIndex + 1;

  const showReaderChrome = useCallback(() => {
    setReaderChromeVisible(true);
  }, []);

  const toggleReaderChrome = useCallback(() => {
    setActivePdfLookup(null);
    setReaderChromeVisible((current) => !current);
  }, []);

  const loadReaderUrl = useCallback(async () => {
    setLoading(true);
    setError("");
    try {
      setReaderUrl(`/api/import/${documentId}/file`);
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
    if (kind !== "pdf") return;
    const frame = pdfFrameRef.current;
    if (!frame) return;

    const updateFrameSize = () => {
      setPdfFrameWidth(Math.min(760, frame.clientWidth || 0));
      setPdfFrameHeight(frame.clientHeight || 0);
    };
    updateFrameSize();

    const observer = new ResizeObserver(updateFrameSize);
    observer.observe(frame);
    return () => observer.disconnect();
  }, [error, kind, loading, pdfDocument]);

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
        configurePdfJsWorker(pdfjs);
        const task = pdfjs.getDocument({ data: bytes });
        const loaded = (await task.promise) as PdfDocumentProxy;
        if (cancelled) return;
        setPdfDocument(loaded);
        setActivePdfLookup(null);
        setPdfTextLayerItems([]);
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
    if (kind !== "epub") return;
    let cancelled = false;

    async function loadEpub() {
      setEpubLoading(true);
      setError("");
      try {
        const response = await fetch(`/api/import/${documentId}/epub`, {
          cache: "no-store",
          credentials: "same-origin",
        });
        if (!response.ok) {
          throw new Error(`EPUB fetch failed: ${response.status}`);
        }
        const payload = (await response.json()) as { chapters?: EpubChapter[] };
        const chapters = payload.chapters;
        if (!Array.isArray(chapters) || chapters.length === 0) {
          throw new Error("EPUB reader returned no chapters");
        }
        if (cancelled) return;
        setEpubChapters(chapters);
        setPageCount(chapters.length);
        setEpubChapterIndex((current) => Math.max(0, Math.min(current, chapters.length - 1)));
      } catch (loadError) {
        console.error("Imported EPUB load failed", loadError);
        if (!cancelled) {
          setError("EPUB 读取失败，请返回导入库后重试。");
        }
      } finally {
        if (!cancelled) {
          setEpubLoading(false);
        }
      }
    }

    void loadEpub();
    return () => {
      cancelled = true;
    };
  }, [documentId, kind]);

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
        const containerWidth = Math.min(760, pdfFrameWidth || canvas.parentElement?.clientWidth || 360);
        const baseViewport = page.getViewport({ scale: 1 });
        const cssScale = (containerWidth / baseViewport.width) * effectivePdfZoom;
        const pixelRatio = Math.min(window.devicePixelRatio || 1, 2);
        const cssViewport = page.getViewport({ scale: cssScale });
        const viewport = page.getViewport({ scale: cssScale * pixelRatio });
        const textContent = await page.getTextContent();
        if (cancelled) return;

        canvas.width = Math.floor(viewport.width);
        canvas.height = Math.floor(viewport.height);
        canvas.style.width = `${Math.floor(cssViewport.width)}px`;
        canvas.style.height = `${Math.floor(cssViewport.height)}px`;
        setCanvasCssSize({ width: Math.floor(cssViewport.width), height: Math.floor(cssViewport.height) });
        setPdfTextLayerItems(buildPdfTextLayerItems(textContent, cssViewport, cssScale));

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
  }, [effectivePdfZoom, kind, pageNumber, pdfDocument, pdfFrameWidth]);

  useEffect(() => {
    if (kind !== "pdf" || pageCount <= 0) return;
    void fetch(`/api/import/${documentId}/progress`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ lastPosition: `pdf:${pageNumber}`, unitCount: pageCount }),
    });
  }, [documentId, kind, pageCount, pageNumber]);

  useEffect(() => {
    if (kind !== "epub" || epubChapters.length <= 0) return;
    void fetch(`/api/import/${documentId}/progress`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ lastPosition: `epub:${epubChapterIndex}`, unitCount: epubChapters.length }),
    });
  }, [documentId, epubChapterIndex, epubChapters.length, kind]);

  useEffect(() => {
    if (!readerChromeVisible) return;
    const timer = window.setTimeout(() => setReaderChromeVisible(false), 3200);
    return () => window.clearTimeout(timer);
  }, [epubChapterIndex, pageNumber, readerChromeVisible]);

  const openPdfLookup = (event: MouseEvent<HTMLButtonElement>, item: PdfTextLayerItem) => {
    event.stopPropagation();
    showReaderChrome();
    const rect = event.currentTarget.getBoundingClientRect();
    setActivePdfLookup({
      anchorX: rect.left,
      anchorY: rect.bottom + 6,
      lineText: item.lineText,
      cards: [{ id: `word-${item.text}`, form: item.text, lookupKind: "word" }],
    });
  };

  const closePdfLookupCard = (id: string) => {
    setActivePdfLookup((previous) => {
      if (!previous) return null;
      const cards = previous.cards.filter((card) => card.id !== id);
      return cards.length > 0 ? { ...previous, cards } : null;
    });
  };

  const openNestedPdfWord = (form: string) => {
    setActivePdfLookup((previous) => {
      if (!previous || previous.cards.length >= 2) return previous;
      return { ...previous, cards: [...previous.cards, { id: `word-${form}`, form, lookupKind: "word" }] };
    });
  };

  const openNestedPdfPhrase = (form: string, phraseKind: "collocation" | "phrase" | "idiom") => {
    setActivePdfLookup((previous) => {
      if (!previous || previous.cards.length >= 2) return previous;
      return { ...previous, cards: [...previous.cards, { id: `phrase-${form}`, form, lookupKind: "phrase", phraseKind }] };
    });
  };

  const changePdfZoom = (delta: number) => {
    setActivePdfLookup(null);
    showReaderChrome();
    setPdfZoomMode("manual");
    setPdfZoom((current) => clampPdfZoom((pdfZoomMode === "auto" ? effectivePdfZoom : current) + delta));
  };

  const canGoPrevious = kind === "pdf" ? pageNumber > 1 : epubChapterIndex > 0;
  const canGoNext = kind === "pdf" ? pageCount > 0 && pageNumber < pageCount : epubChapters.length > 0 && epubChapterIndex < epubChapters.length - 1;

  const goPreviousPage = useCallback((options: { revealChrome?: boolean } = {}) => {
    if (!canGoPrevious) return;
    setActivePdfLookup(null);
    if (options.revealChrome) {
      showReaderChrome();
    }
    if (kind === "pdf") {
      setPageNumber((current) => Math.max(1, current - 1));
    } else {
      setEpubChapterIndex((current) => Math.max(0, current - 1));
    }
  }, [canGoPrevious, kind, showReaderChrome]);

  const goNextPage = useCallback((options: { revealChrome?: boolean } = {}) => {
    if (!canGoNext) return;
    setActivePdfLookup(null);
    if (options.revealChrome) {
      showReaderChrome();
    }
    if (kind === "pdf") {
      setPageNumber((current) => Math.min(pageCount, current + 1));
    } else {
      setEpubChapterIndex((current) => Math.min(epubChapters.length - 1, current + 1));
    }
  }, [canGoNext, epubChapters.length, kind, pageCount, showReaderChrome]);

  const jumpToReaderPosition = (value: number) => {
    setActivePdfLookup(null);
    showReaderChrome();
    if (kind === "pdf") {
      if (pageCount <= 0) return;
      setPageNumber(Math.max(1, Math.min(pageCount, value)));
      return;
    }
    if (epubChapters.length <= 0) return;
    setEpubChapterIndex(Math.max(0, Math.min(epubChapters.length - 1, value - 1)));
  };

  const handleReaderSurfaceClick = (event: MouseEvent<HTMLDivElement>) => {
    if (event.defaultPrevented) return;

    const rect = event.currentTarget.getBoundingClientRect();
    const zoneRatio = (event.clientX - rect.left) / Math.max(1, rect.width);

    if (zoneRatio <= 0.3) {
      goPreviousPage();
      return;
    }

    if (zoneRatio >= 0.7) {
      goNextPage();
      return;
    }

    toggleReaderChrome();
  };

  const handleReaderKeyDown = (event: KeyboardEvent<HTMLDivElement>) => {
    if (event.key === "Enter" || event.key === " ") {
      event.preventDefault();
      toggleReaderChrome();
    }
    if (event.key === "ArrowLeft") {
      goPreviousPage();
    }
    if (event.key === "ArrowRight") {
      goNextPage();
    }
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

    if (deltaX < 0) {
      goNextPage();
    } else {
      goPreviousPage();
    }
  };

  const pageLabel = kind === "pdf" && pageCount > 0
    ? `${pageNumber} / ${pageCount}`
    : kind === "epub" && epubChapters.length > 0
      ? `${epubChapterIndex + 1} / ${epubChapters.length}`
      : kind === "epub" ? "EPUB" : "PDF";

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
        {loading || (kind === "epub" && epubLoading) ? (
          <div className="flex h-[100dvh] w-full items-center justify-center text-sm font-medium text-zinc-500">
            <Loader2 className="mr-2 h-4 w-4 animate-spin text-brand-500" aria-hidden />
            {kind === "epub" ? "正在加载 EPUB" : "正在准备阅读器"}
          </div>
        ) : error ? (
          <div className="mx-4 mt-[18vh] rounded-3xl bg-red-50 px-6 py-8 text-center text-sm font-medium text-red-600">{error}</div>
        ) : kind === "pdf" ? (
          <>
            {pdfLoading ? (
              <div className="absolute inset-0 z-10 flex items-center justify-center bg-white/50 text-sm font-medium text-zinc-500 backdrop-blur-sm">
                <Loader2 className="mr-2 h-4 w-4 animate-spin text-brand-500" aria-hidden />
                正在渲染 PDF
              </div>
            ) : null}
            <div
              ref={pdfFrameRef}
              className={`flex h-[100dvh] w-full justify-center overflow-x-auto ${pdfPageFitsViewport ? "items-center" : "items-start"}`}
            >
              <div
                className="relative mx-auto"
                style={{
                  minWidth: canvasCssSize.width || undefined,
                  width: canvasCssSize.width || undefined,
                  height: canvasCssSize.height || undefined,
                }}
              >
                <canvas ref={canvasRef} className="bg-white" />
                <div
                  className="absolute left-0 top-0 z-[2]"
                  data-testid="import-pdf-text-layer"
                  style={{ width: canvasCssSize.width, height: canvasCssSize.height }}
                >
                  {pdfTextLayerItems.map((item) => (
                    <button
                      aria-label={`查询 ${item.text}`}
                      className="absolute rounded-sm bg-brand-500/0 text-transparent outline-none transition hover:bg-brand-500/15 focus:bg-brand-500/20"
                      data-testid="import-pdf-word"
                      key={item.id}
                      onClick={(event) => openPdfLookup(event, item)}
                      style={{
                        left: item.left,
                        top: item.top,
                        width: item.width,
                        height: item.height,
                      }}
                      type="button"
                    >
                      {item.text}
                    </button>
                  ))}
                </div>
              </div>
            </div>
          </>
        ) : (
          <article
            className="mx-auto min-h-[100dvh] w-full max-w-[760px] px-7 pb-24 pt-16 text-zinc-950"
            data-testid="import-epub-reader"
          >
            <div className="mb-8 flex items-center gap-2 text-[10px] font-bold uppercase tracking-[0.24em] text-brand-600">
              <span>EPUB</span>
              <span className="h-1 w-1 rounded-full bg-brand-500" aria-hidden />
              <span>{pageLabel}</span>
            </div>
            <h1 className="mb-8 text-2xl font-bold leading-tight text-zinc-950">
              {activeEpubChapter?.title ?? title}
            </h1>
            <div className="whitespace-pre-wrap text-xl leading-[2.05] tracking-normal text-zinc-900">
              {activeEpubChapter?.text ?? "这个 EPUB 没有可显示的正文。"}
            </div>
          </article>
        )}
      </div>

      {!readerChromeVisible ? (
        <>
          <div
            className="pointer-events-none fixed left-4 top-3 z-40 max-w-[50%] truncate text-[10px] text-zinc-400"
            data-testid="import-reader-title-watermark"
          >
            {title}
          </div>
          <div
            className="pointer-events-none fixed bottom-3 right-4 z-40 text-[10px] text-zinc-400"
            data-testid="import-reader-page-watermark"
          >
            {pageLabel}
          </div>
        </>
      ) : null}

      <div
        className={`fixed top-0 inset-x-0 h-14 bg-white/95 backdrop-blur-md border-b border-zinc-200/50 z-50 flex items-center px-2 shadow-sm transition-transform duration-300 ${readerChromeVisible ? "translate-y-0" : "-translate-y-full"}`}
        data-testid="import-reader-chrome"
        onClick={(event) => event.stopPropagation()}
      >
        <Link
          aria-label="退出阅读器"
          className="flex h-10 w-10 items-center justify-center rounded-full text-zinc-700 active:bg-zinc-100"
          href="/import/library"
        >
          <ChevronLeft className="h-6 w-6" aria-hidden />
        </Link>
        <span className="shrink-0 rounded bg-zinc-100 px-1.5 py-0.5 text-[10px] font-bold uppercase text-zinc-500">
          {kind === "epub" ? "EPUB" : "PDF"}
        </span>
        <h2 className="flex-1 truncate text-center text-sm font-bold text-zinc-900 px-4">{title}</h2>
        {kind === "pdf" && readerUrl ? (
          <a
            aria-label="新窗口打开原文"
            className="flex h-10 w-10 items-center justify-center rounded-full text-zinc-700 active:bg-zinc-100"
            href={readerUrl}
            rel="noreferrer"
            target="_blank"
          >
            <ExternalLink className="h-4 w-4" aria-hidden />
          </a>
        ) : (
          <span className="h-10 w-10" />
        )}
      </div>

      {activePdfLookup ? (
        <span
          className="fixed z-[70] w-[300px] max-w-[min(20rem,calc(100vw-2rem))]"
          onClick={(event) => event.stopPropagation()}
          style={{
            left: Math.max(8, Math.min(activePdfLookup.anchorX - 150, typeof window === "undefined" ? 8 : window.innerWidth - 328)),
            top: activePdfLookup.anchorY,
          }}
        >
          <LookupCardStack
            cards={activePdfLookup.cards.map((card) => ({
              ...card,
              onClose: () => closePdfLookupCard(card.id),
              onExampleWordClick: openNestedPdfWord,
              onRelatedPhraseClick: openNestedPdfPhrase,
              originalSentence: activePdfLookup.lineText,
              translatedSentence: "",
              source: {
                type: "import",
                documentId,
                pageNumber,
                sentence: activePdfLookup.lineText,
              },
            }))}
            onCloseCard={closePdfLookupCard}
          />
        </span>
      ) : null}

      <div
        className={`fixed bottom-0 inset-x-0 bg-white/95 backdrop-blur-md border-t border-zinc-200/50 z-50 pb-[env(safe-area-inset-bottom)] transition-transform duration-300 ${readerChromeVisible ? "translate-y-0" : "translate-y-full"}`}
        data-testid="import-reader-bottom-chrome"
        onClick={(event) => event.stopPropagation()}
      >
        <div className="flex items-center gap-4 px-6 py-4">
          <span className="w-8 text-right text-xs font-medium text-zinc-500">{readerPosition}</span>
          <input
            aria-label="跳转页码"
            className="flex-1 accent-brand-500"
            disabled={readerUnitCount <= 1}
            max={Math.max(1, readerUnitCount)}
            min={1}
            onChange={(event) => jumpToReaderPosition(Number(event.currentTarget.value))}
            type="range"
            value={Math.max(1, Math.min(readerPosition, Math.max(1, readerUnitCount)))}
          />
          <span className="w-8 text-xs font-medium text-zinc-500">{Math.max(1, readerUnitCount)}</span>
        </div>
        <div className="flex items-center justify-between px-8 pb-4 pt-2">
          <button
            aria-label={kind === "pdf" ? "上一页" : "上一章"}
            className="flex h-10 w-10 items-center justify-center rounded-full text-zinc-600 active:bg-zinc-100 disabled:opacity-30"
            disabled={!canGoPrevious}
            onClick={() => goPreviousPage({ revealChrome: true })}
            type="button"
          >
            <ChevronLeft className="h-5 w-5" aria-hidden />
          </button>
          <button aria-label="目录" className="flex h-10 w-10 items-center justify-center rounded-full text-zinc-600 active:bg-zinc-100" type="button">
            <List className="h-5 w-5" aria-hidden />
          </button>
          <button aria-label="缩小 PDF" className="flex h-10 w-10 items-center justify-center rounded-full text-zinc-600 active:bg-zinc-100 disabled:opacity-30" disabled={kind !== "pdf" || effectivePdfZoom <= PDF_MIN_ZOOM} onClick={() => changePdfZoom(-0.15)} type="button">
            <ZoomOut className="h-5 w-5" aria-hidden />
          </button>
          <span className="min-w-12 text-center text-xs font-semibold text-zinc-600">{Math.round(effectivePdfZoom * 100)}%</span>
          <button aria-label="放大 PDF" className="flex h-10 w-10 items-center justify-center rounded-full text-zinc-600 active:bg-zinc-100 disabled:opacity-30" disabled={kind !== "pdf" || effectivePdfZoom >= PDF_MAX_ZOOM} onClick={() => changePdfZoom(0.15)} type="button">
            <ZoomIn className="h-5 w-5" aria-hidden />
          </button>
          <button aria-label="护眼模式" className="flex h-10 w-10 items-center justify-center rounded-full text-zinc-600 active:bg-zinc-100" type="button">
            <Sun className="h-5 w-5" aria-hidden />
          </button>
          <button aria-label="排版设置" className="flex h-10 w-10 items-center justify-center rounded-full text-zinc-600 active:bg-zinc-100" type="button">
            <Type className="h-5 w-5" aria-hidden />
          </button>
          <button
            aria-label={kind === "pdf" ? "下一页" : "下一章"}
            className="flex h-10 w-10 items-center justify-center rounded-full bg-brand-500 text-white active:bg-brand-600 disabled:opacity-30"
            disabled={!canGoNext}
            onClick={() => goNextPage({ revealChrome: true })}
            type="button"
          >
            <ChevronRight className="h-5 w-5" aria-hidden />
          </button>
        </div>
      </div>
    </div>
  );
}
