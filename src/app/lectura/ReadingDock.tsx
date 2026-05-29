// Timestamp: 2026-05-29 02:38
"use client";

import { LookupCardStack } from "@/app/watch/LookupCard";

type ActiveLookupCard = {
  id: string;
  form: string;
  lookupKind: "word" | "phrase";
  phraseKind?: "collocation" | "phrase" | "idiom";
};

type ActiveLookup = {
  paragraphIndex: number;
  cards: ActiveLookupCard[];
};

type ReadingDockProps = {
  activeLookup: ActiveLookup | null;
  onClose: () => void;
  onCloseCard: (id: string) => void;
  onExampleWordClick: (form: string) => void;
  storySlug: string;
  paragraphs: string[];
};

export function ReadingDock({
  activeLookup,
  onClose,
  onCloseCard,
  onExampleWordClick,
  storySlug,
  paragraphs
}: ReadingDockProps) {
  const paragraphText = activeLookup ? (paragraphs[activeLookup.paragraphIndex] ?? "") : "";

  return (
    <div className="w-full h-full min-h-[360px] rounded-2xl border border-zinc-200/60 dark:border-zinc-800/60 bg-white/60 dark:bg-zinc-900/60 p-4 shadow-sm backdrop-blur-md transition-all duration-300">
      {activeLookup ? (
        <div data-testid="reading-dock-card">
          <LookupCardStack
            cards={activeLookup.cards.map((card) => ({
              ...card,
              onClose: () => onCloseCard(card.id),
              onExampleWordClick,
              originalSentence: paragraphText,
              translatedSentence: "",
              useStaticLayout: true,
              source: {
                type: "lectura",
                storySlug: storySlug,
                paragraphIndex: activeLookup.paragraphIndex,
                sentence: paragraphText
              }
            }))}
            onCloseCard={onCloseCard}
          />
        </div>
      ) : (
        <div className="flex h-full min-h-[300px] flex-col items-center justify-center text-center p-6 select-none">
          <div className="flex h-12 w-12 items-center justify-center rounded-full bg-zinc-50 dark:bg-zinc-800/50 text-zinc-400 dark:text-zinc-500 mb-4">
            <svg className="h-6 w-6 fill-none stroke-current stroke-2" viewBox="0 0 24 24">
              <path d="M12 6.253v13m0-13C10.832 5.477 9.246 5 7.5 5S4.168 5.477 3 6.253v13C4.168 18.477 5.754 18 7.5 18s3.332.477 4.5 1.253m0-13C13.168 5.477 14.754 5 16.5 5c1.747 0 3.332.477 4.5 1.253v13C19.832 18.477 18.247 18 16.5 18c-1.746 0-3.332.477-4.5 1.253" />
            </svg>
          </div>
          <h3 className="text-sm font-semibold text-zinc-700 dark:text-zinc-300">
            查词固定面板
          </h3>
          <p className="mt-1.5 text-xs leading-relaxed text-zinc-400 dark:text-zinc-500 max-w-[200px]">
            点击文章中的西班牙语单词，释义将固定展示在此处。
          </p>
        </div>
      )}
    </div>
  );
}
