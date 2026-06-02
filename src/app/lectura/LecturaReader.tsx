// Timestamp: 2026-06-02 15:05
"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { LookupCard, LookupCardStack } from "@/app/watch/LookupCard";
import {
  PHRASE_HIGHLIGHT_CLASSES,
  buildPhraseSegments,
  type PhraseSpan
} from "@/app/components/vocab/PhraseText";
import { getPlaybackRate, usePlaybackRate } from "@/lib/playback-rate";
import { ReadingPreferences, type ReadingFontSize, type ReadingLookupMode } from "./ReadingPreferences";
import { ReadingDock } from "./ReadingDock";
import { useReadingPosition } from "@/hooks/useReadingPosition";
import type { LecturaStory } from "@/../content/lectura";

type LecturaReaderProps = {
  story: LecturaStory;
  isRead: boolean;
};

type ActiveLookupCard = {
  id: string;
  form: string;
  lookupKind: "word" | "phrase";
  phraseKind?: PhraseSpan["kind"];
};

type ActiveLookup = {
  paragraphIndex: number;
  anchorX: number;
  anchorY: number;
  cards: ActiveLookupCard[];
};

type IconProps = {
  className?: string;
};

function Check({ className }: IconProps) {
  return (
    <svg aria-hidden="true" className={className} fill="none" stroke="currentColor" strokeLinecap="round" strokeLinejoin="round" strokeWidth="2.2" viewBox="0 0 24 24">
      <path d="m5 12 4 4 10-10" />
    </svg>
  );
}

function Pause({ className }: IconProps) {
  return (
    <svg aria-hidden="true" className={className} fill="currentColor" viewBox="0 0 24 24">
      <path d="M7 5h4v14H7zM13 5h4v14h-4z" />
    </svg>
  );
}

function Play({ className }: IconProps) {
  return (
    <svg aria-hidden="true" className={className} fill="currentColor" viewBox="0 0 24 24">
      <path d="M8 5v14l11-7z" />
    </svg>
  );
}

function SkipBack({ className }: IconProps) {
  return (
    <svg aria-hidden="true" className={className} fill="none" stroke="currentColor" strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" viewBox="0 0 24 24">
      <path d="M19 20 9 12l10-8v16zM5 19V5" />
    </svg>
  );
}

function SkipForward({ className }: IconProps) {
  return (
    <svg aria-hidden="true" className={className} fill="none" stroke="currentColor" strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" viewBox="0 0 24 24">
      <path d="m5 4 10 8-10 8V4zM19 5v14" />
    </svg>
  );
}

function splitParagraphTokens(text: string) {
  return text.match(/\S+|\s+/g) ?? [];
}

function normalizeLookupWord(token: string) {
  return token
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .toLowerCase()
    .replace(/^[^a-záéíóúñü]+|[^a-záéíóúñü]+$/gi, "")
    .trim();
}

const fontSizeStyle: Record<ReadingFontSize, string> = {
  sm: "text-[16px] leading-[1.75] md:leading-[1.8]",
  md: "text-[18px] leading-[1.85]",
  lg: "text-[19px] leading-[1.9] md:text-[20px]"
};

const fontSizeLabels: Record<ReadingFontSize, string> = {
  sm: "小",
  md: "中",
  lg: "大"
};

type MobileReadingBarProps = {
  activeLookup: ActiveLookup | null;
  fontSize: ReadingFontSize;
  isMarked: boolean;
  isPlaying: boolean;
  onCycleFontSize: () => void;
  onMarkAsRead: () => void;
  onPlayPause: () => void;
  onPlayPrevious: () => void;
  onPlayNext: () => void;
};

