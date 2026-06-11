// Timestamp: 2026-06-11 09:30
"use client";

import { useEffect, useState, type MouseEvent } from "react";
import { Loader2 } from "lucide-react";
import { LookupCardStack } from "@/app/watch/LookupCard";

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
  setChapterCount: (count: number) => void;
  setChapterIndex: (updater: (current: number) => number) => void;
  showReaderChrome: () => void;
};

type EpubLookupCard = {
  id: string;
  form: string;
  lookupKind: "word" | "phrase";
  phraseKind?: "collocation" | "phrase" | "idiom";
};

type EpubLookupStack = {
  anchorX: number;
  anchorY: number;
  lineText: string;
  cards: EpubLookupCard[];
};

function closestWordElement(target: EventTarget | null) {
  return target instanceof Element ? target.closest<HTMLElement>("[data-epub-word]") : null;
}

export function EpubReader({
  documentId,
  title,
  chapterIndex,
  setChapterCount,
  setChapterIndex,
  showReaderChrome,
}: EpubReaderProps) {
  const [epubLoading, setEpubLoading] = useState(false);
  const [error, setError] = useState("");
  const [chapters, setChapters] = useState<EpubChapter[]>([]);
  const [activeLookup, setActiveLookup] = useState<EpubLookupStack | null>(null);
  const activeChapter = chapters[chapterIndex] ?? null;
  const pageLabel = chapters.length > 0 ? `${chapterIndex + 1} / ${chapters.length}` : "EPUB";

  useEffect(() => {
    let cancelled = false;
    async function loadEpub() {
      setEpubLoading(true);
      setError("");
      try {
        const response = await fetch(`/api/import/${documentId}/epub`, {
          cache: "no-store",
          credentials: "same-origin",
        });
        if (!response.ok) throw new Error(`EPUB fetch failed: ${response.status}`);
        const payload = (await response.json()) as { chapters?: EpubChapter[] };
        const loadedChapters = payload.chapters;
        if (!Array.isArray(loadedChapters) || loadedChapters.length === 0) {
          throw new Error("EPUB reader returned no chapters");
        }
        if (cancelled) return;
        setChapters(loadedChapters);
        setChapterCount(loadedChapters.length);
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
  }, [documentId, setChapterCount, setChapterIndex]);

  const openLookup = (event: MouseEvent<HTMLElement>) => {
    const wordElement = closestWordElement(event.target);
    if (!wordElement) return;
    event.preventDefault();
    event.stopPropagation();
    showReaderChrome();
    const form = wordElement.dataset.epubWord?.trim();
    if (!form) return;
    const rect = wordElement.getBoundingClientRect();
    const lineText = wordElement.closest("p,h1,h2,h3,h4,h5,h6,li,figcaption")?.textContent?.trim() || form;
    setActiveLookup({
      anchorX: rect.left,
      anchorY: rect.bottom + 6,
      lineText,
      cards: [{ id: `word-${form}`, form, lookupKind: "word" }],
    });
  };

  const closeLookupCard = (id: string) => {
    setActiveLookup((previous) => {
      if (!previous) return null;
      const cards = previous.cards.filter((card) => card.id !== id);
      return cards.length > 0 ? { ...previous, cards } : null;
    });
  };
  const openNestedWord = (form: string) => setActiveLookup((previous) => (
    !previous || previous.cards.length >= 2 ? previous : { ...previous, cards: [...previous.cards, { id: `word-${form}`, form, lookupKind: "word" }] }
  ));
  const openNestedPhrase = (form: string, phraseKind: "collocation" | "phrase" | "idiom") => setActiveLookup((previous) => (
    !previous || previous.cards.length >= 2 ? previous : { ...previous, cards: [...previous.cards, { id: `phrase-${form}`, form, lookupKind: "phrase", phraseKind }] }
  ));

  if (epubLoading) {
    return (
      <div className="flex h-[100dvh] w-full items-center justify-center text-sm font-medium text-zinc-500">
        <Loader2 className="mr-2 h-4 w-4 animate-spin text-brand-500" aria-hidden />
        正在加载 EPUB
      </div>
    );
  }

  if (error) {
    return <div className="mx-4 mt-[18vh] rounded-3xl bg-red-50 px-6 py-8 text-center text-sm font-medium text-red-600">{error}</div>;
  }

  return (
    <>
      <article
        className="mx-auto min-h-[100dvh] w-full max-w-[760px] px-7 pb-24 pt-16 text-zinc-950"
        data-testid="import-epub-reader"
        onClick={openLookup}
      >
        <div className="mb-8 flex items-center gap-2 text-[10px] font-bold uppercase tracking-[0.24em] text-brand-600">
          <span>EPUB</span>
          <span className="h-1 w-1 rounded-full bg-brand-500" aria-hidden />
          <span>{pageLabel}</span>
        </div>
        <h1 className="mb-8 text-2xl font-bold leading-tight text-zinc-950">{activeChapter?.title ?? title}</h1>
        <div
          className="max-w-none text-xl leading-[2.05] tracking-normal text-zinc-900 [&_blockquote]:my-7 [&_blockquote]:border-l-4 [&_blockquote]:border-brand-200 [&_blockquote]:pl-5 [&_figcaption]:mt-2 [&_figcaption]:text-center [&_figcaption]:text-sm [&_figcaption]:text-zinc-500 [&_figure]:my-8 [&_h1]:mb-5 [&_h1]:mt-10 [&_h1]:text-3xl [&_h1]:font-bold [&_h2]:mb-4 [&_h2]:mt-9 [&_h2]:text-2xl [&_h2]:font-bold [&_h3]:mb-3 [&_h3]:mt-8 [&_h3]:text-xl [&_h3]:font-bold [&_img]:mx-auto [&_img]:my-8 [&_img]:max-h-[70vh] [&_img]:max-w-full [&_img]:rounded-xl [&_img]:object-contain [&_li]:my-2 [&_ol]:my-5 [&_ol]:pl-7 [&_p]:my-5 [&_ul]:my-5 [&_ul]:pl-7 [&_[data-epub-word]]:cursor-pointer [&_[data-epub-word]]:rounded-sm [&_[data-epub-word]]:transition [&_[data-epub-word]:active]:bg-brand-100"
          dangerouslySetInnerHTML={{ __html: activeChapter?.html ?? "这个 EPUB 没有可显示的正文。" }}
        />
      </article>
      {activeLookup ? <span className="fixed z-[70] w-[300px] max-w-[min(20rem,calc(100vw-2rem))]" onClick={(event) => event.stopPropagation()} style={{ left: Math.max(8, Math.min(activeLookup.anchorX - 150, typeof window === "undefined" ? 8 : window.innerWidth - 328)), top: activeLookup.anchorY }}>
        <LookupCardStack cards={activeLookup.cards.map((card) => ({ ...card, onClose: () => closeLookupCard(card.id), onExampleWordClick: openNestedWord, onRelatedPhraseClick: openNestedPhrase, originalSentence: activeLookup.lineText, translatedSentence: "", source: { type: "import", documentId, pageNumber: chapterIndex + 1, sentence: activeLookup.lineText } }))} onCloseCard={closeLookupCard} />
      </span> : null}
    </>
  );
}
