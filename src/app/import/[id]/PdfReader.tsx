// Timestamp: 2026-06-11 13:10
"use client";

import { useEffect, useMemo, useRef, useState, type Dispatch, type MouseEvent, type SetStateAction } from "react";
import { Loader2, ZoomIn, ZoomOut } from "lucide-react";
import { LookupCardStack } from "@/app/watch/LookupCard";
import { type ImportReaderSettings } from "@/lib/import/reader-settings";

type PdfReaderProps = {
  documentId: string;
  pageNumber: number;
  readerUrl: string;
  setPageCount: (pageCount: number) => void;
  setPageNumber: Dispatch<SetStateAction<number>>;
  settings: ImportReaderSettings;
  showReaderChrome: () => void;
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
  items: Array<{ str?: string; transform?: number[]; width?: number; height?: number }>;
};
type PdfTextLayerItem = {
  id: string;
  text: string;
  lineText: string;
  sentenceText: string;
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
const PDF_MIN_ZOOM = 0.9;
const PDF_MAX_ZOOM = 1.8;
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
}

function clampPdfZoom(value: number) {
  return Math.max(PDF_MIN_ZOOM, Math.min(PDF_MAX_ZOOM, Number(value.toFixed(2))));
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
      const sentenceText = closestSentenceForPdfItem(lineText, match.index ?? 0);
      items.push({
        id: `${itemIndex}-${match.index ?? 0}-${text}`,
        text,
        lineText,
        sentenceText,
        left: x + lineWidth * startRatio,
        top: y - lineHeight,
        width: Math.max(24, lineWidth * widthRatio),
        height: Math.max(24, lineHeight * 1.2),
      });
    }
  });
  return items;
}

function closestSentenceForPdfItem(lineText: string, index: number) {
  const leftBoundary = Math.max(lineText.lastIndexOf(".", index - 1), lineText.lastIndexOf("?", index - 1), lineText.lastIndexOf("!", index - 1));
  const rightStops = [lineText.indexOf(".", index), lineText.indexOf("?", index), lineText.indexOf("!", index)].filter((value) => value >= 0);
  const rightBoundary = rightStops.length > 0 ? Math.min(...rightStops) + 1 : lineText.length;
  return lineText.slice(leftBoundary + 1, rightBoundary).trim() || lineText;
}

type PdfPageCanvasProps = {
  documentId: string;
  effectivePdfZoom: number;
  frameWidth: number;
  initialPageNumber: number;
  pageNumber: number;
  pdfDocument: PdfDocumentProxy;
  setVisiblePage: (pageNumber: number) => void;
  settings: ImportReaderSettings;
  showReaderChrome: () => void;
};

