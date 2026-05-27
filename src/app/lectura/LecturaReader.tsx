"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { LookupCard } from "@/app/watch/LookupCard";
import { getPlaybackRate, usePlaybackRate } from "@/lib/playback-rate";
import type { LecturaStory } from "@/../content/lectura";

type LecturaReaderProps = {
  story: LecturaStory;
  isRead: boolean;
};

type ActiveLookup = {
  paragraphIndex: number;
  form: string;
  anchorX: number;
  anchorY: number;
};

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

export function LecturaReader({ story, isRead }: LecturaReaderProps) {
  const [activeLookup, setActiveLookup] = useState<ActiveLookup | null>(null);
  const [playingParagraphIndex, setPlayingParagraphIndex] = useState<number | null>(null);
  const [isMarked, setIsMarked] = useState(isRead);
  const [savedSet, setSavedSet] = useState<Set<string>>(() => new Set());
  const [playbackRate] = usePlaybackRate();
  const containerRef = useRef<HTMLDivElement | null>(null);
  const currentAudioRef = useRef<HTMLAudioElement | null>(null);
  const isAutoMarkingRef = useRef(false);

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

  const openLookup = (target: HTMLElement, paragraphIndex: number, form: string) => {
    const rect = target.getBoundingClientRect();
    setActiveLookup({
      paragraphIndex,
      form,
      anchorX: rect.left,
      anchorY: rect.bottom + 6
    });
  };

  const toggleParagraphAudio = (paragraphIndex: number) => {
    if (playingParagraphIndex === paragraphIndex) {
      stopCurrentAudio();
      return;
    }

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

  return (
    <>
      <div
        className="font-serif text-[17px] leading-[1.85] text-gray-800 dark:text-zinc-250"
        data-testid="lectura-reader"
        ref={containerRef}
      >
        {story.paragraphs.map((paragraph, paragraphIndex) => {
          const tokens = splitParagraphTokens(paragraph);
          const isPlaying = playingParagraphIndex === paragraphIndex;

          return (
            <div
              className={`group mb-6 flex gap-3 border-l-2 pl-3 transition ${
                isPlaying ? "border-brand-500" : "border-transparent"
              }`}
              data-testid="lectura-paragraph"
              id={`p${paragraphIndex}`}
              key={paragraphIndex}
            >
              <button
                aria-label={isPlaying ? "Stop paragraph audio" : "Play paragraph audio"}
                className={`mt-1 flex h-6 w-6 shrink-0 items-center justify-center rounded-full border text-[11px] font-semibold transition sm:opacity-0 sm:group-hover:opacity-100 ${
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
                {tokens.map((token, tokenIndex) => {
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
              <div className="fixed z-50" style={{ left, top, width: 320 }}>
                <LookupCard
                  form={activeLookup.form}
                  onClose={() => setActiveLookup(null)}
                  originalSentence={paragraph}
                  source={{
                    type: "lectura",
                    storySlug: story.slug,
                    paragraphIndex: activeLookup.paragraphIndex,
                    sentence: paragraph
                  }}
                  translatedSentence=""
                />
              </div>
            );
          })()
        : null}

      {isMarked ? (
        <div className="mt-6 flex justify-end">
          <span className="inline-flex min-h-[36px] items-center rounded-full bg-emerald-50 px-3 text-sm font-medium text-emerald-600 cursor-default">
            已读 ✓
          </span>
        </div>
      ) : null}
    </>
  );
}
