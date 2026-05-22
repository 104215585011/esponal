"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { LookupCard } from "@/app/watch/LookupCard";
import { getPlaybackRate, usePlaybackRate } from "@/lib/playback-rate";
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

type WordTier = "new" | "learning" | "familiar" | "mastered";

function tierForEncounters(count: number): WordTier {
  if (count >= 7) return "mastered";
  if (count >= 3) return "familiar";
  if (count >= 1) return "learning";
  return "new";
}

const TIER_CLASS: Record<WordTier, string> = {
  new: "word-tier-new",
  learning: "word-tier-learning",
  familiar: "word-tier-familiar",
  mastered: "word-tier-mastered"
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
  const [encounterMap, setEncounterMap] = useState<Map<string, number>>(() => new Map());
  const [playbackRate] = usePlaybackRate();
  const containerRef = useRef<HTMLDivElement | null>(null);
  const currentAudioRef = useRef<HTMLAudioElement | null>(null);

  // 倍速实时生效：用户在 Header 改 rate 时，正在播放的段落跟随变化
  useEffect(() => {
    if (currentAudioRef.current) {
      currentAudioRef.current.playbackRate = playbackRate;
    }
  }, [playbackRate]);

  const uniqueTokens = useMemo(() => {
    const set = new Set<string>();
    for (const paragraph of story.paragraphs) {
      for (const part of splitParagraphTokens(paragraph)) {
        const normalized = normalizeLookupWord(part);
        if (normalized) set.add(normalized);
      }
    }
    return Array.from(set);
  }, [story.paragraphs]);

  const tierCounts = useMemo(() => {
    const counts: Record<WordTier, number> = { new: 0, learning: 0, familiar: 0, mastered: 0 };
    for (const token of uniqueTokens) {
      const tier = tierForEncounters(encounterMap.get(token) ?? 0);
      counts[tier]++;
    }
    return counts;
  }, [uniqueTokens, encounterMap]);

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

  useEffect(() => {
    let cancelled = false;

    if (uniqueTokens.length === 0) {
      setEncounterMap(new Map());
    } else {
      fetch("/api/vocab/highlight", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ words: uniqueTokens })
      })
        .then((response) => (response.ok ? response.json() : { items: [] }))
        .then((data: { items?: Array<{ word?: unknown; encounters?: unknown }> }) => {
          if (cancelled || !Array.isArray(data.items)) return;
          const next = new Map<string, number>();
          for (const item of data.items) {
            if (typeof item.word !== "string") continue;
            const key = normalizeLookupWord(item.word);
            if (!key) continue;
            const count = typeof item.encounters === "number" ? item.encounters : 0;
            next.set(key, count);
          }
          setEncounterMap(next);
        })
        .catch(() => {
          if (!cancelled) setEncounterMap(new Map());
        });
    }

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
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [uniqueTokens]);

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

                  const tier = tierForEncounters(encounterMap.get(normalized) ?? 0);

                  return (
                    <span
                      className={`cursor-pointer rounded-sm transition hover:bg-brand-50 ${TIER_CLASS[tier]}`}
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

      <aside
        aria-label="本文词汇统计"
        className="fixed right-8 top-32 z-10 hidden w-56 xl:block"
        data-testid="lectura-sidebar"
      >
        <div className="rounded-lg border border-gray-100 bg-white p-5 shadow-sm">
          <h3 className="text-[11px] font-semibold uppercase tracking-wider text-gray-500">
            本文词汇
          </h3>
          <p className="mt-2 text-2xl font-semibold text-gray-900">
            {uniqueTokens.length}
            <span className="text-base font-normal text-gray-500"> 个词</span>
          </p>

          <ul className="mt-5 space-y-2.5 text-[13px]">
            <li className="flex items-center gap-2">
              <span aria-hidden className="h-2 w-2 rounded-full bg-gray-300" />
              <span className="flex-1 text-gray-600">已掌握</span>
              <span className="font-medium tabular-nums text-gray-900">{tierCounts.mastered}</span>
            </li>
            <li className="flex items-center gap-2">
              <span aria-hidden className="h-2 w-2 rounded-full bg-emerald-500" />
              <span className="flex-1 text-gray-600">熟悉</span>
              <span className="font-medium tabular-nums text-gray-900">{tierCounts.familiar}</span>
            </li>
            <li className="flex items-center gap-2">
              <span aria-hidden className="h-2 w-2 rounded-full bg-blue-500" />
              <span className="flex-1 text-gray-600">学习中</span>
              <span className="font-medium tabular-nums text-gray-900">{tierCounts.learning}</span>
            </li>
            <li className="flex items-center gap-2">
              <span aria-hidden className="h-2 w-2 rounded-full bg-amber-500" />
              <span className="flex-1 text-gray-600">新词</span>
              <span className="font-medium tabular-nums text-gray-900">{tierCounts.new}</span>
            </li>
          </ul>

          <p className="mt-5 border-t border-gray-100 pt-3 text-[11px] leading-relaxed text-gray-400">
            颜色 = 你的熟悉度。<br />
            点任意词查义、加入词库。
          </p>
        </div>
      </aside>

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
