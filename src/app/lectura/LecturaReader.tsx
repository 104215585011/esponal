"use client";

import { useEffect, useRef, useState } from "react";
import { LookupCard } from "@/app/watch/LookupCard";
import type { LecturaStory } from "@/../content/lectura";

type LecturaReaderProps = {
  story: LecturaStory;
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
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/^[^a-záéíóúñü]+|[^a-záéíóúñü]+$/gi, "")
    .trim();
}

export function LecturaReader({ story }: LecturaReaderProps) {
  const [activeLookup, setActiveLookup] = useState<ActiveLookup | null>(null);
  const [playingParagraphIndex, setPlayingParagraphIndex] = useState<number | null>(null);
  const [savedSet, setSavedSet] = useState<Set<string>>(() => new Set());
  const containerRef = useRef<HTMLDivElement | null>(null);
  const currentAudioRef = useRef<HTMLAudioElement | null>(null);

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

  useEffect(() => {
    let cancelled = false;

    fetch("/api/vocab/highlight")
      .then((response) => (response.ok ? response.json() : { savedForms: [] }))
      .then((data: { savedForms?: unknown }) => {
        if (cancelled || !Array.isArray(data.savedForms)) return;
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
        if (!cancelled) setSavedSet(new Set());
      });

    function handlePointerDown(event: PointerEvent) {
      if (!containerRef.current) return;
      const target = event.target as Node | null;
      if (!target) return;
      if (containerRef.current.contains(target)) return;
      const lookupEl = document.querySelector("[data-testid='lookup-card']");
      if (lookupEl && lookupEl.contains(target)) return;
      setActiveLookup(null);
    }

    function handleKeyDown(event: KeyboardEvent) {
      if (event.key === "Escape") setActiveLookup(null);
    }

    document.addEventListener("pointerdown", handlePointerDown);
    document.addEventListener("keydown", handleKeyDown);
    return () => {
      cancelled = true;
      document.removeEventListener("pointerdown", handlePointerDown);
      document.removeEventListener("keydown", handleKeyDown);
      stopCurrentAudio();
    };
  }, []);

  return (
    <>
      <div
        className="font-serif text-[17px] leading-[1.85] text-gray-800"
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
                    ? "border-brand-500 bg-brand-50 text-brand-600 opacity-100"
                    : "border-gray-200 bg-white text-gray-400 hover:border-brand-500 hover:text-brand-600"
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
                      className={`cursor-pointer rounded-sm transition hover:bg-brand-50 ${
                        savedSet.has(normalized) ? "saved-word" : ""
                      }`}
                      key={tokenIndex}
                      onClick={(event) => {
                        event.stopPropagation();
                        openLookup(event.currentTarget as HTMLElement, paragraphIndex, normalized);
                      }}
                      role="button"
                      tabIndex={0}
                      onKeyDown={(event) => {
                        if (event.key === "Enter" || event.key === " ") {
                          event.preventDefault();
                          event.stopPropagation();
                          openLookup(event.currentTarget as HTMLElement, paragraphIndex, normalized);
                        }
                      }}
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
                  translatedSentence=""
                  source={{
                    type: "lectura",
                    storySlug: story.slug,
                    paragraphIndex: activeLookup.paragraphIndex,
                    sentence: paragraph
                  }}
                />
              </div>
            );
          })()
        : null}
    </>
  );
}