function MobileReadingBar({
  activeLookup,
  fontSize,
  isMarked,
  isPlaying,
  onCycleFontSize,
  onMarkAsRead,
  onPlayPause,
  onPlayPrevious,
  onPlayNext
}: MobileReadingBarProps) {
  if (activeLookup) return null;

  return (
    <nav
      aria-label="阅读控制"
      className="fixed inset-x-4 bottom-[calc(env(safe-area-inset-bottom)+12px)] z-30 flex h-16 items-center justify-between gap-1 rounded-full border border-zinc-200/60 bg-white/80 px-3 shadow-elevated backdrop-blur-md transition-all duration-300 ease-out dark:border-zinc-800/60 dark:bg-zinc-900/80 md:hidden"
    >
      <button
        aria-label={`字号：${fontSizeLabels[fontSize]}`}
        className="flex h-11 w-11 items-center justify-center rounded-full text-zinc-600 transition-transform active:scale-90 active:bg-zinc-100 dark:text-zinc-300 dark:active:bg-zinc-800"
        onClick={onCycleFontSize}
        type="button"
      >
        <span className="font-display text-sm font-semibold">Aa</span>
      </button>
      <button
        aria-label="播放上一段"
        className="flex h-11 w-11 items-center justify-center rounded-full text-zinc-500 transition-transform active:scale-90 dark:text-zinc-400"
        onClick={onPlayPrevious}
        type="button"
      >
        <SkipBack className="h-5 w-5" />
      </button>
      <button
        aria-label={isPlaying ? "暂停朗读" : "播放朗读"}
        className="flex h-12 w-12 items-center justify-center rounded-full bg-brand-500 text-white shadow-md shadow-brand-500/25 transition-all active:scale-95"
        onClick={onPlayPause}
        type="button"
      >
        {isPlaying ? <Pause className="h-5 w-5 fill-current" /> : <Play className="h-5 w-5 fill-current translate-x-[1px]" />}
      </button>
      <button
        aria-label="播放下一段"
        className="flex h-11 w-11 items-center justify-center rounded-full text-zinc-500 transition-transform active:scale-90 dark:text-zinc-400"
        onClick={onPlayNext}
        type="button"
      >
        <SkipForward className="h-5 w-5" />
      </button>
      <button
        aria-label={isMarked ? "已读" : "标记为已读"}
        className={
          isMarked
            ? "flex h-11 w-11 cursor-default items-center justify-center rounded-full bg-brand-500 text-white shadow-md shadow-brand-500/20 transition-all"
            : "flex h-11 w-11 items-center justify-center rounded-full border border-zinc-200 text-zinc-400 transition-all hover:text-brand-500 active:scale-90 dark:border-zinc-800 dark:text-zinc-500"
        }
        disabled={isMarked}
        onClick={onMarkAsRead}
        type="button"
      >
        <Check className="h-5 w-5" />
      </button>
    </nav>
  );
};