function PdfPageCanvas({
  documentId,
  effectivePdfZoom,
  frameWidth,
  initialPageNumber,
  pageNumber,
  pdfDocument,
  setVisiblePage,
  settings,
  showReaderChrome,
}: PdfPageCanvasProps) {
  const pageRef = useRef<HTMLDivElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const didScrollInitialPageRef = useRef(false);
  const [canvasCssSize, setCanvasCssSize] = useState({ width: 0, height: 0 });
  const [pdfTextLayerItems, setPdfTextLayerItems] = useState<PdfTextLayerItem[]>([]);
  const [activePdfLookup, setActivePdfLookup] = useState<PdfLookupStack | null>(null);

  useEffect(() => {
    const element = pageRef.current;
    if (!element) return;
    const observer = new IntersectionObserver(
      ([entry]) => {
        if (entry?.isIntersecting) setVisiblePage(pageNumber);
      },
      { root: element.closest("[data-testid='import-pdf-continuous-scroll']"), threshold: 0.55 }
    );
    observer.observe(element);
    return () => observer.disconnect();
  }, [pageNumber, setVisiblePage]);

  useEffect(() => {
    if (didScrollInitialPageRef.current || pageNumber !== initialPageNumber) return;
    didScrollInitialPageRef.current = true;
    window.requestAnimationFrame(() => pageRef.current?.scrollIntoView({ block: "start" }));
  }, [initialPageNumber, pageNumber]);

  useEffect(() => {
    let cancelled = false;
    async function renderPage() {
      const canvas = canvasRef.current;
      const context = canvas?.getContext("2d");
      if (!canvas || !context || frameWidth <= 0) return;
      const page = await pdfDocument.getPage(pageNumber);
      if (cancelled) return;
      const containerWidth = Math.min(920, frameWidth || canvas.parentElement?.clientWidth || 360);
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
    }
    void renderPage();
    return () => {
      cancelled = true;
    };
  }, [effectivePdfZoom, frameWidth, pageNumber, pdfDocument]);

  const openPdfLookup = (event: MouseEvent<HTMLButtonElement>, item: PdfTextLayerItem) => {
    event.stopPropagation();
    showReaderChrome();
    const rect = event.currentTarget.getBoundingClientRect();
    setActivePdfLookup({
      anchorX: rect.left,
      anchorY: rect.bottom + 6,
      lineText: item.sentenceText,
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
  const openNestedPdfWord = (form: string) => setActivePdfLookup((previous) => (
    !previous || previous.cards.length >= 2 ? previous : { ...previous, cards: [...previous.cards, { id: `word-${form}`, form, lookupKind: "word" }] }
  ));
  const openNestedPdfPhrase = (form: string, phraseKind: "collocation" | "phrase" | "idiom") => setActivePdfLookup((previous) => (
    !previous || previous.cards.length >= 2 ? previous : { ...previous, cards: [...previous.cards, { id: `phrase-${form}`, form, lookupKind: "phrase", phraseKind }] }
  ));

  return (
    <section className="relative flex justify-center py-2" data-testid="import-pdf-page-canvas" ref={pageRef}>
      <div className="relative bg-white shadow-sm" style={{ minWidth: canvasCssSize.width || undefined, width: canvasCssSize.width || undefined, height: canvasCssSize.height || undefined }}>
        <canvas ref={canvasRef} className={settings.paper === "night" ? "bg-white shadow-2xl shadow-black/40" : "bg-white"} />
        <div className="absolute left-0 top-0 z-[2]" data-testid="import-pdf-text-layer" style={{ width: canvasCssSize.width, height: canvasCssSize.height }}>
          {pdfTextLayerItems.map((item) => (
            <button aria-label={`查询 ${item.text}`} className="absolute rounded-sm bg-brand-500/0 text-transparent outline-none transition hover:bg-brand-500/15 focus:bg-brand-500/20" data-testid="import-pdf-word" key={item.id} onClick={(event) => openPdfLookup(event, item)} style={{ left: item.left, top: item.top, width: item.width, height: item.height }} type="button">{item.text}</button>
          ))}
        </div>
      </div>
      <span className="pointer-events-none absolute bottom-4 right-4 rounded-full bg-white/80 px-2 py-1 text-[10px] font-semibold text-zinc-500 shadow-sm">{pageNumber}</span>
      {activePdfLookup ? <span className="fixed z-[70] w-[300px] max-w-[min(20rem,calc(100vw-2rem))]" onClick={(event) => event.stopPropagation()} style={{ left: Math.max(8, Math.min(activePdfLookup.anchorX - 150, typeof window === "undefined" ? 8 : window.innerWidth - 328)), top: activePdfLookup.anchorY }}>
        <LookupCardStack cards={activePdfLookup.cards.map((card) => ({ ...card, onClose: () => closePdfLookupCard(card.id), onExampleWordClick: openNestedPdfWord, onRelatedPhraseClick: openNestedPdfPhrase, originalSentence: activePdfLookup.lineText, translatedSentence: "", source: { type: "import", documentId, pageNumber, sentence: activePdfLookup.lineText } }))} onCloseCard={closePdfLookupCard} />
      </span> : null}
    </section>
  );
}

export function PdfReader({
  documentId,
  pageNumber,
  readerUrl,
  setPageCount,
  setPageNumber,
  settings,
  showReaderChrome,
}: PdfReaderProps) {
  const pdfFrameRef = useRef<HTMLDivElement>(null);
  const [pdfLoading, setPdfLoading] = useState(false);
  const [error, setError] = useState("");
  const [pdfDocument, setPdfDocument] = useState<PdfDocumentProxy | null>(null);
  const [pdfZoom, setPdfZoom] = useState(1);
  const [pdfFrameWidth, setPdfFrameWidth] = useState(0);
  const pageNumbers = useMemo(() => (pdfDocument ? Array.from({ length: pdfDocument.numPages }, (_, index) => index + 1) : []), [pdfDocument]);

  useEffect(() => {
    const frame = pdfFrameRef.current;
    if (!frame) return;
    const updateFrameSize = () => setPdfFrameWidth(Math.max(320, frame.clientWidth || 0));
    updateFrameSize();
    const observer = new ResizeObserver(updateFrameSize);
    observer.observe(frame);
    return () => observer.disconnect();
  }, [error, pdfDocument]);

  useEffect(() => {
    if (!readerUrl) return;
    let cancelled = false;
    async function loadPdf() {
      setPdfLoading(true);
      setError("");
      try {
        const response = await fetch(readerUrl, { cache: "no-store", credentials: "same-origin" });
        const contentType = response.headers.get("content-type") ?? "";
        if (!response.ok) throw new Error(`PDF fetch failed: ${response.status} ${contentType}`);
        const buffer = await response.arrayBuffer();
        const bytes = new Uint8Array(buffer);
        if (bytes.byteLength === 0) throw new Error("PDF fetch returned an empty body");
        const pdfjs = await import("pdfjs-dist/build/pdf.mjs");
        configurePdfJsWorker(pdfjs);
        const task = pdfjs.getDocument({ data: bytes });
        const loaded = (await task.promise) as PdfDocumentProxy;
        if (cancelled) return;
        setPdfDocument(loaded);
        setPageCount(loaded.numPages);
        setPageNumber((current) => Math.min(Math.max(1, current), loaded.numPages));
      } catch (renderError) {
        console.error("Imported PDF load failed", renderError);
        if (!cancelled) setError("PDF 渲染失败，请刷新阅读链接或在新窗口打开。");
      } finally {
        if (!cancelled) setPdfLoading(false);
      }
    }
    void loadPdf();
    return () => {
      cancelled = true;
    };
  }, [readerUrl, setPageCount, setPageNumber]);

  const changePdfZoom = (delta: number) => {
    showReaderChrome();
    setPdfZoom((current) => clampPdfZoom(current + delta));
  };

  return (
    <>
      {pdfLoading ? <div className="absolute inset-0 z-10 flex items-center justify-center bg-white/50 text-sm font-medium text-zinc-500 backdrop-blur-sm"><Loader2 className="mr-2 h-4 w-4 animate-spin text-brand-500" aria-hidden />正在渲染 PDF</div> : null}
      {error ? <div className="mx-4 mt-[18vh] rounded-3xl bg-red-50 px-6 py-8 text-center text-sm font-medium text-red-600">{error}</div> : (
        <div className="h-[100dvh] w-screen overflow-y-auto overflow-x-hidden bg-[#f3f4f2] px-0 pb-16 pt-14" data-testid="import-pdf-continuous-scroll" ref={pdfFrameRef}>
          <div className="mx-auto flex w-full max-w-[980px] flex-col gap-4">
            {pdfDocument ? pageNumbers.map((pdfPageNumber) => (
              <PdfPageCanvas documentId={documentId} effectivePdfZoom={pdfZoom} frameWidth={pdfFrameWidth} initialPageNumber={pageNumber} key={pdfPageNumber} pageNumber={pdfPageNumber} pdfDocument={pdfDocument} setVisiblePage={setPageNumber} settings={settings} showReaderChrome={showReaderChrome} />
            )) : null}
          </div>
        </div>
      )}
      <div className="fixed bottom-4 right-3 z-50 flex gap-2" onClick={(event) => event.stopPropagation()}>
        <button aria-label="缩小 PDF" className="flex h-10 w-10 items-center justify-center rounded-full bg-white/90 text-zinc-600 shadow-sm disabled:opacity-30" disabled={pdfZoom <= PDF_MIN_ZOOM} onClick={() => changePdfZoom(-0.1)} type="button"><ZoomOut className="h-5 w-5" aria-hidden /></button>
        <button aria-label="放大 PDF" className="flex h-10 w-10 items-center justify-center rounded-full bg-white/90 text-zinc-600 shadow-sm disabled:opacity-30" disabled={pdfZoom >= PDF_MAX_ZOOM} onClick={() => changePdfZoom(0.1)} type="button"><ZoomIn className="h-5 w-5" aria-hidden /></button>
      </div>
    </>
  );
}
