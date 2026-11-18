// Timestamp: 2026-11-18 11:28
"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import Link from "next/link";
import { Volume2, Pause, Check, ArrowRight } from "lucide-react";
import { LookupCardStack } from "@/app/watch/LookupCard";
import {
  PHRASE_HIGHLIGHT_CLASSES,
  buildPhraseSegments,
  type PhraseSpan
} from "@/app/components/vocab/PhraseText";
import { getPlaybackRate, usePlaybackRate } from "@/lib/playback-rate";
import { speak, stopSpeaking } from "@/lib/speak";
import { ReadingPreferences, type ReadingFontSize, type ReadingLookupMode } from "./ReadingPreferences";
import { ReadingDock } from "./ReadingDock";
import { useReadingPosition } from "@/hooks/useReadingPosition";
import type { LecturaStory } from "@/../content/lectura";
import type { NextStoryRecommendation } from "@/lib/lectura/catalog-logic";

type LecturaReaderProps = {
  story: LecturaStory;
  isRead: boolean;
  initialParagraphIndex?: number;
  nextRecommendation?: NextStoryRecommendation | null;
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

type ParagraphSentence = {
  text: string;
  endTokenIndex: number;
};

type MobileReadingBarProps = {
  activeLookup: ActiveLookup | null;
  fontSize: ReadingFontSize;
  isMarked: boolean;
  onCycleFontSize: () => void;
  onMarkAsRead: () => void;
};

function splitParagraphTokens(text: string) {
  return text.match(/\S+|\s+/g) ?? [];
}

function splitParagraphSentences(text: string): ParagraphSentence[] {
  const tokens = splitParagraphTokens(text);
  const sentences: ParagraphSentence[] = [];
  let buffer = "";

  for (let tokenIndex = 0; tokenIndex < tokens.length; tokenIndex += 1) {
    const token = tokens[tokenIndex];
    buffer += token;

    const trimmed = token.trim();
    const isBoundary = /[.!?]["'”’»)\]]*$/u.test(trimmed);
    const isLastToken = tokenIndex === tokens.length - 1;

    if ((isBoundary || isLastToken) && buffer.trim()) {
      sentences.push({
        text: buffer.trim(),
        endTokenIndex: tokenIndex
      });
      buffer = "";
    }
  }

  if (buffer.trim()) {
    sentences.push({
      text: buffer.trim(),
      endTokenIndex: tokens.length - 1
    });
  }

  return sentences;
}

function normalizeLookupWord(token: string) {
  return token
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
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

function MobileReadingBar({
  activeLookup,
  fontSize,
  isMarked,
  onCycleFontSize,
  onMarkAsRead
}: MobileReadingBarProps) {
  if (activeLookup) return null;

  return (
    <nav
      aria-label="阅读控制"
      className="fixed inset-x-4 bottom-[calc(env(safe-area-inset-bottom)+12px)] z-30 flex h-16 items-center justify-between gap-2 rounded-full border border-zinc-200/60 bg-white/80 px-3 shadow-elevated backdrop-blur-md transition-all duration-300 ease-out dark:border-zinc-800/60 dark:bg-zinc-900/80 md:hidden"
    >
      <button
        aria-label={`字号：${fontSizeLabels[fontSize]}`}
        className="flex h-11 min-w-[88px] items-center justify-center rounded-full text-zinc-600 transition-transform active:scale-90 active:bg-zinc-100 dark:text-zinc-300 dark:active:bg-zinc-800"
        onClick={onCycleFontSize}
        type="button"
      >
        <span className="font-display text-sm font-semibold">Aa</span>
      </button>
      <button
        aria-label={isMarked ? "已读" : "标记为已读"}
        className={
          isMarked
            ? "flex h-11 min-w-[88px] cursor-default items-center justify-center rounded-full bg-brand-500 text-white shadow-md shadow-brand-500/20 transition-all"
            : "flex h-11 min-w-[88px] items-center justify-center rounded-full border border-zinc-200 text-zinc-500 transition-all active:scale-90 dark:border-zinc-800 dark:text-zinc-400"
        }
        disabled={isMarked}
        onClick={onMarkAsRead}
        type="button"
      >
        <Check className="h-5 w-5" />
      </button>
    </nav>
  );
}

export function LecturaReader({
  story,
  isRead,
  initialParagraphIndex = 0,
  nextRecommendation = null
}: LecturaReaderProps) {
  const [activeLookup, setActiveLookup] = useState<ActiveLookup | null>(null);
  const [playingParagraphIndex, setPlayingParagraphIndex] = useState<number | null>(null);
  const [playingSentenceKey, setPlayingSentenceKey] = useState<string | null>(null);
  const [isMarked, setIsMarked] = useState(isRead);
  const [nextStory, setNextStory] = useState<NextStoryRecommendation | null>(nextRecommendation);
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
    } else if (typeof window !== "undefined" && window.innerWidth < 1024) {
      setLookupMode("float");
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

  useReadingPosition(story.slug, isMounted && initialParagraphIndex <= 0);

  const reportProgress = useCallback(
    (paragraphIndex: number) => {
      if (isMarked) return;
      fetch(`/api/lectura/${story.slug}/read`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          action: "progress",
          paragraphIndex,
          totalParagraphs: story.paragraphs.length
        })
      }).catch(() => {
        // Silent background progress update
      });
    },
    [isMarked, story.slug, story.paragraphs.length]
  );

  useEffect(() => {
    if (!isMounted || initialParagraphIndex <= 0) return;
    const el = document.getElementById(`p${initialParagraphIndex}`);
    if (el) {
      el.scrollIntoView({ behavior: "smooth", block: "center" });
    }
  }, [isMounted, initialParagraphIndex]);

  useEffect(() => {
    if (currentAudioRef.current) {
      currentAudioRef.current.playbackRate = playbackRate;
    }
  }, [playbackRate]);

  const stopCurrentAudio = useCallback(() => {
    if (!currentAudioRef.current) {
      return;
    }

    currentAudioRef.current.pause();
    currentAudioRef.current.currentTime = 0;
    currentAudioRef.current = null;
    setPlayingParagraphIndex(null);
  }, []);

  const stopAllReadingAudio = useCallback(() => {
    stopCurrentAudio();
    stopSpeaking();
    setPlayingSentenceKey(null);
  }, [stopCurrentAudio]);

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

  const playParagraphAudio = useCallback((paragraphIndex: number) => {
    stopAllReadingAudio();

    const audio = new Audio(`/audio/lectura/${story.slug}/p${paragraphIndex}.mp3`);
    audio.playbackRate = getPlaybackRate();
    currentAudioRef.current = audio;
    setPlayingParagraphIndex(paragraphIndex);

    audio.addEventListener(
      "ended",
      () => {
        currentAudioRef.current = null;
        setPlayingParagraphIndex(null);
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
  }, [stopAllReadingAudio, story.slug]);

  const toggleParagraphAudio = (paragraphIndex: number) => {
    reportProgress(paragraphIndex);
    if (playingParagraphIndex === paragraphIndex) {
      stopCurrentAudio();
      return;
    }

    playParagraphAudio(paragraphIndex);
  };

  const playSentenceAudio = (sentenceText: string, sentenceKey: string) => {
    if (playingSentenceKey === sentenceKey) {
      stopSpeaking();
      setPlayingSentenceKey(null);
      return;
    }

    stopCurrentAudio();
    setPlayingParagraphIndex(null);

    speak(sentenceText, {
      rate: getPlaybackRate(),
      onStart: () => setPlayingSentenceKey(sentenceKey),
      onEnd: () => setPlayingSentenceKey((current) => (current === sentenceKey ? null : current))
    });
  };

  const markAsRead = useCallback(async () => {
    if (isMarked || isAutoMarkingRef.current) {
      return;
    }

    isAutoMarkingRef.current = true;
    try {
      const response = await fetch(`/api/lectura/${story.slug}/read`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          action: "complete",
          totalParagraphs: story.paragraphs.length
        })
      });

      if (!response.ok) {
        return;
      }

      const data = (await response.json().catch(() => ({}))) as {
        nextStory?: NextStoryRecommendation | null;
      };
      if (data.nextStory) {
        setNextStory(data.nextStory);
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
  }, [isMarked, story.slug, story.paragraphs.length]);

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
        stopAllReadingAudio();
      }
    };

    document.addEventListener("pointerdown", handlePointerDown);
    document.addEventListener("keydown", handleKeyDown);

    return () => {
      cancelled = true;
      document.removeEventListener("pointerdown", handlePointerDown);
      document.removeEventListener("keydown", handleKeyDown);
      stopAllReadingAudio();
    };
  }, [stopAllReadingAudio]);

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
      if (isMarked || isAutoMarkingRef.current) {
        return;
      }

      const progress = Math.round(
        ((window.scrollY + window.innerHeight) / document.documentElement.scrollHeight) * 100
      );

      if (progress >= 90) {
        isAutoMarkingRef.current = true;
        reportProgress(Math.max(0, story.paragraphs.length - 1));
      }
    };

    window.addEventListener("scroll", handleScroll, { passive: true });
    handleScroll();

    return () => {
      window.removeEventListener("scroll", handleScroll);
    };
  }, [isMarked, reportProgress, story.paragraphs.length]);

  const dockLookup = activeLookup
    ? {
        paragraphIndex: activeLookup.paragraphIndex,
        cards: activeLookup.cards
      }
    : null;

  return (
    <div className="relative flex w-full flex-col items-start gap-10 lg:flex-row">
      <div className="mx-auto w-full max-w-[65ch] min-w-0 flex-1">
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
            const sentences = splitParagraphSentences(paragraph);
            const sentenceByEndToken = new Map(
              sentences.map((sentence, sentenceIndex) => [
                sentence.endTokenIndex,
                {
                  ...sentence,
                  sentenceIndex,
                  key: `${paragraphIndex}-${sentenceIndex}`
                }
              ])
            );
            const isPlayingParagraph = playingParagraphIndex === paragraphIndex;
            let tokenCursor = -1;

            return (
              <div
                className={`group mb-6 md:mb-8 flex md:gap-3 border-l-2 pl-3 md:pl-3.5 transition ${
                  isPlayingParagraph ? "border-brand-500 bg-brand-50/40 dark:bg-brand-950/20" : "border-transparent"
                }`}
                data-testid="lectura-paragraph"
                id={`p${paragraphIndex}`}
                key={paragraphIndex}
              >
                <button
                  aria-label={isPlayingParagraph ? "Stop paragraph audio" : "Play paragraph audio"}
                  className={`mt-1 hidden md:flex md:opacity-0 md:group-hover:opacity-100 h-6 w-6 shrink-0 items-center justify-center rounded-full border text-[11px] font-semibold transition ${
                    isPlayingParagraph
                      ? "border-brand-500 bg-brand-50 text-brand-600 dark:border-brand-500 dark:bg-brand-950/30 dark:text-brand-400 opacity-100"
                      : "border-gray-200 bg-white text-gray-400 dark:border-zinc-800 dark:bg-zinc-900 dark:text-zinc-500 hover:border-brand-500 hover:text-brand-600 dark:hover:border-brand-500 dark:hover:text-brand-400"
                  }`}
                  onClick={() => toggleParagraphAudio(paragraphIndex)}
                  type="button"
                >
                  {isPlayingParagraph ? <Pause className="h-3.5 w-3.5" /> : <Volume2 className="h-3.5 w-3.5" />}
                </button>
                <p className="min-w-0 flex-1">
                  {phraseSegments.map((segment, segmentIndex) => {
                    const consumedTokenCount = segment.type === "phrase" ? segment.tokens.length : 1;
                    tokenCursor += consumedTokenCount;
                    const sentence = sentenceByEndToken.get(tokenCursor);

                    const renderedSegment =
                      segment.type === "phrase" ? (
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
                      ) : (() => {
                        const token = segment.token.text;
                        const normalized = normalizeLookupWord(token);
                        if (!normalized) {
                          return <span key={`token-${segmentIndex}`}>{token}</span>;
                        }

                        return (
                          <span
                            className={`cursor-pointer rounded-sm transition hover:bg-brand-50 dark:hover:bg-brand-950/30 ${
                              savedSet.has(normalized) ? "saved-word" : ""
                            }`}
                            key={`token-${segmentIndex}`}
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
                      })();

                    return (
                      <span key={`segment-${paragraphIndex}-${segmentIndex}`}>
                        {renderedSegment}
                        {sentence ? (
                          <button
                            aria-label={`播放句子 ${sentence.sentenceIndex + 1}`}
                            className={`ml-1 inline-flex md:hidden h-6 w-6 items-center justify-center rounded-full border align-middle transition ${
                              playingSentenceKey === sentence.key
                                ? "border-brand-500 bg-brand-500 text-white shadow-sm shadow-brand-500/25"
                                : "border-zinc-200 bg-white/80 text-zinc-500 dark:border-zinc-800 dark:bg-zinc-900/80 dark:text-zinc-400"
                            }`}
                            data-testid="lectura-sentence-play"
                            onClick={() => playSentenceAudio(sentence.text, sentence.key)}
                            type="button"
                          >
                            <Volume2 className="h-3.5 w-3.5" />
                          </button>
                        ) : null}
                      </span>
                    );
                  })}
                </p>
              </div>
            );
          })}
        </div>

        {/* 读完了操作 + 读后推荐下一篇 */}
        <div className="mt-10 rounded-2xl border border-zinc-200/70 bg-surface p-5 dark:border-zinc-800/70">
          {!isMarked ? (
            <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
              <div>
                <p className="text-sm font-semibold text-zinc-900 dark:text-zinc-100">
                  读到末尾了吗？
                </p>
                <p className="mt-0.5 text-xs text-zinc-500 dark:text-zinc-400">
                  点「读完了」保存完成记录，并为你挑选下一篇相近难度、相关主题的好文章。
                </p>
              </div>
              <button
                type="button"
                onClick={() => void markAsRead()}
                className="inline-flex min-h-[42px] shrink-0 items-center justify-center gap-1.5 rounded-full bg-brand-500 px-5 text-sm font-semibold text-white transition hover:bg-brand-600"
              >
                <Check className="h-4 w-4" aria-hidden />
                <span>读完了</span>
              </button>
            </div>
          ) : (
            <div className="space-y-4">
              <div className="flex items-center justify-between gap-2">
                <span className="inline-flex min-h-[32px] cursor-default items-center gap-1.5 rounded-full border border-emerald-100 bg-emerald-50 px-3 text-xs font-semibold text-emerald-700 dark:border-emerald-900/30 dark:bg-emerald-950/30 dark:text-emerald-400">
                  <Check className="h-3.5 w-3.5" aria-hidden />
                  <span>本篇已读完</span>
                </span>
              </div>

              {nextStory ? (
                <Link
                  href={`/lectura/${nextStory.slug}`}
                  className="group flex flex-col gap-2 rounded-xl border border-brand-200/60 bg-brand-50/40 p-4 transition hover:border-brand-300 dark:border-brand-800/40 dark:bg-brand-950/20"
                >
                  <div className="flex items-center justify-between gap-2 text-xs font-semibold text-brand-700 dark:text-brand-400">
                    <span>为你推荐下一篇 · {nextStory.reasonZh}</span>
                    <ArrowRight className="h-4 w-4 transition group-hover:translate-x-0.5" aria-hidden />
                  </div>
                  <p className="text-base font-bold text-zinc-900 group-hover:text-brand-600 dark:text-zinc-100">
                    {nextStory.titleZh}
                  </p>
                  <p className="text-xs text-zinc-600 dark:text-zinc-400">{nextStory.summaryZh}</p>
                </Link>
              ) : null}
            </div>
          )}
        </div>
      </div>

      {lookupMode === "dock" && (
        <aside className="hidden w-80 shrink-0 self-start sticky top-24 lg:block">
          <ReadingDock
            activeLookup={dockLookup}
            onClose={() => setActiveLookup(null)}
            onCloseCard={closeStackCard}
            onExampleWordClick={openNestedWord}
            onRelatedPhraseClick={openNestedPhrase}
            paragraphs={story.paragraphs}
            storySlug={story.slug}
          />
        </aside>
      )}

      {activeLookup
        ? (() => {
            const paragraph = story.paragraphs[activeLookup.paragraphIndex] ?? "";
            const left =
              typeof window !== "undefined"
                ? Math.min(activeLookup.anchorX, window.innerWidth - 340)
                : activeLookup.anchorX;
            const top =
              typeof window !== "undefined" && activeLookup.anchorY + 280 > window.innerHeight
                ? activeLookup.anchorY - 300
                : activeLookup.anchorY;

            return (
              <div
                className={`fixed z-50 transition-all ${lookupMode === "dock" ? "lg:hidden" : ""}`}
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
        onCycleFontSize={cycleFontSize}
        onMarkAsRead={markAsRead}
      />
    </div>
  );
}
