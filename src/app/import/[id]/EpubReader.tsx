// Timestamp: 2026-06-11 14:05
"use client";

import { useCallback, useEffect, useMemo, useRef, useState, type MouseEvent } from "react";
import { Loader2 } from "lucide-react";
import { LookupCardStack } from "@/app/watch/LookupCard";
import { type ImportReaderSettings, wrapSentencesInEpubHtml } from "@/lib/import/reader-settings";

export type EpubChapter = {
  index: number;
  title: string;
  href: string;
  text: string;
  html: string;
};

type EpubReaderProps = {
  documentId: string;
  title: string;
  chapterIndex: number;
  pageInChapter: number;
  setChapterCount: (count: number) => void;
  setChapterIndex: (updater: (current: number) => number) => void;
  setChapterList: (chapters: EpubChapter[]) => void;
  setPageInChapter: (updater: (current: number) => number) => void;
  settings: ImportReaderSettings;
  showReaderChrome: () => void;
};

type EpubLookupCard = { id: string; form: string; lookupKind: "word" | "phrase"; phraseKind?: "collocation" | "phrase" | "idiom" };
type EpubLookupStack = { anchorX: number; anchorY: number; lineText: string; cards: EpubLookupCard[] };

const COLUMN_GAP = 32;
const REFLOW_ANCHOR_SELECTOR = "[data-sent], h1, h2, h3, h4, h5, h6, p, li, figure, blockquote";

function closestWordElement(target: EventTarget | null) {
  return target instanceof Element ? target.closest<HTMLElement>("[data-epub-word]") : null;
}

function getAnchorKey(element: HTMLElement, index: number) {
  return element.dataset.sent ? `sent:${element.dataset.sent}` : `node:${index}`;
}