export function LecturaReader({ story, isRead }: LecturaReaderProps) {
  const [activeLookup, setActiveLookup] = useState<ActiveLookup | null>(null);
  const [playingParagraphIndex, setPlayingParagraphIndex] = useState<number | null>(null);
  const [isMarked, setIsMarked] = useState(isRead);
  const [savedSet, setSavedSet] = useState<Set<string>>(() => new Set());
  const [phraseSpansByParagraph, setPhraseSpansByParagraph] = useState<Record<number, PhraseSpan[]>>({});
  const [playbackRate] = usePlaybackRate();
  const containerRef = useRef<HTMLDivElement | null>(null);
  const currentAudioRef = useRef<HTMLAudioElement | null>(null);
  const isAutoMarkingRef = useRef(false);

  const [fontSize, setFontSize] = useState<ReadingFontSize>("md");
  const [lookupMode, setLookupMode] = useState<ReadingLookupMode>("dock");
  const [isMounted, setIsMounted] = useState(false);

  useEffect(() => {
    setIsMounted(true);
    const savedSize = localStorage.getItem("read-pref-size") as ReadingFontSize;
    if (savedSize && ["sm", "md", "lg"].includes(savedSize)) {
      setFontSize(savedSize);
    }
    const savedMode = localStorage.getItem("read-pref-mode") as ReadingLookupMode;
    if (savedMode && ["float", "dock"].includes(savedMode)) {
      setLookupMode(savedMode);
    } else {
      if (typeof window !== "undefined" && window.innerWidth < 1024) {
        setLookupMode("float");
      }
    }
  }, []);

  const handleSetFontSize = (size: ReadingFontSize) => {
    setFontSize(size);
    localStorage.setItem("read-pref-size", size);
  };

  const handleSetLookupMode = (mode: ReadingLookupMode) => {
    setLookupMode(mode);
    localStorage.setItem("read-pref-mode", mode);
  };

  const cycleFontSize = () => {
    handleSetFontSize(fontSize === "sm" ? "md" : fontSize === "md" ? "lg" : "sm");
  };

  useReadingPosition(story.slug, isMounted);

  useEffect(() => {
    if (currentAudioRef.current) {
      currentAudioRef.current.playbackRate = playbackRate;
    }
  }, [playbackRate]);

  const stopCurrentAudio = () => {
    if (!currentAudioRef.current) {
      return;
    }

    currentAudioRef.current.pause();
    currentAudioRef.current.currentTime = 0;
    currentAudioRef.current = null;
    setPlayingParagraphIndex(null);
  };

  const openLookup = (
    target: HTMLElement,
    paragraphIndex: number,
    form: string,
    lookupKind: "word" | "phrase" = "word",
    phraseKind?: PhraseSpan["kind"]
  ) => {
    const rect = target.getBoundingClientRect();
    setActiveLookup((prev) => {
      if (
        prev &&
        prev.paragraphIndex === paragraphIndex &&
        prev.cards[0]?.form === form &&
        prev.cards.length === 1
      ) {
        return null;
      }
      return {
        paragraphIndex,
        anchorX: rect.left,
        anchorY: rect.bottom + 6,
        cards: [
          {
            id: `${lookupKind}-${form}`,
            form,
            lookupKind,
            phraseKind
          }
        ]
      };
    });
  };

  const openNestedWord = (form: string) => {
    setActiveLookup((prev) => {
      if (!prev || prev.cards.length >= 2) return prev;
      return {
        ...prev,
        cards: [
          ...prev.cards,
          {
            id: `word-${form}`,
            form,
            lookupKind: "word"
          }
        ]
      };
    });
  };

  const openNestedPhrase = (lemma: string, kind: "collocation" | "phrase" | "idiom") => {
    setActiveLookup((prev) => {
      if (!prev || prev.cards.length >= 2) return prev;
      return {
        ...prev,
        cards: [
          ...prev.cards,
          {
            id: `phrase-${lemma}`,
            form: lemma,
            lookupKind: "phrase",
            phraseKind: kind
          }
        ]
      };
    });
  };

  const closeStackCard = (id: string) => {
    setActiveLookup((prev) => {
      if (!prev) return null;
      const nextCards = prev.cards.filter((card) => card.id !== id);
      if (nextCards.length === 0) return null;
      return { ...prev, cards: nextCards };
    });
  };

  const playParagraphAudio = (paragraphIndex: number) => {
    stopCurrentAudio();

    const audio = new Audio(`/audio/lectura/${story.slug}/p${paragraphIndex}.mp3`);
    audio.playbackRate = getPlaybackRate();
    currentAudioRef.current = audio;
    setPlayingParagraphIndex(paragraphIndex);

    audio.addEventListener(
      "ended",
      () => {
        currentAudioRef.current = null;
        setPlayingParagraphIndex(null);
        if (paragraphIndex + 1 < story.paragraphs.length) {
          playParagraphAudio(paragraphIndex + 1);
        }
      },
      { once: true }
    );
    audio.addEventListener(
      "error",
      () => {
        currentAudioRef.current = null;
        setPlayingParagraphIndex(null);
      },
      { once: true }
    );

    audio.play().catch(() => {
      currentAudioRef.current = null;
      setPlayingParagraphIndex(null);
    });
  };

  const toggleParagraphAudio = (paragraphIndex: number) => {
    if (playingParagraphIndex === paragraphIndex) {
      stopCurrentAudio();
      return;
    }

    playParagraphAudio(paragraphIndex);
  };

  const playPreviousParagraph = () => {
    playParagraphAudio(Math.max((playingParagraphIndex ?? 0) - 1, 0));
  };

  const playNextParagraph = () => {
    const nextIndex = playingParagraphIndex === null ? 0 : playingParagraphIndex + 1;
    if (nextIndex >= story.paragraphs.length) {
      stopCurrentAudio();
      return;
    }

    playParagraphAudio(nextIndex);
  };

  const markAsRead = useCallback(async () => {
    if (isMarked || isAutoMarkingRef.current) {
      return;
    }

    isAutoMarkingRef.current = true;
    try {
      const response = await fetch(`/api/lectura/${story.slug}/read`, {
        method: "POST"
      });

      if (!response.ok) {
        return;
      }

      setIsMarked(true);
      window.dispatchEvent(
        new CustomEvent("lectura:marked-read", {
          detail: { slug: story.slug }
        })
      );
    } finally {
      isAutoMarkingRef.current = false;
    }
  }, [isMarked, story.slug]);

  useEffect(() => {
    let cancelled = false;

    fetch("/api/vocab/highlight")
      .then((response) => (response.ok ? response.json() : { savedForms: [] }))
      .then((data: { savedForms?: unknown }) => {
        if (cancelled || !Array.isArray(data.savedForms)) {
          return;
        }

        setSavedSet(
          new Set(
            data.savedForms
              .filter((form): form is string => typeof form === "string")
              .map((form) => normalizeLookupWord(form))
              .filter(Boolean)
          )
        );
      })
      .catch(() => {
        if (!cancelled) {
          setSavedSet(new Set());
        }
      });

    const handlePointerDown = (event: PointerEvent) => {
      if (!containerRef.current) return;
      const target = event.target as Node | null;
      if (!target) return;
      if (containerRef.current.contains(target)) return;
      const lookupEl = document.querySelector("[data-testid='lookup-card']");
      if (lookupEl && lookupEl.contains(target)) return;
      setActiveLookup(null);
    };

    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        setActiveLookup(null);
      }
    };

    document.addEventListener("pointerdown", handlePointerDown);
    document.addEventListener("keydown", handleKeyDown);

    return () => {
      cancelled = true;
      document.removeEventListener("pointerdown", handlePointerDown);
      document.removeEventListener("keydown", handleKeyDown);
      stopCurrentAudio();
    };
  }, []);

  useEffect(() => {
    let cancelled = false;

    async function loadPhraseSpans() {
      const entries = await Promise.all(
        story.paragraphs.map(async (paragraph, paragraphIndex) => {
          try {
            const response = await fetch("/api/lexicon/detect-phrases", {
              method: "POST",
              headers: { "Content-Type": "application/json" },
              body: JSON.stringify({ text: paragraph })
            });
            if (!response.ok) return [paragraphIndex, []] as const;
            const payload = (await response.json()) as { spans?: PhraseSpan[] };
            return [paragraphIndex, Array.isArray(payload.spans) ? payload.spans : []] as const;
          } catch {
            return [paragraphIndex, []] as const;
          }
        })
      );

      if (!cancelled) {
        setPhraseSpansByParagraph(Object.fromEntries(entries));
      }
    }

    void loadPhraseSpans();

    return () => {
      cancelled = true;
    };
  }, [story.paragraphs]);

  useEffect(() => {
    const handleScroll = () => {
      if (isMarked) {
        return;
      }

      const progress = Math.round(
        ((window.scrollY + window.innerHeight) / document.documentElement.scrollHeight) * 100
      );

      if (progress >= 90) {
        void markAsRead();
      }
    };

    window.addEventListener("scroll", handleScroll, { passive: true });
    handleScroll();

    return () => {
      window.removeEventListener("scroll", handleScroll);
    };
  }, [isMarked, markAsRead]);

  const dockLookup = activeLookup
    ? {
        paragraphIndex: activeLookup.paragraphIndex,
        cards: activeLookup.cards
      }
    : null;

  return (
    <div className="flex flex-col lg:flex-row gap-10 items-start w-full relative">
      {/* Left/Main Column - Article Content */}
      <div className="flex-1 min-w-0 max-w-[65ch] w-full mx-auto">
        <div className="hidden md:flex justify-end mb-6">
          <ReadingPreferences
            fontSize={fontSize}
            setFontSize={handleSetFontSize}
            lookupMode={lookupMode}
            setLookupMode={handleSetLookupMode}
          />
        </div>

        <div
          className={`font-serif text-zinc-800 dark:text-zinc-200 transition-all ${fontSizeStyle[fontSize]}`}
          data-testid="lectura-reader"
          ref={containerRef}
        >
          {story.paragraphs.map((paragraph, paragraphIndex) => {
            const tokens = splitParagraphTokens(paragraph);
            const phraseSegments = buildPhraseSegments(
              tokens.map((token) => ({ text: token, isWord: !!normalizeLookupWord(token) })),
              phraseSpansByParagraph[paragraphIndex] ?? []
            );
            const isPlaying = playingParagraphIndex === paragraphIndex;

            return (
              <div
                className={`group mb-6 md:mb-8 flex md:gap-3 border-l-2 pl-3 md:pl-3.5 transition ${
                  isPlaying ? "border-brand-500 bg-brand-50/40 dark:bg-brand-950/20" : "border-transparent"
                }`}
                data-testid="lectura-paragraph"
                id={`p${paragraphIndex}`}
                key={paragraphIndex}
              >
                <button
                  aria-label={isPlaying ? "Stop paragraph audio" : "Play paragraph audio"}
                  className={`mt-1 hidden md:flex md:opacity-0 md:group-hover:opacity-100 h-6 w-6 shrink-0 items-center justify-center rounded-full border text-[11px] font-semibold transition ${
                    isPlaying
                      ? "border-brand-500 bg-brand-50 text-brand-600 dark:border-brand-500 dark:bg-brand-950/30 dark:text-brand-400 opacity-100"
                      : "border-gray-200 bg-white text-gray-400 dark:border-zinc-800 dark:bg-zinc-900 dark:text-zinc-500 hover:border-brand-500 hover:text-brand-600 dark:hover:border-brand-500 dark:hover:text-brand-400"
                  }`}
                  onClick={() => toggleParagraphAudio(paragraphIndex)}
                  type="button"
                >
                  {isPlaying ? "||" : ">"}
                </button>
                <p className="min-w-0 flex-1">
                  {phraseSegments.map((segment, tokenIndex) => {
                    if (segment.type === "phrase") {
                      return (
                        <span
                          className={PHRASE_HIGHLIGHT_CLASSES}
                          key={`phrase-${segment.span.start}-${segment.span.end}`}
                          onClick={(event) => {
                            event.stopPropagation();
                            openLookup(
                              event.currentTarget as HTMLElement,
                              paragraphIndex,
                              segment.span.lemma,
                              "phrase",
                              segment.span.kind
                            );
                          }}
                          role="button"
                          tabIndex={0}
                        >
                          {segment.tokens.map((phraseToken, phraseTokenIndex) => {
                            const normalized = normalizeLookupWord(phraseToken.text);
                            if (!normalized) {
                              return <span key={`${phraseToken.text}-${phraseTokenIndex}`}>{phraseToken.text}</span>;
                            }
                            return (
                              <span
                                className={savedSet.has(normalized) ? "saved-word" : ""}
                                key={`${phraseToken.text}-${phraseTokenIndex}`}
                              >
                                {phraseToken.text}
                              </span>
                            );
                          })}
                        </span>
                      );
                    }

                    const token = segment.token.text;
                    const normalized = normalizeLookupWord(token);
                    if (!normalized) {
                      return <span key={tokenIndex}>{token}</span>;
                    }

                    return (
                      <span
                        className={`cursor-pointer rounded-sm transition hover:bg-brand-50 dark:hover:bg-brand-950/30 ${
                          savedSet.has(normalized) ? "saved-word" : ""
                        }`}
                        key={tokenIndex}
                        onClick={(event) => {
                          event.stopPropagation();
                          openLookup(event.currentTarget as HTMLElement, paragraphIndex, normalized);
                        }}
                        onKeyDown={(event) => {
                          if (event.key === "Enter" || event.key === " ") {
                            event.preventDefault();
                            event.stopPropagation();
                            openLookup(event.currentTarget as HTMLElement, paragraphIndex, normalized);
                          }
                        }}
                        role="button"
                        tabIndex={0}
                      >
                        {token}
                      </span>
                    );
                  })}
                </p>
              </div>
            );
          })}
        </div>

        {isMarked ? (
          <div className="mt-8 hidden justify-end md:flex">
            <span className="inline-flex min-h-[36px] items-center rounded-full bg-emerald-50 dark:bg-emerald-950/20 px-3.5 text-sm font-medium text-emerald-600 dark:text-emerald-400 cursor-default border border-emerald-100 dark:border-emerald-900/30">
              已读 ✓
            </span>
          </div>
        ) : null}
      </div>

      {/* Right Column - Reading Dock (Only rendered when Mode B is set, hides via Tailwind on small screens) */}
      {lookupMode === "dock" && (
        <aside className="w-80 shrink-0 sticky top-24 hidden lg:block self-start">
          <ReadingDock
            activeLookup={dockLookup}
            onClose={() => setActiveLookup(null)}
            onCloseCard={closeStackCard}
            onExampleWordClick={openNestedWord}
            onRelatedPhraseClick={openNestedPhrase}
            storySlug={story.slug}
            paragraphs={story.paragraphs}
          />
        </aside>
      )}

      {/* Floating Card Popover (Mode A, always used on mobile/tablet viewports) */}
      {activeLookup
        ? (() => {
            const paragraph = story.paragraphs[activeLookup.paragraphIndex] ?? "";
            const left =
              typeof window !== "undefined"
                ? Math.min(activeLookup.anchorX, window.innerWidth - 340)
                : activeLookup.anchorX;
            const top =
              typeof window !== "undefined" &&
              activeLookup.anchorY + 280 > window.innerHeight
                ? activeLookup.anchorY - 300
                : activeLookup.anchorY;
            return (
              <div
                className={`fixed z-50 transition-all ${
                  lookupMode === "dock" ? "lg:hidden" : ""
                }`}
                style={{ left, top, width: 320 }}
              >
                <LookupCardStack
                  cards={activeLookup.cards.map((card) => ({
                    ...card,
                    onClose: () => closeStackCard(card.id),
                    onExampleWordClick: openNestedWord,
                    onRelatedPhraseClick: openNestedPhrase,
                    originalSentence: paragraph,
                    translatedSentence: "",
                    source: {
                      type: "lectura",
                      storySlug: story.slug,
                      paragraphIndex: activeLookup.paragraphIndex,
                      sentence: paragraph
                    }
                  }))}
                  onCloseCard={closeStackCard}
                />
              </div>
            );
          })()
        : null}

      <MobileReadingBar
        activeLookup={activeLookup}
        fontSize={fontSize}
        isMarked={isMarked}
        isPlaying={playingParagraphIndex !== null}
        onCycleFontSize={cycleFontSize}
        onMarkAsRead={markAsRead}
        onPlayNext={playNextParagraph}
        onPlayPause={() => {
          if (playingParagraphIndex === null) {
            playParagraphAudio(0);
            return;
          }
          stopCurrentAudio();
        }}
        onPlayPrevious={playPreviousParagraph}
      />
    </div>
  );
}
