// Timestamp: 2026-06-08 18:22
"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { ChevronLeft, ChevronRight, X } from "lucide-react";
import { LookupCardStack } from "@/app/watch/LookupCard";

const WINDOW_RADIUS = 5;

type ImportedPage = {
  pageIndex: number;
  content: string;
};

type ImportReaderClientProps = {
  documentId: string;
  title: string;
  pageCount: number;
  initialPageIndex: number;
};

type ActiveLookup = {
  pageIndex: number;
  form: string;
  anchorX: number;
  anchorY: number;
};

const fontSizeClass = {
  sm: "text-[16px] leading-[1.75]",
  md: "text-[18px] leading-[1.85]",
  lg: "text-[19px] leading-[1.9] md:text-[20px]",
} as const;

type FontSize = keyof typeof fontSizeClass;

function clampPage(value: number, pageCount: number) {
  if (pageCount <= 0) return 0;
  return Math.min(Math.max(value, 0), pageCount - 1);
}

function splitTokens(text: string) {
  return text.match(/\S+|\s+/g) ?? [];
}

function normalizeLookupWord(token: string) {
  return token
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/^[^\p{L}]+|[^\p{L}]+$/gu, "")
    .trim();
}

export function ImportReaderClient({
  documentId,
  title,
  pageCount,
  initialPageIndex,
}: ImportReaderClientProps) {
  const [currentPageIndex, setCurrentPageIndex] = useState(() =>
    clampPage(initialPageIndex, pageCount),
  );
  const [pagesByIndex, setPagesByIndex] = useState<Record<number, string>>({});
  const [fontSize, setFontSize] = useState<FontSize>("md");
  const [isJumpOpen, setIsJumpOpen] = useState(false);
  const [activeLookup, setActiveLookup] = useState<ActiveLookup | null>(null);

  const loadWindow = useCallback(
    async (targetPageIndex: number) => {
      if (pageCount <= 0) return;
      const response = await fetch(`/api/import/${documentId}/pages?from=${Math.max(0, targetPageIndex - WINDOW_RADIUS)}&to=${Math.min(pageCount - 1, targetPageIndex + WINDOW_RADIUS)}`);
      if (!response.ok) return;
      const payload = (await response.json()) as { pages?: ImportedPage[] };
      const loadedPages = payload.pages ?? [];
      setPagesByIndex((prev) => {
        const next = { ...prev };
        for (const page of loadedPages) {
          next[page.pageIndex] = page.content;
        }
        return next;
      });
    },
    [documentId, pageCount],
  );

  const reportProgress = useCallback(
    async (targetPageIndex: number) => {
      await fetch(`/api/import/${documentId}/progress`, {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ lastPageIndex: targetPageIndex }),
      });
    },
    [documentId],
  );

  const goToPage = useCallback(
    (target: number) => {
      const targetPageIndex = clampPage(target, pageCount);
      setCurrentPageIndex(targetPageIndex);
      setActiveLookup(null);
      void loadWindow(targetPageIndex);
      void reportProgress(targetPageIndex);
    },
    [loadWindow, pageCount, reportProgress],
  );

  useEffect(() => {
    void loadWindow(currentPageIndex);
  }, [currentPageIndex, loadWindow]);

  const currentContent = pagesByIndex[currentPageIndex] ?? "";
  const paragraphs = useMemo(
    () => currentContent.split(/\n{2,}/).map((paragraph) => paragraph.trim()).filter(Boolean),
    [currentContent],
  );

  const cycleFontSize = () => {
    setFontSize((size) => (size === "sm" ? "md" : size === "md" ? "lg" : "sm"));
  };

  const openLookup = (target: HTMLElement, form: string) => {
    const rect = target.getBoundingClientRect();
    setActiveLookup({
      pageIndex: currentPageIndex,
      form,
      anchorX: rect.left,
      anchorY: rect.bottom + 6,
    });
  };

  return (
    <div className="relative flex gap-6" data-testid="import-reader">
      <article className="min-w-0 flex-1 rounded-[28px] border border-zinc-200/70 bg-white px-5 py-6 shadow-card md:px-8 md:py-8">
        <div className="mb-5 flex items-center justify-between gap-3 border-b border-zinc-100 pb-4">
          <div className="min-w-0">
            <p className="text-xs font-semibold text-brand-600">第 {currentPageIndex + 1} 页</p>
            <h2 className="truncate text-base font-semibold text-zinc-900">{title}</h2>
          </div>
          <span className="rounded-full bg-zinc-100 px-3 py-1 text-xs font-bold text-zinc-600">
            {currentPageIndex + 1} / {pageCount}
          </span>
        </div>

        <div className={`font-serif text-zinc-800 transition-all ${fontSizeClass[fontSize]}`}>
          {paragraphs.length > 0 ? (
            paragraphs.map((paragraph, paragraphIndex) => (
              <p className="mb-6" key={`${currentPageIndex}-${paragraphIndex}`}>
                {splitTokens(paragraph).map((token, tokenIndex) => {
                  const normalized = normalizeLookupWord(token);
                  if (!normalized) {
                    return <span key={`${tokenIndex}-${token}`}>{token}</span>;
                  }
                  return (
                    <span
                      className="cursor-pointer rounded-sm transition hover:bg-brand-50"
                      key={`${tokenIndex}-${token}`}
                      onClick={(event) => openLookup(event.currentTarget, normalized)}
                      role="button"
                      tabIndex={0}
                    >
                      {token}
                    </span>
                  );
                })}
              </p>
            ))
          ) : (
            <div className="rounded-2xl bg-zinc-50 p-6 text-sm text-zinc-500">
              正在加载当前页...
            </div>
          )}
        </div>
      </article>

      {activeLookup ? (
        <div
          className="fixed z-50"
          style={{
            left: Math.min(activeLookup.anchorX, typeof window === "undefined" ? activeLookup.anchorX : window.innerWidth - 340),
            top: activeLookup.anchorY,
            width: 320,
          }}
        >
          <div className="mb-2 flex justify-end">
            <button
              aria-label="关闭查词"
              className="flex h-8 w-8 items-center justify-center rounded-full bg-white text-zinc-500 shadow-card"
              onClick={() => setActiveLookup(null)}
              type="button"
            >
              <X className="h-4 w-4" />
            </button>
          </div>
          <LookupCardStack
            cards={[
              {
                id: `word-${activeLookup.form}`,
                form: activeLookup.form,
                lookupKind: "word",
                onClose: () => setActiveLookup(null),
                originalSentence: currentContent,
                translatedSentence: "",
                source: {
                  type: "lectura",
                  storySlug: `import:${documentId}`,
                  paragraphIndex: activeLookup.pageIndex,
                  sentence: currentContent,
                },
              },
            ]}
            onCloseCard={() => setActiveLookup(null)}
          />
        </div>
      ) : null}

      <nav
        aria-label="导入阅读控制"
        className="fixed inset-x-4 bottom-[calc(env(safe-area-inset-bottom)+12px)] z-30 flex h-16 items-center justify-between gap-1 rounded-full border border-zinc-200/60 bg-white/80 px-3 shadow-elevated backdrop-blur-md md:hidden"
      >
        <button
          aria-label="切换字号"
          className="flex h-11 min-w-[56px] items-center justify-center rounded-full text-zinc-600 active:scale-90 active:bg-zinc-100"
          onClick={cycleFontSize}
          type="button"
        >
          <span className="font-display text-sm font-semibold">Aa</span>
        </button>
        <button
          aria-label="上一页"
          className="flex h-11 w-11 items-center justify-center rounded-full text-zinc-500 active:text-brand-600 disabled:opacity-30"
          disabled={currentPageIndex <= 0}
          onClick={() => goToPage(currentPageIndex - 1)}
          type="button"
        >
          <ChevronLeft className="h-6 w-6" />
        </button>
        <button
          aria-label="跳转页码"
          className="flex h-11 min-w-[72px] items-center justify-center rounded-full text-xs font-bold text-zinc-700 active:bg-zinc-100"
          onClick={() => setIsJumpOpen(true)}
          type="button"
        >
          {currentPageIndex + 1} / {pageCount}
        </button>
        <button
          aria-label="下一页"
          className="flex h-11 w-11 items-center justify-center rounded-full text-zinc-500 active:text-brand-600 disabled:opacity-30"
          disabled={currentPageIndex >= pageCount - 1}
          onClick={() => goToPage(currentPageIndex + 1)}
          type="button"
        >
          <ChevronRight className="h-6 w-6" />
        </button>
      </nav>

      {isJumpOpen ? (
        <div className="fixed inset-x-4 bottom-[calc(env(safe-area-inset-bottom)+88px)] z-40 rounded-3xl border border-zinc-200 bg-white p-5 shadow-elevated md:hidden">
          <div className="flex items-center justify-between">
            <p className="text-sm font-semibold text-zinc-900">跳转页码</p>
            <button
              aria-label="关闭跳页"
              className="flex h-9 w-9 items-center justify-center rounded-full bg-zinc-100 text-zinc-500"
              onClick={() => setIsJumpOpen(false)}
              type="button"
            >
              <X className="h-4 w-4" />
            </button>
          </div>
          <input
            aria-label="选择页码"
            className="mt-4 w-full accent-brand-500"
            max={Math.max(0, pageCount - 1)}
            min={0}
            onChange={(event) => goToPage(Number(event.target.value))}
            type="range"
            value={currentPageIndex}
          />
        </div>
      ) : null}
    </div>
  );
}