export function EpubReader({
  documentId,
  title,
  chapterIndex,
  pageInChapter,
  setChapterCount,
  setChapterIndex,
  setChapterList,
  setPageInChapter,
  settings,
  showReaderChrome,
}: EpubReaderProps) {
  const frameRef = useRef<HTMLDivElement>(null);
  const contentRef = useRef<HTMLDivElement>(null);
  const [epubLoading, setEpubLoading] = useState(false);
  const [error, setError] = useState("");
  const [chapters, setChapters] = useState<EpubChapter[]>([]);
  const [activeLookup, setActiveLookup] = useState<EpubLookupStack | null>(null);
  const [pageWidth, setPageWidth] = useState(0);
  const [pageHeight, setPageHeight] = useState(0);
  const [chapterPageCount, setChapterPageCount] = useState(1);
  const currentReflowAnchorRef = useRef<string | null>(null);
  const lastPaginationKeyRef = useRef("");
  const activeChapter = chapters[chapterIndex] ?? null;
  const renderedHtml = useMemo(() => wrapSentencesInEpubHtml(activeChapter?.html ?? "这个 EPUB 没有可显示的正文。"), [activeChapter?.html]);
  const transitionClass = settings.pageTurn === "slide" ? "transition-transform duration-[250ms] ease-out" : "";
  const paginationKey = `${activeChapter?.href ?? ""}|${pageWidth}|${pageHeight}|${settings.fontSize}|${settings.fontFamily}|${settings.lineHeight}`;

  const getReflowCandidates = useCallback(() => Array.from(contentRef.current?.querySelectorAll<HTMLElement>(REFLOW_ANCHOR_SELECTOR) ?? []), []);

  const captureCurrentReflowAnchor = useCallback(() => {
    if (pageWidth <= 0) return null;
    const pageStart = pageInChapter * (pageWidth + COLUMN_GAP);
    const candidates = getReflowCandidates();
    const visibleIndex = candidates.findIndex((element) => element.offsetLeft + Math.max(1, element.offsetWidth) > pageStart + 4);
    if (visibleIndex < 0) return null;
    return getAnchorKey(candidates[visibleIndex], visibleIndex);
  }, [getReflowCandidates, pageInChapter, pageWidth]);

  const findPageForReflowAnchor = useCallback((anchor: string, pages: number) => {
    if (pageWidth <= 0) return null;
    const candidates = getReflowCandidates();
    const targetIndex = candidates.findIndex((element, index) => getAnchorKey(element, index) === anchor);
    if (targetIndex < 0) return null;
    const page = Math.floor(candidates[targetIndex].offsetLeft / Math.max(1, pageWidth + COLUMN_GAP));
    return Math.max(0, Math.min(page, pages - 1));
  }, [getReflowCandidates, pageWidth]);

  useEffect(() => {
    let cancelled = false;
    async function loadEpub() {
      setEpubLoading(true);
      setError("");
      try {
        const response = await fetch(`/api/import/${documentId}/epub`, { cache: "no-store", credentials: "same-origin" });
        if (!response.ok) throw new Error(`EPUB fetch failed: ${response.status}`);
        const payload = (await response.json()) as { chapters?: EpubChapter[] };
        const loadedChapters = payload.chapters;
        if (!Array.isArray(loadedChapters) || loadedChapters.length === 0) throw new Error("EPUB reader returned no chapters");
        if (cancelled) return;
        setChapters(loadedChapters);
        setChapterList(loadedChapters);
        setChapterIndex((current) => Math.max(0, Math.min(current, loadedChapters.length - 1)));
      } catch (loadError) {
        console.error("Imported EPUB load failed", loadError);
        if (!cancelled) setError("EPUB 读取失败，请返回导入库后重试。");
      } finally {
        if (!cancelled) setEpubLoading(false);
      }
    }
    void loadEpub();
    return () => {
      cancelled = true;
    };
  }, [documentId, setChapterIndex, setChapterList]);

  useEffect(() => {
    const frame = frameRef.current;
    if (!frame) return;
    const measure = () => {
      setPageWidth(Math.max(280, frame.clientWidth));
      setPageHeight(Math.max(360, frame.clientHeight));
    };
    measure();
    const observer = new ResizeObserver(measure);
    observer.observe(frame);
    return () => observer.disconnect();
  }, []);

  useEffect(() => {
    setPageInChapter(() => 0);
  }, [activeChapter?.href, setPageInChapter]);

  useEffect(() => {
    const content = contentRef.current;
    if (!content || pageWidth <= 0 || pageHeight <= 0) return;
    const measure = () => {
      const horizontalPages = Math.ceil(content.scrollWidth / Math.max(1, pageWidth + COLUMN_GAP));
      const verticalPages = Math.ceil(content.scrollHeight / Math.max(1, pageHeight));
      const pages = Math.max(1, horizontalPages, verticalPages);
      const previousKey = lastPaginationKeyRef.current;
      const reflowedSameChapter = previousKey.length > 0 && previousKey.split("|")[0] === (activeChapter?.href ?? "") && previousKey !== paginationKey;
      const anchoredPage = reflowedSameChapter && currentReflowAnchorRef.current ? findPageForReflowAnchor(currentReflowAnchorRef.current, pages) : null;
      lastPaginationKeyRef.current = paginationKey;
      setChapterPageCount(pages);
      setChapterCount(pages);
      if (anchoredPage !== null) {
        setPageInChapter(() => anchoredPage);
        return;
      }
      setPageInChapter((current) => Math.max(0, Math.min(current, pages - 1)));
    };
    const raf = window.requestAnimationFrame(measure);
    const images = Array.from(content.querySelectorAll("img"));
    images.forEach((image) => image.addEventListener("load", measure, { once: true }));
    return () => {
      window.cancelAnimationFrame(raf);
      images.forEach((image) => image.removeEventListener("load", measure));
    };
  }, [activeChapter?.href, findPageForReflowAnchor, pageHeight, pageWidth, paginationKey, renderedHtml, setChapterCount, setPageInChapter, settings.fontFamily, settings.fontSize, settings.lineHeight]);

  useEffect(() => {
    currentReflowAnchorRef.current = captureCurrentReflowAnchor();
  }, [captureCurrentReflowAnchor, renderedHtml, settings.fontFamily, settings.fontSize, settings.lineHeight]);

  const openLookup = (event: MouseEvent<HTMLElement>) => {
    const wordElement = closestWordElement(event.target);
    if (!wordElement) return;
    event.preventDefault();
    event.stopPropagation();
    showReaderChrome();
    const form = wordElement.dataset.epubWord?.trim();
    if (!form) return;
    const rect = wordElement.getBoundingClientRect();
    const sentenceText = wordElement.closest("[data-sent]")?.textContent?.trim();
    const lineText = sentenceText || wordElement.closest("p,h1,h2,h3,h4,h5,h6,li,figcaption")?.textContent?.trim() || form;
    setActiveLookup({ anchorX: rect.left, anchorY: rect.bottom + 6, lineText, cards: [{ id: `word-${form}`, form, lookupKind: "word" }] });
  };

  const closeLookupCard = (id: string) => setActiveLookup((previous) => {
    if (!previous) return null;
    const cards = previous.cards.filter((card) => card.id !== id);
    return cards.length > 0 ? { ...previous, cards } : null;
  });
  const openNestedWord = (form: string) => setActiveLookup((previous) => (!previous || previous.cards.length >= 2 ? previous : { ...previous, cards: [...previous.cards, { id: `word-${form}`, form, lookupKind: "word" }] }));
  const openNestedPhrase = (form: string, phraseKind: "collocation" | "phrase" | "idiom") => setActiveLookup((previous) => (!previous || previous.cards.length >= 2 ? previous : { ...previous, cards: [...previous.cards, { id: `phrase-${form}`, form, lookupKind: "phrase", phraseKind }] }));

  if (epubLoading) return <div className="flex h-[100dvh] w-full items-center justify-center text-sm font-medium text-zinc-500"><Loader2 className="mr-2 h-4 w-4 animate-spin text-brand-500" aria-hidden />正在加载 EPUB</div>;
  if (error) return <div className="mx-4 mt-[18vh] rounded-3xl bg-red-50 px-6 py-8 text-center text-sm font-medium text-red-600">{error}</div>;

  return (
    <>
      <div className="h-[100dvh] w-screen overflow-hidden px-5 pb-24 pt-16" data-testid="import-epub-reader" ref={frameRef}>
        <div className="h-full overflow-hidden" data-testid="import-epub-paginator" onClick={openLookup}>
          <article className={`h-full ${transitionClass}`} style={{ transform: `translate3d(-${pageInChapter * (pageWidth + COLUMN_GAP)}px,0,0)` }}>
            <div
              className="h-full max-w-none text-[length:var(--reader-font-size)] leading-[var(--reader-line-height)] tracking-normal [font-family:var(--reader-font-family)] [&_blockquote]:my-7 [&_blockquote]:border-l-4 [&_blockquote]:border-brand-200 [&_blockquote]:pl-5 [&_figcaption]:mt-2 [&_figcaption]:text-center [&_figcaption]:text-sm [&_figcaption]:text-zinc-500 [&_figure]:my-8 [&_h1]:mb-5 [&_h1]:mt-8 [&_h1]:text-3xl [&_h1]:font-bold [&_h2]:mb-4 [&_h2]:mt-8 [&_h2]:text-2xl [&_h2]:font-bold [&_h3]:mb-3 [&_h3]:mt-7 [&_h3]:text-xl [&_h3]:font-bold [&_img]:mx-auto [&_img]:my-8 [&_img]:max-h-[90vh] [&_img]:max-w-full [&_img]:rounded-xl [&_img]:object-contain [&_li]:my-2 [&_ol]:my-5 [&_ol]:pl-7 [&_p]:my-5 [&_ul]:my-5 [&_ul]:pl-7 [&_[data-epub-word]]:cursor-pointer [&_[data-epub-word]]:rounded-sm [&_[data-epub-word]]:transition [&_[data-epub-word]:active]:bg-brand-100"
              dangerouslySetInnerHTML={{ __html: renderedHtml }}
              ref={contentRef}
              style={{ columnWidth: pageWidth || undefined, columnGap: COLUMN_GAP, width: pageWidth || undefined }}
            />
          </article>
        </div>
        <div className="pointer-events-none fixed right-4 top-4 z-20 text-[10px] uppercase tracking-[0.2em] text-zinc-400">{activeChapter?.title ?? title} · {pageInChapter + 1}/{chapterPageCount}</div>
      </div>
      {activeLookup ? <span className="fixed z-[70] w-[300px] max-w-[min(20rem,calc(100vw-2rem))]" onClick={(event) => event.stopPropagation()} style={{ left: Math.max(8, Math.min(activeLookup.anchorX - 150, typeof window === "undefined" ? 8 : window.innerWidth - 328)), top: activeLookup.anchorY }}>
        <LookupCardStack cards={activeLookup.cards.map((card) => ({ ...card, onClose: () => closeLookupCard(card.id), onExampleWordClick: openNestedWord, onRelatedPhraseClick: openNestedPhrase, originalSentence: activeLookup.lineText, translatedSentence: "", source: { type: "import", documentId, pageNumber: chapterIndex + 1, sentence: activeLookup.lineText } }))} onCloseCard={closeLookupCard} />
      </span> : null}
    </>
  );
}
