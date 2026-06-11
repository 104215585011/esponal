// Timestamp: 2026-06-11 16:05
"use client";

import { useEffect, useRef, useState } from "react";
import { Loader2 } from "lucide-react";
import { type ImportReaderSettings } from "@/lib/import/reader-settings";

export type EpubChapter = {
  index: number;
  title: string;
  href: string;
  text?: string;
  html?: string;
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

type EpubBook = {
  destroy?: () => void;
  loaded?: { navigation?: Promise<{ toc?: Array<{ href?: string; label?: string; title?: string }> }> };
  renderTo: (element: HTMLElement, options: Record<string, unknown>) => EpubRendition;
};

type EpubRendition = {
  destroy?: () => void;
  display: (target?: string) => Promise<unknown>;
  next: () => Promise<unknown>;
  prev: () => Promise<unknown>;
  resize?: (width?: number | string, height?: number | string) => void;
};

const M1_FALLBACK_PAGE_COUNT = 999;

async function createEpubBook(source: string) {
  const epubModule = await import("epubjs");
  const createBook = (epubModule.default ?? epubModule) as unknown as (source: string) => EpubBook;
  return createBook(source);
}

export function EpubReader({
  documentId,
  title,
  pageInChapter,
  setChapterCount,
  setChapterIndex,
  setChapterList,
}: EpubReaderProps) {
  const stageRef = useRef<HTMLDivElement>(null);
  const renditionRef = useRef<EpubRendition | null>(null);
  const lastPageRef = useRef(pageInChapter);
  const [epubLoading, setEpubLoading] = useState(true);
  const [error, setError] = useState("");
  const [renditionReady, setRenditionReady] = useState(false);

  useEffect(() => {
    let cancelled = false;
    let book: EpubBook | null = null;
    let rendition: EpubRendition | null = null;
    let objectUrl = "";

    async function mountEpub() {
      const stage = stageRef.current;
      if (!stage) return;
      setEpubLoading(true);
      setError("");
      setRenditionReady(false);
      try {
        const response = await fetch(`/api/import/${documentId}/file`, { cache: "no-store", credentials: "same-origin" });
        if (!response.ok) throw new Error(`EPUB file failed: ${response.status}`);
        const buffer = await response.arrayBuffer();
        if (buffer.byteLength === 0) throw new Error("EPUB file empty");

        objectUrl = URL.createObjectURL(new Blob([buffer], { type: "application/epub+zip" }));
        book = await createEpubBook(objectUrl);
        if (cancelled) return;

        rendition = book.renderTo(stage, {
          flow: "paginated",
          height: "100%",
          manager: "default",
          spread: "none",
          width: "100%",
        });
        renditionRef.current = rendition;

        const navigation = await book.loaded?.navigation?.catch(() => null);
        if (!cancelled) {
          const toc = navigation?.toc ?? [];
          const chapters = toc.length > 0
            ? toc.map((item, index) => ({ index, title: item.label || item.title || `Chapter ${index + 1}`, href: item.href || String(index) }))
            : [{ index: 0, title, href: "epubjs-root" }];
          setChapterList(chapters);
          setChapterIndex((current) => Math.max(0, Math.min(current, chapters.length - 1)));
          setChapterCount(M1_FALLBACK_PAGE_COUNT);
        }

        await rendition.display();
        if (!cancelled) setRenditionReady(true);
      } catch (loadError) {
        console.error("Imported EPUB epub.js load failed", loadError);
        if (!cancelled) setError("EPUB 加载失败，请返回导入库后重试。");
      } finally {
        if (!cancelled) setEpubLoading(false);
      }
    }

    void mountEpub();
    return () => {
      cancelled = true;
      setRenditionReady(false);
      renditionRef.current = null;
      rendition?.destroy?.();
      book?.destroy?.();
      if (objectUrl) URL.revokeObjectURL(objectUrl);
    };
  }, [documentId, setChapterCount, setChapterIndex, setChapterList, title]);

  useEffect(() => {
    if (!renditionReady) return;
    const stage = stageRef.current;
    if (!stage) return;
    const resize = () => {
      try {
        renditionRef.current?.resize?.("100%", "100%");
      } catch (resizeError) {
        console.warn("Imported EPUB resize skipped", resizeError);
      }
    };
    const observer = new ResizeObserver(resize);
    observer.observe(stage);
    return () => observer.disconnect();
  }, [renditionReady]);

  useEffect(() => {
    if (!renditionReady) {
      lastPageRef.current = pageInChapter;
      return;
    }
    const rendition = renditionRef.current;
    if (!rendition) {
      lastPageRef.current = pageInChapter;
      return;
    }
    const delta = pageInChapter - lastPageRef.current;
    lastPageRef.current = pageInChapter;
    if (delta === 0) return;
    const turn = async () => {
      const steps = Math.min(Math.abs(delta), 8);
      for (let index = 0; index < steps; index += 1) {
        if (delta > 0) await renditionRef.current?.next();
        else await renditionRef.current?.prev();
      }
    };
    void turn();
  }, [pageInChapter, renditionReady]);

  return (
    <div className="relative h-[100dvh] w-screen overflow-hidden bg-[#f7f4eb]" data-testid="import-epub-reader">
      <div className="h-full w-full px-0 pb-0 pt-0" data-testid="import-epubjs-stage" ref={stageRef} />
      {epubLoading ? (
        <div className="absolute inset-0 z-10 flex items-center justify-center bg-[#f7f4eb]/80 text-sm font-medium text-zinc-500">
          <Loader2 className="mr-2 h-4 w-4 animate-spin text-brand-500" aria-hidden />
          正在加载 EPUB
        </div>
      ) : null}
      {error ? <div className="absolute inset-x-4 top-[18vh] z-20 rounded-3xl bg-red-50 px-6 py-8 text-center text-sm font-medium text-red-600">{error}</div> : null}
    </div>
  );
}
