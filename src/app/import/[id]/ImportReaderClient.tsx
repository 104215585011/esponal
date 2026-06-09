// Timestamp: 2026-06-09 10:58
"use client";

import { useCallback, useEffect, useRef, useState, type MouseEvent } from "react";
import { ChevronLeft, ChevronRight, ExternalLink, Loader2, RefreshCw, ZoomIn, ZoomOut } from "lucide-react";
import { LookupCardStack } from "@/app/watch/LookupCard";

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
const PDF_AUTO_MAX_ZOOM = 1.08;
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
  const widthBoost = frameWidth >= 720 ? 0.08 : frameWidth >= 520 ? 0.05 : frameWidth >= 430 ? 0.03 : 0;
  return Math.max(PDF_AUTO_MIN_ZOOM, Math.min(PDF_AUTO_MAX_ZOOM, Number((PDF_AUTO_MIN_ZOOM + widthBoost).toFixed(2))));
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
  const [readerUrl, setReaderUrl] = useState("");
  const [loading, setLoading] = useState(true);
  const [pdfLoading, setPdfLoading] = useState(false);
  const [error, setError] = useState("");
  const [pdfDocument, setPdfDocument] = useState<PdfDocumentProxy | null>(null);
  const [pdfZoom, setPdfZoom] = useState(1);
  const [pdfZoomMode, setPdfZoomMode] = useState<"auto" | "manual">("auto");
  const [pdfFrameWidth, setPdfFrameWidth] = useState(0);
  const [canvasCssSize, setCanvasCssSize] = useState({ width: 0, height: 0 });
  const [pdfTextLayerItems, setPdfTextLayerItems] = useState<PdfTextLayerItem[]>([]);
  const [activePdfLookup, setActivePdfLookup] = useState<PdfLookupStack | null>(null);
  const [pageNumber, setPageNumber] = useState(() => {
    const match = /^pdf:(\d+)$/.exec(lastPosition);
    return match ? Math.max(1, Number(match[1])) : 1;
  });
  const [pageCount, setPageCount] = useState(unitCount);
  const effectivePdfZoom = pdfZoomMode === "auto" ? calculateAdaptivePdfZoom(pdfFrameWidth) : pdfZoom;

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
    if (kind !== "pdf") return;
    const frame = pdfFrameRef.current;
    if (!frame) return;

    const updateFrameWidth = () => {
      setPdfFrameWidth(Math.min(760, frame.clientWidth || 0));
    };
    updateFrameWidth();

    const observer = new ResizeObserver(updateFrameWidth);
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
        const task = pdfjs.getDocument({
          data: bytes,
        });
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

  const openPdfLookup = (event: MouseEvent<HTMLButtonElement>, item: PdfTextLayerItem) => {
    const rect = event.currentTarget.getBoundingClientRect();
    setActivePdfLookup({
      anchorX: rect.left,
      anchorY: rect.bottom + 6,
      lineText: item.lineText,
      cards: [
        {
          id: `word-${item.text}`,
          form: item.text,
          lookupKind: "word",
        },
      ],
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
      return {
        ...previous,
        cards: [...previous.cards, { id: `word-${form}`, form, lookupKind: "word" }],
      };
    });
  };

  const openNestedPdfPhrase = (form: string, phraseKind: "collocation" | "phrase" | "idiom") => {
    setActivePdfLookup((previous) => {
      if (!previous || previous.cards.length >= 2) return previous;
      return {
        ...previous,
        cards: [...previous.cards, { id: `phrase-${form}`, form, lookupKind: "phrase", phraseKind }],
      };
    });
  };

  const changePdfZoom = (delta: number) => {
    setActivePdfLookup(null);
    setPdfZoomMode("manual");
    setPdfZoom((current) => clampPdfZoom((pdfZoomMode === "auto" ? effectivePdfZoom : current) + delta));
  };

  const canGoPrevious = kind === "pdf" && pageNumber > 1;
  const canGoNext = kind === "pdf" && pageCount > 0 && pageNumber < pageCount;

  return (
    <div className="relative flex min-h-[calc(100vh-80px)] w-full flex-col" data-testid="import-reader">
      <div className="mb-4 flex items-center justify-between gap-3">
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2">
            <span className="shrink-0 rounded bg-zinc-100 px-1.5 py-0.5 text-[10px] font-bold uppercase text-zinc-500">
              {kind === "epub" ? "EPUB" : "PDF"}
            </span>
            <h2 className="truncate text-sm font-semibold text-zinc-900">{title}</h2>
          </div>
        </div>
        <div className="flex items-center gap-2">
          {kind === "pdf" ? (
            <div className="hidden items-center gap-1 rounded-full bg-zinc-100 p-1 md:flex">
              <button
                aria-label="缩小 PDF"
                className="flex h-9 w-9 items-center justify-center rounded-full text-zinc-600 disabled:opacity-40"
                disabled={effectivePdfZoom <= PDF_MIN_ZOOM}
                onClick={() => changePdfZoom(-0.15)}
                type="button"
              >
                <ZoomOut className="h-4 w-4" aria-hidden />
              </button>
              <span className="min-w-12 text-center text-xs font-semibold text-zinc-600">{Math.round(effectivePdfZoom * 100)}%</span>
              <button
                aria-label="放大 PDF"
                className="flex h-9 w-9 items-center justify-center rounded-full text-zinc-600 disabled:opacity-40"
                disabled={effectivePdfZoom >= PDF_MAX_ZOOM}
                onClick={() => changePdfZoom(0.15)}
                type="button"
              >
                <ZoomIn className="h-4 w-4" aria-hidden />
              </button>
            </div>
          ) : null}
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
      </div>

      {loading ? (
        <div className="flex min-h-[calc(100dvh-156px)] flex-1 items-center justify-center rounded-2xl bg-zinc-100/50 text-sm font-medium text-zinc-500">
          <Loader2 className="mr-2 h-4 w-4 animate-spin text-brand-500" aria-hidden />
          正在准备阅读器
        </div>
      ) : error ? (
        <div className="flex min-h-[calc(100dvh-156px)] flex-1 items-center justify-center rounded-2xl bg-red-50 p-6 text-sm font-medium text-red-600">{error}</div>
      ) : kind === "pdf" ? (
        <div className="relative flex min-h-[calc(100dvh-156px)] flex-1 justify-center overflow-hidden rounded-2xl bg-zinc-100/50">
          {pdfLoading ? (
            <div className="absolute inset-0 z-10 flex items-center justify-center rounded-2xl bg-white/70 text-sm font-medium text-zinc-500 backdrop-blur-sm">
              <Loader2 className="mr-2 h-4 w-4 animate-spin text-brand-500" aria-hidden />
              正在渲染 PDF
            </div>
          ) : null}
          <div ref={pdfFrameRef} className="flex h-full w-full justify-center overflow-x-auto">
            <div
              className="relative mx-auto my-auto"
              style={{
                minWidth: canvasCssSize.width || undefined,
                width: canvasCssSize.width || undefined,
                height: canvasCssSize.height || undefined,
              }}
            >
              <canvas ref={canvasRef} className="bg-white shadow-sm" />
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
        </div>
      ) : (
        <iframe
          className="min-h-[calc(100dvh-156px)] flex-1 rounded-2xl bg-zinc-100/50"
          src={readerUrl}
          title={title}
        />
      )}

      {activePdfLookup ? (
        <span
          className="fixed z-[70] w-[300px] max-w-[min(20rem,calc(100vw-2rem))]"
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

      <div className="fixed inset-x-4 bottom-[calc(env(safe-area-inset-bottom)+12px)] z-40 flex h-[52px] items-center justify-between rounded-full border border-zinc-200/60 bg-white/90 px-2 shadow-elevated backdrop-blur md:hidden">
        {kind === "pdf" ? (
          <button
            className="flex h-10 w-10 items-center justify-center rounded-full text-zinc-600 active:bg-zinc-100 disabled:opacity-30"
            disabled={!canGoPrevious}
            onClick={() => setPageNumber((current) => Math.max(1, current - 1))}
            type="button"
          >
            <ChevronLeft className="h-4 w-4" aria-hidden />
          </button>
        ) : (
          <button
            className="flex h-10 w-10 items-center justify-center rounded-full text-zinc-600 active:bg-zinc-100 disabled:opacity-30"
            onClick={loadReaderUrl}
            type="button"
          >
            <RefreshCw className="h-4 w-4" aria-hidden />
          </button>
        )}
        <span className="text-xs font-bold text-zinc-800 font-display">
          {kind === "pdf" && pageCount > 0 ? `${pageNumber} / ${pageCount}` : kind === "epub" ? "epub.js 待接入" : "pdf.js"}
        </span>
        {kind === "pdf" ? (
          <button
            className="flex h-10 w-10 items-center justify-center rounded-full bg-brand-500 text-white active:bg-brand-600 disabled:opacity-30"
            disabled={!canGoNext}
            onClick={() => setPageNumber((current) => Math.min(pageCount, current + 1))}
            type="button"
          >
            <ChevronRight className="h-4 w-4" aria-hidden />
          </button>
        ) : readerUrl ? (
          <a
            className="flex h-10 w-10 items-center justify-center rounded-full bg-brand-500 text-white active:bg-brand-600"
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
    </div>
  );
}
