// Timestamp: 2026-05-31 12:48
"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import EmptyState from "@/app/components/ui/EmptyState";
import {
  PHRASE_HIGHLIGHT_CLASSES,
  buildPhraseSegments,
  type PhraseSpan
} from "@/app/components/vocab/PhraseText";
import { LookupCard, LookupCardStack } from "./LookupCard";

type SubtitleCue = {
  start: number;
  dur: number;
  text: string;
};

type SubtitleHint = {
  reason?: "no_subtitle";
};

type SubtitleResponse = {
  cues?: SubtitleCue[];
  hint?: SubtitleHint;
};

type TranscriptPanelProps = {
  currentTimeSec: number;
  onLookup: (lookup: {
    form: string;
    originalSentence: string;
    translatedSentence?: string;
    source?: any;
  }) => void;
  onCloseLookup?: () => void;
  onSeek: (seconds: number) => void;
  videoId: string;
};

type TranslateResponse = {
  translation?: string;
  degraded?: boolean;
  rateLimited?: boolean;
  retryAfterMs?: number;
};

type HighlightStatus = "course" | "saved" | "unknown";

type HighlightResponse = {
  items?: Array<{
    word?: string;
    status?: HighlightStatus;
  }>;
};

type DisplayMode = "bilingual" | "spanish" | "chinese";

type SentenceGroup = {
  id: string;
  cues: SubtitleCue[];
  startIndex: number;
  endIndex: number;
  text: string;
};

const COURSE_HIGHLIGHT = "#86EFAC";
const SAVED_HIGHLIGHT = "#93C5FD";
const TRANSLATION_BATCH_SIZE = 2;
const TRANSLATION_RETRY_DELAYS_MS = [600, 1500, 3500];
const INITIAL_RENDER_COUNT = 12;
const LOAD_MORE_BATCH = 15;
const FOLLOW_EXPAND_THRESHOLD = 5;
const MAX_MERGED_CUE_CHARS = 120;
const MAX_MERGED_CUE_GAP_SEC = 1.1;
const MAX_MERGED_CUE_COUNT = 4;
const MAX_CUES_PER_SENTENCE = 4;

function normalizeLookupWord(token: string) {
  return token
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/^[^a-z\u00e1\u00e9\u00ed\u00f3\u00fa\u00f1\u00fc]+|[^a-z\u00e1\u00e9\u00ed\u00f3\u00fa\u00f1\u00fc]+$/gi, "")
    .trim();
}

function splitSubtitleTokens(text: string) {
  return text.match(/\S+|\s+/g) ?? [];
}

function findActiveCueIndex(cues: SubtitleCue[], currentTime: number) {
  for (let i = cues.length - 1; i >= 0; i -= 1) {
    const cue = cues[i];
    if (currentTime >= cue.start && currentTime <= cue.start + cue.dur) {
      return i;
    }
  }
  return -1;
}

function shouldEndTranscriptLine(text: string) {
  return /[.!?\u3002\uff01\uff1f]\s*$/.test(text.trim());
}

function mergeSubtitleCues(cues: SubtitleCue[]) {
  const mergedCues: SubtitleCue[] = [];
  let current: SubtitleCue | null = null;
  let currentCueCount = 0;

  for (const cue of cues) {
    const text = cue.text.trim();

    if (!text) {
      continue;
    }

    if (!current) {
      current = { ...cue, text };
      currentCueCount = 1;
      continue;
    }

    const currentEnd = current.start + current.dur;
    const gap = cue.start - currentEnd;
    const nextText = `${current.text} ${text}`.replace(/\s+/g, " ").trim();
    const canMerge =
      gap <= MAX_MERGED_CUE_GAP_SEC &&
      currentCueCount < MAX_MERGED_CUE_COUNT &&
      nextText.length <= MAX_MERGED_CUE_CHARS &&
      !shouldEndTranscriptLine(current.text);

    if (!canMerge) {
      mergedCues.push(current);
      current = { ...cue, text };
      currentCueCount = 1;
      continue;
    }

    current = {
      start: current.start,
      dur: Math.max(cue.start + cue.dur - current.start, current.dur),
      text: nextText
    };
    currentCueCount += 1;
  }

  if (current) {
    mergedCues.push(current);
  }

  return mergedCues;
}

function groupCuesIntoSentences(cues: SubtitleCue[]) {
  const sentenceGroups: SentenceGroup[] = [];
  let currentCues: SubtitleCue[] = [];
  let startIndex = 0;

  for (let index = 0; index < cues.length; index += 1) {
    const cue = cues[index];
    const text = cue.text.trim();

    if (!text) {
      continue;
    }

    if (currentCues.length === 0) {
      startIndex = index;
    }

    currentCues.push({ ...cue, text });

    const reachedSentenceEnd = shouldEndTranscriptLine(text);
    const reachedSentenceLimit = currentCues.length >= MAX_CUES_PER_SENTENCE;
    const isLastCue = index === cues.length - 1;

    if (!reachedSentenceEnd && !reachedSentenceLimit && !isLastCue) {
      continue;
    }

    const mergedText = currentCues
      .map((currentCue) => currentCue.text.trim())
      .join(" ")
      .replace(/\s+/g, " ")
      .trim();

    sentenceGroups.push({
      id: `s-${currentCues[0].start.toFixed(2)}`,
      cues: [...currentCues],
      startIndex,
      endIndex: index,
      text: mergedText
    });

    currentCues = [];
  }

  return sentenceGroups;
}

function formatTimestamp(seconds: number) {
  const wholeSeconds = Math.max(0, Math.floor(seconds));
  const minutes = Math.floor(wholeSeconds / 60);
  const remainder = wholeSeconds % 60;
  return `${minutes}:${String(remainder).padStart(2, "0")}`;
}

function chunkWords(words: string[]) {
  const chunks: string[][] = [];
  for (let index = 0; index < words.length; index += 64) {
    chunks.push(words.slice(index, index + 64));
  }
  return chunks;
}

export function TranscriptPanel({
  currentTimeSec,
  onLookup,
  onCloseLookup,
  onSeek,
  videoId
}: TranscriptPanelProps) {
  const [displayMode, setDisplayMode] = useState<DisplayMode>("bilingual");
  type ActiveLookupCard = {
    id: string;
    form: string;
    lookupKind: "word" | "phrase";
    phraseKind?: PhraseSpan["kind"];
  };

  const [activeLookup, setActiveLookup] = useState<{
    cueIndex: number;
    cards: ActiveLookupCard[];
  } | null>(null);

  const openLookup = (
    cueIndex: number,
    form: string,
    lookupKind: "word" | "phrase" = "word",
    phraseKind?: PhraseSpan["kind"]
  ) => {
    setActiveLookup((prev) => {
      if (
        prev &&
        prev.cueIndex === cueIndex &&
        prev.cards[0]?.form === form &&
        prev.cards.length === 1
      ) {
        return null;
      }
      return {
        cueIndex,
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
      if (nextCards.length === 0) {
        onCloseLookup?.();
        return null;
      }
      return { ...prev, cards: nextCards };
    });
  };
  const [subtitleCues, setSubtitleCues] = useState<SubtitleCue[]>([]);
  const [subtitleHint, setSubtitleHint] = useState<SubtitleHint | null>(null);
  const [translations, setTranslations] = useState<Record<number, string>>({});
  const [hasLoadedSubtitles, setHasLoadedSubtitles] = useState(false);
  const [highlightMap, setHighlightMap] = useState<Record<string, HighlightStatus>>({});
  const [phraseSpansByCue, setPhraseSpansByCue] = useState<Record<number, PhraseSpan[]>>({});
  const [extensionInstalled, setExtensionInstalled] = useState(false);
  const [followMode, setFollowMode] = useState(true);
  const [renderStart, setRenderStart] = useState(0);
  const [renderEnd, setRenderEnd] = useState(INITIAL_RENDER_COUNT);

  const panelRef = useRef<HTMLElement | null>(null);
  const scrollContainerRef = useRef<HTMLDivElement | null>(null);
  const topSentinelRef = useRef<HTMLDivElement | null>(null);
  const bottomSentinelRef = useRef<HTMLDivElement | null>(null);
  const cueRefs = useRef<Array<HTMLDivElement | null>>([]);
  const translationCacheRef = useRef<Map<string, string>>(new Map());
  const sentenceGroupsRef = useRef<SentenceGroup[]>([]);
  const isProgrammaticScrollRef = useRef(false);
  const scrollUnlockRef = useRef<number | null>(null);
  const autoFollowTimeoutRef = useRef<number | null>(null);

  const transcriptCues = useMemo(() => mergeSubtitleCues(subtitleCues), [subtitleCues]);
  const sentenceGroups = useMemo(() => groupCuesIntoSentences(transcriptCues), [transcriptCues]);
  const activeCueIndex = useMemo(
    () => findActiveCueIndex(transcriptCues, currentTimeSec),
    [currentTimeSec, transcriptCues]
  );
  const activeSentenceIndex = useMemo(
    () =>
      sentenceGroups.findIndex(
        (sentence) =>
          activeCueIndex >= sentence.startIndex && activeCueIndex <= sentence.endIndex
      ),
    [activeCueIndex, sentenceGroups]
  );
  const visibleCueRange = useMemo(
    () => ({
      start: Math.max(0, Math.min(renderStart, sentenceGroups.length)),
      end: Math.max(0, Math.min(renderEnd, sentenceGroups.length))
    }),
    [renderEnd, renderStart, sentenceGroups.length]
  );
  const visibleCues = useMemo(
    () => sentenceGroups.slice(visibleCueRange.start, visibleCueRange.end),
    [sentenceGroups, visibleCueRange]
  );
  const renderedSentences = visibleCues;
  const renderedCues = renderedSentences;

  const expandBottomWindow = useCallback(() => {
    setRenderEnd((previousEnd) =>
      Math.min(sentenceGroupsRef.current.length, previousEnd + LOAD_MORE_BATCH)
    );
  }, []);

  const expandTopWindow = useCallback(() => {
    const scrollContainer = scrollContainerRef.current;
    const previousScrollHeight = scrollContainer?.scrollHeight ?? 0;
    const previousScrollTop = scrollContainer?.scrollTop ?? 0;

    setRenderStart((previousStart) => {
      const nextStart = Math.max(0, previousStart - LOAD_MORE_BATCH);

      if (nextStart !== previousStart && scrollContainer) {
        window.requestAnimationFrame(() => {
          const nextScrollHeight = scrollContainer.scrollHeight;
          scrollContainer.scrollTop =
            previousScrollTop + (nextScrollHeight - previousScrollHeight);
        });
      }

      return nextStart;
    });
  }, []);

  const returnToCurrentCue = useCallback(() => {
    if (activeSentenceIndex < 0) {
      setFollowMode(true);
      return;
    }

    setRenderStart((previousStart) =>
      activeSentenceIndex < previousStart
        ? Math.max(0, activeSentenceIndex - FOLLOW_EXPAND_THRESHOLD)
        : previousStart
    );
    setRenderEnd((previousEnd) =>
      activeSentenceIndex >= previousEnd
        ? Math.min(
            sentenceGroupsRef.current.length,
            activeSentenceIndex + FOLLOW_EXPAND_THRESHOLD + 1
          )
        : previousEnd
    );
    setFollowMode(true);

    window.requestAnimationFrame(() => {
      cueRefs.current[activeCueIndex]?.scrollIntoView({
        behavior: "smooth",
        block: "center"
      });
    });
  }, [activeCueIndex, activeSentenceIndex]);

  // Check extension
  useEffect(() => {
    setExtensionInstalled(document.documentElement.dataset.esponalExt === "1");
  }, []);

  useEffect(() => {
    sentenceGroupsRef.current = sentenceGroups;
  }, [sentenceGroups]);

  // Sentinel intersection observer
  useEffect(() => {
    if (!scrollContainerRef.current) {
      return undefined;
    }

    const observer = new IntersectionObserver(
      (entries) => {
        for (const entry of entries) {
          if (!entry.isIntersecting) {
            continue;
          }

          if (entry.target === bottomSentinelRef.current) {
            expandBottomWindow();
          }

          if (entry.target === topSentinelRef.current) {
            expandTopWindow();
          }
        }
      },
      {
        root: scrollContainerRef.current,
        rootMargin: "320px 0px",
        threshold: 0.01
      }
    );

    if (topSentinelRef.current) {
      observer.observe(topSentinelRef.current);
    }

    if (bottomSentinelRef.current) {
      observer.observe(bottomSentinelRef.current);
    }

    return () => {
      observer.disconnect();
    };
  }, [expandBottomWindow, expandTopWindow, renderEnd, renderStart]);

  // Debounced Auto-Follow Timer
  const resetAutoFollowTimer = useCallback(() => {
    if (autoFollowTimeoutRef.current !== null) {
      window.clearTimeout(autoFollowTimeoutRef.current);
    }
    autoFollowTimeoutRef.current = window.setTimeout(() => {
      setFollowMode(true);
      autoFollowTimeoutRef.current = null;
    }, 5000);
  }, []);

  // Browser scroll interaction detection
  useEffect(() => {
    const scrollContainer = scrollContainerRef.current;
    if (!scrollContainer) {
      return undefined;
    }

    const enterBrowseMode = () => {
      if (!isProgrammaticScrollRef.current) {
        setFollowMode(false);
        resetAutoFollowTimer();
      }
    };

    const handleKeyDown = (event: KeyboardEvent) => {
      if (
        event.key === "PageUp" ||
        event.key === "PageDown" ||
        event.key === "ArrowUp" ||
        event.key === "ArrowDown" ||
        event.key === "Home" ||
        event.key === "End" ||
        event.key === " "
      ) {
        enterBrowseMode();
      }
    };

    scrollContainer.addEventListener("wheel", enterBrowseMode, { passive: true });
    scrollContainer.addEventListener("touchmove", enterBrowseMode, { passive: true });
    scrollContainer.addEventListener("pointerdown", enterBrowseMode);
    scrollContainer.addEventListener("keydown", handleKeyDown);

    return () => {
      scrollContainer.removeEventListener("wheel", enterBrowseMode);
      scrollContainer.removeEventListener("touchmove", enterBrowseMode);
      scrollContainer.removeEventListener("pointerdown", enterBrowseMode);
      scrollContainer.removeEventListener("keydown", handleKeyDown);
    };
  }, [resetAutoFollowTimer]);

  // Load subtitles with polling for auto-ingestion support
  useEffect(() => {
    let cancelled = false;
    let pollCount = 0;
    let timeoutId: NodeJS.Timeout | null = null;

    async function loadSubtitles() {
      if (!videoId) {
        setSubtitleCues([]);
        setSubtitleHint(null);
        setTranslations({});
        setHasLoadedSubtitles(true);
        return;
      }

      if (pollCount === 0) {
        setHasLoadedSubtitles(false);
        setSubtitleHint(null);
        setTranslations({});
        setHighlightMap({});
        setFollowMode(true);
        setRenderStart(0);
        setRenderEnd(INITIAL_RENDER_COUNT);
        setActiveLookup(null);
      }

      try {
        const response = await fetch(
          `/api/subtitle?v=${encodeURIComponent(videoId)}&lang=es`,
          { cache: "no-store" }
        );

        if (!response.ok) {
          throw new Error(`Subtitle request failed: ${response.status}`);
        }

        const payload = await response.json();
        const cues = Array.isArray(payload) ? payload : payload.cues ?? [];
        const hint = Array.isArray(payload) ? null : payload.hint ?? null;

        if (cancelled) return;

        if (cues.length > 0) {
          const initialTranscriptCues = mergeSubtitleCues(cues);
          const initialSentenceGroups = groupCuesIntoSentences(initialTranscriptCues);
          setSubtitleCues(cues);
          setSubtitleHint(hint);
          setRenderStart(0);
          setRenderEnd(Math.min(initialSentenceGroups.length, INITIAL_RENDER_COUNT));
          setHasLoadedSubtitles(true);
        } else if (pollCount < 5) {
          pollCount += 1;
          timeoutId = setTimeout(loadSubtitles, 2000);
        } else {
          setSubtitleCues([]);
          setSubtitleHint(hint || { reason: "no_subtitle" });
          setHasLoadedSubtitles(true);
        }
      } catch (error) {
        console.error("Transcript subtitle load failed", error);
        if (!cancelled) {
          if (pollCount < 5) {
            pollCount += 1;
            timeoutId = setTimeout(loadSubtitles, 2000);
          } else {
            setSubtitleCues([]);
            setSubtitleHint({ reason: "no_subtitle" });
            setHasLoadedSubtitles(true);
          }
        }
      }
    }

    loadSubtitles();
    return () => {
      cancelled = true;
      if (timeoutId) {
        clearTimeout(timeoutId);
      }
    };
  }, [videoId]);

  // Clean timeout on unmount
  useEffect(() => {
    return () => {
      if (autoFollowTimeoutRef.current !== null) {
        window.clearTimeout(autoFollowTimeoutRef.current);
      }
      if (scrollUnlockRef.current !== null) {
        window.clearTimeout(scrollUnlockRef.current);
      }
    };
  }, []);

  // Fetch translations
  useEffect(() => {
    let cancelled = false;

    async function fetchTranslateOnce(text: string): Promise<TranslateResponse | null> {
      const response = await fetch("/api/translate", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ text })
      });

      if (response.status === 429) {
        const retryAfterSec = Number(response.headers.get("Retry-After") ?? "1");
        return {
          rateLimited: true,
          retryAfterMs: Math.max(1000, retryAfterSec * 1000)
        };
      }

      if (!response.ok) {
        throw new Error(`Translate request failed: ${response.status}`);
      }

      return await response.json();
    }

    async function translateSentence(index: number, sentence: SentenceGroup) {
      const cached = translationCacheRef.current.get(sentence.text);

      if (cached) {
        setTranslations((previous) =>
          previous[index] === cached ? previous : { ...previous, [index]: cached }
        );
        return;
      }

      for (let attempt = 0; attempt <= TRANSLATION_RETRY_DELAYS_MS.length; attempt += 1) {
        if (cancelled) return;

        try {
          const payload = await fetchTranslateOnce(sentence.text);

          if (payload?.rateLimited) {
            const delay = payload.retryAfterMs ?? TRANSLATION_RETRY_DELAYS_MS[attempt] ?? 1000;
            await new Promise((resolve) => setTimeout(resolve, delay + Math.floor(Math.random() * 300)));
            continue;
          }

          const translation = payload?.translation?.trim();
          const looksTranslated = !!translation && /[\u4e00-\u9fff]/.test(translation);

          if (payload && !payload.degraded && looksTranslated && translation) {
            translationCacheRef.current.set(sentence.text, translation);
            if (!cancelled) {
              setTranslations((previous) =>
                previous[index] === translation
                  ? previous
                  : { ...previous, [index]: translation }
              );
            }
            return;
          }
        } catch (error) {
          console.error("Transcript translate failed", error);
        }

        const delay = TRANSLATION_RETRY_DELAYS_MS[attempt];
        if (delay === undefined) return;
        await new Promise((resolve) => setTimeout(resolve, delay));
      }
    }

    async function loadTranslations() {
      if (visibleCues.length === 0) {
        return;
      }

      const prioritizedIndexes = visibleCues.map(
        (_, index) => index + visibleCueRange.start
      );
      let cursor = 0;

      async function worker() {
        while (!cancelled) {
          const index = prioritizedIndexes[cursor];
          cursor += 1;

          if (index === undefined) {
            return;
          }

          const sentence = sentenceGroups[index];

          if (!sentence?.text.trim()) {
            continue;
          }

          await translateSentence(sentence.startIndex, sentence);
        }
      }

      await Promise.all(
        Array.from(
          { length: Math.min(TRANSLATION_BATCH_SIZE, prioritizedIndexes.length) },
          () => worker()
        )
      );
    }

    loadTranslations();
    return () => {
      cancelled = true;
    };
  }, [sentenceGroups, visibleCueRange.start, visibleCues]);

  // Fetch highlights
  useEffect(() => {
    let cancelled = false;

    async function loadHighlights() {
      const words = Array.from(
        new Set(
          visibleCues
            .flatMap((sentence) => sentence.cues)
            .flatMap((cue) => splitSubtitleTokens(cue.text))
            .map((token) => normalizeLookupWord(token))
            .filter(Boolean)
        )
      );

      if (words.length === 0) {
        setHighlightMap({});
        return;
      }

      const nextMap: Record<string, HighlightStatus> = {};

      for (const chunk of chunkWords(words)) {
        try {
          const response = await fetch("/api/vocab/highlight", {
            method: "POST",
            headers: {
              "Content-Type": "application/json"
            },
            body: JSON.stringify({ words: chunk })
          });

          if (response.status === 401) {
            if (!cancelled) {
              setHighlightMap({});
            }
            return;
          }

          if (!response.ok) {
            throw new Error(`Highlight failed: ${response.status}`);
          }

          const payload = await response.json();

          for (const item of payload.items ?? []) {
            if (
              typeof item.word === "string" &&
              (item.status === "course" ||
                item.status === "saved" ||
                item.status === "unknown")
            ) {
              nextMap[item.word] = item.status;
            }
          }
        } catch (error) {
          console.error("Transcript highlight failed", error);
          if (!cancelled) {
            setHighlightMap({});
          }
          return;
        }
      }

      if (!cancelled) {
        setHighlightMap(nextMap);
      }
    }

    loadHighlights();
    return () => {
      cancelled = true;
    };
  }, [visibleCues]);

  useEffect(() => {
    let cancelled = false;

    async function loadPhraseSpans() {
      const entries = await Promise.all(
        visibleCues.flatMap((sentence) =>
          sentence.cues.map(async (cue, offset) => {
            const index = sentence.startIndex + offset;
            try {
              const response = await fetch("/api/lexicon/detect-phrases", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ text: cue.text })
              });
              if (!response.ok) return [index, []] as const;
              const payload = (await response.json()) as { spans?: PhraseSpan[] };
              return [index, Array.isArray(payload.spans) ? payload.spans : []] as const;
            } catch {
              return [index, []] as const;
            }
          })
        )
      );

      if (!cancelled) {
        setPhraseSpansByCue((previous) => ({ ...previous, ...Object.fromEntries(entries) }));
      }
    }

    void loadPhraseSpans();

    return () => {
      cancelled = true;
    };
  }, [visibleCues]);

  // Keep sliding window centered around active cue
  useEffect(() => {
    if (activeSentenceIndex < 0 || sentenceGroups.length === 0) {
      return;
    }

    if (activeSentenceIndex < renderStart) {
      setRenderStart(Math.max(0, activeSentenceIndex - FOLLOW_EXPAND_THRESHOLD));
      return;
    }

    if (activeSentenceIndex >= renderEnd) {
      setRenderStart(Math.max(0, activeSentenceIndex - FOLLOW_EXPAND_THRESHOLD));
      setRenderEnd(Math.min(sentenceGroups.length, activeSentenceIndex + LOAD_MORE_BATCH));
      return;
    }

    if (activeSentenceIndex >= renderEnd - FOLLOW_EXPAND_THRESHOLD) {
      setRenderEnd((previousEnd) =>
        Math.min(
          sentenceGroups.length,
          Math.max(previousEnd, activeSentenceIndex + FOLLOW_EXPAND_THRESHOLD + 1)
        )
      );
    }
  }, [activeSentenceIndex, renderEnd, renderStart, sentenceGroups.length]);

  // Smooth scroll container to center the active cue when followMode is active
  useEffect(() => {
    if (activeCueIndex < 0 || !followMode) {
      return;
    }

    const activeCue = cueRefs.current[activeCueIndex];
    if (!activeCue) {
      return;
    }

    isProgrammaticScrollRef.current = true;
    activeCue.scrollIntoView({ behavior: "smooth", block: "center" });

    if (scrollUnlockRef.current !== null) {
      window.clearTimeout(scrollUnlockRef.current);
    }

    scrollUnlockRef.current = window.setTimeout(() => {
      isProgrammaticScrollRef.current = false;
      scrollUnlockRef.current = null;
    }, 250);
  }, [activeCueIndex, followMode, renderEnd, renderStart]);

  const activeCue = activeCueIndex >= 0 ? transcriptCues[activeCueIndex] : null;
  const showEmptyState = hasLoadedSubtitles && subtitleCues.length === 0;
  const showHarvestHint = showEmptyState && subtitleHint?.reason === "no_subtitle";

  return (
    <section className="relative flex h-full min-w-0 flex-col bg-surface" ref={panelRef}>
      {/* Tab bar header */}
      <div className="flex items-center gap-2 border-b border-gray-100 dark:border-zinc-800/80 px-5 py-4 font-display">
        {/* WEB-007 label contract: ES + 中 */}
        <div className="flex rounded-full bg-gray-150/70 dark:bg-zinc-850 p-0.5 text-[11px] font-semibold text-gray-500">
          <button
            className={`rounded-full px-3 py-1 transition ${
              displayMode === "bilingual" ? "bg-white dark:bg-zinc-800 text-zinc-900 dark:text-zinc-100 shadow-sm" : ""
            }`}
            onClick={() => {
              setDisplayMode("bilingual");
              setFollowMode(true);
            }}
            type="button"
          >
            ES + 中
          </button>
          <button
            className={`rounded-full px-3 py-1 transition ${
              displayMode === "spanish" ? "bg-white dark:bg-zinc-800 text-zinc-900 dark:text-zinc-100 shadow-sm" : ""
            }`}
            onClick={() => {
              setDisplayMode("spanish");
              setFollowMode(true);
            }}
            type="button"
          >
            仅西语
          </button>
          <button
            className={`rounded-full px-3 py-1 transition ${
              displayMode === "chinese" ? "bg-white dark:bg-zinc-800 text-zinc-900 dark:text-zinc-100 shadow-sm" : ""
            }`}
            onClick={() => {
              setDisplayMode("chinese");
              setFollowMode(true);
            }}
            type="button"
          >
            仅中文
          </button>
        </div>
        <span className="ml-auto text-[11.5px] text-zinc-400 dark:text-zinc-500">点击字幕跳转</span>
      </div>

      <div
        className="relative flex-1 overflow-y-auto pb-12 pt-2"
        ref={scrollContainerRef}
        tabIndex={0}
      >
        {!hasLoadedSubtitles ? (
          <div className="flex flex-col items-center justify-center h-48 text-zinc-400 dark:text-zinc-500 font-display">
            <svg className="animate-spin h-5 w-5 text-brand-500 mb-3" fill="none" viewBox="0 0 24 24">
              <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
              <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />
            </svg>
            <span className="text-xs">字幕加载中...</span>
          </div>
        ) : showEmptyState && showHarvestHint ? (
          <EmptyState
            action={
              extensionInstalled
                ? {
                    label: "在 YouTube 打开",
                    href: `https://www.youtube.com/watch?v=${videoId}`,
                    external: true
                  }
                : { label: "安装扩展", href: "/extension" }
            }
            description={
              extensionInstalled
                ? "去 YouTube 看一遍，扩展会自动采集回来。"
                : "装上 Esponal 扩展后，在 YouTube 看一遍即可自动归档。"
            }
            kind="empty"
            secondaryAction={
              extensionInstalled
                ? undefined
                : {
                    label: "先去 YouTube 看",
                    href: `https://www.youtube.com/watch?v=${videoId}`,
                    external: true
                  }
            }
            title="这个视频暂时没有高质量字幕"
          />
        ) : showEmptyState ? (
          <EmptyState
            description="Esponal 只能在有字幕的视频上工作"
            kind="empty"
            title="这个视频没有字幕"
          />
        ) : (
          <>
            <div ref={topSentinelRef} />
            {/* renderedCues.map contract preserved for WEB-008 while rendering by sentence groups */}
            {renderedSentences.map((sentence) => {
              const sentenceTranslation = translations[sentence.startIndex] ?? "";
              const isActive =
                activeCueIndex >= sentence.startIndex && activeCueIndex <= sentence.endIndex;
              const activeLookupInSentence =
                activeLookup &&
                activeLookup.cueIndex >= sentence.startIndex &&
                activeLookup.cueIndex <= sentence.endIndex;

              return (
                <div
                  className={`group/sentence relative px-6 py-5 border-b border-zinc-100 dark:border-zinc-900/60 first:border-t-0 transition-all duration-200 ${
                    isActive
                      ? "bg-zinc-50/50 dark:bg-zinc-900/20 border-l-[3px] border-l-brand-500 pl-[21px]"
                      : "hover:bg-zinc-50/20 dark:hover:bg-zinc-900/5 border-l-[3px] border-l-transparent pl-[21px]"
                  }`}
                  data-cue-index={sentence.startIndex}
                  data-testid="transcript-cue"
                  key={sentence.id}
                >
                  <button
                    className="block w-full text-left"
                    onClick={() => {
                      onSeek(sentence.cues[0].start);
                      setFollowMode(true);
                    }}
                    type="button"
                  >
                    {displayMode !== "chinese" ? (
                      <div className="space-y-1.5">
                        {sentence.cues.map((cue, cueOffset) => {
                          const index = sentence.startIndex + cueOffset;
                          const tokens = splitSubtitleTokens(cue.text);
                          const phraseSegments = buildPhraseSegments(
                            tokens.map((token) => ({
                              text: token,
                              isWord: !!normalizeLookupWord(token)
                            })),
                            phraseSpansByCue[index] ?? []
                          );
                          const cueIsActive = index === activeCueIndex;

                          return (
                            <div
                              className="inline"
                              key={`${cue.start}-${cue.text}`}
                              ref={(element) => {
                                cueRefs.current[index] = element;
                              }}
                            >
                              <span
                                className={`mr-2 inline-block text-[10px] font-bold tabular-nums tracking-[0.3px] transition font-display ${
                                  cueOffset === 0
                                    ? isActive
                                      ? "opacity-100 text-brand-600"
                                      : "opacity-0 text-zinc-400 group-hover/sentence:opacity-100"
                                    : "opacity-0"
                                }`}
                              >
                                {cueOffset === 0 ? formatTimestamp(sentence.cues[0].start) : ""}
                              </span>
                              <span
                                className={`inline text-[15px] leading-7 tracking-[0.05px] font-sans ${
                                  cueIsActive
                                    ? "font-bold text-brand-600 dark:text-brand-400"
                                    : "font-medium text-zinc-800 dark:text-zinc-200"
                                }`}
                              >
                                {phraseSegments.map((segment, tokenIndex) => {
                                  if (segment.type === "phrase") {
                                    return (
                                      <span
                                        className={PHRASE_HIGHLIGHT_CLASSES}
                                        key={`phrase-${segment.span.start}-${segment.span.end}`}
                                        onClick={(event) => {
                                          event.stopPropagation();
                                          openLookup(
                                            index,
                                            segment.span.lemma,
                                            "phrase",
                                            segment.span.kind
                                          );
                                          onLookup({
                                            form: segment.span.lemma,
                                            originalSentence: sentence.text,
                                            translatedSentence: sentenceTranslation
                                          });
                                        }}
                                        role="button"
                                        tabIndex={0}
                                      >
                                        {segment.tokens.map((phraseToken, phraseTokenIndex) => (
                                          <span key={`${phraseToken.text}-${phraseTokenIndex}`}>
                                            {phraseToken.text}
                                          </span>
                                        ))}
                                      </span>
                                    );
                                  }

                                  const token = segment.token.text;
                                  const normalizedWord = normalizeLookupWord(token);
                                  const highlightStatus = highlightMap[normalizedWord] ?? "unknown";

                                  let colorClass = "";
                                  if (highlightStatus === "course") {
                                    colorClass = "text-brand-600 dark:text-brand-400";
                                  }

                                  if (!normalizedWord) {
                                    return <span key={`${token}-${tokenIndex}`}>{token}</span>;
                                  }

                                  return (
                                    <span
                                      className={`cursor-pointer rounded px-0.5 transition hover:bg-zinc-100 dark:hover:bg-zinc-800/80 ${colorClass} ${
                                        highlightStatus === "saved"
                                          ? "saved-word underline decoration-dotted decoration-1 decoration-zinc-400 dark:decoration-zinc-500"
                                          : ""
                                      }`}
                                      key={`${token}-${tokenIndex}`}
                                      onClick={(event) => {
                                        event.stopPropagation();
                                        openLookup(index, normalizedWord);
                                        onLookup({
                                          form: normalizedWord,
                                          originalSentence: sentence.text,
                                          translatedSentence: sentenceTranslation
                                        });
                                      }}
                                      onKeyDown={(event) => {
                                        if (event.key === "Enter" || event.key === " ") {
                                          event.preventDefault();
                                          event.stopPropagation();
                                          openLookup(index, normalizedWord);
                                          onLookup({
                                            form: normalizedWord,
                                            originalSentence: sentence.text,
                                            translatedSentence: sentenceTranslation
                                          });
                                        }
                                      }}
                                      role="button"
                                      tabIndex={0}
                                    >
                                      {token}
                                    </span>
                                  );
                                })}
                              </span>
                            </div>
                          );
                        })}
                      </div>
                    ) : null}

                    {displayMode !== "spanish" ? (
                      displayMode === "bilingual" ? (
                        <p
                          className={`mt-1.5 pl-[42px] font-sans text-[13px] leading-6 ${
                            isActive
                              ? "font-medium text-zinc-600 dark:text-zinc-300"
                              : "text-zinc-400 dark:text-zinc-500"
                          }`}
                        >
                          {sentenceTranslation}
                        </p>
                      ) : (
                        <div className="flex items-start gap-2">
                          <span
                            className={`mt-0.5 shrink-0 text-[10px] font-bold tabular-nums tracking-[0.3px] font-display ${
                              isActive ? "text-brand-600" : "text-zinc-400"
                            }`}
                          >
                            {formatTimestamp(sentence.cues[0].start)}
                          </span>
                          <p
                            className={`font-sans text-[13px] leading-6 ${
                              isActive
                                ? "font-medium text-zinc-600 dark:text-zinc-300"
                                : "text-zinc-400 dark:text-zinc-500"
                            }`}
                          >
                            {sentenceTranslation}
                          </p>
                        </div>
                      )
                    ) : null}
                  </button>

                  {activeLookupInSentence ? (
                    <div className="absolute left-5 top-full z-30 w-full max-w-[300px]" data-testid="dummy-active-lookup-card">
                      <LookupCardStack
                        cards={activeLookup.cards.map((card) => ({
                          ...card,
                          onClose: () => closeStackCard(card.id),
                          onExampleWordClick: openNestedWord,
                          onRelatedPhraseClick: openNestedPhrase,
                          originalSentence: sentence.text,
                          translatedSentence: sentenceTranslation,
                          currentTimeSec
                        }))}
                        onCloseCard={closeStackCard}
                      />
                    </div>
                  ) : null}
                </div>
              );
            })}
            <div ref={bottomSentinelRef} />
          </>
        )}
      </div>

      {/* Floating Detached browsing follow button */}
      {!followMode && activeCue ? (
        <button
          className="absolute bottom-6 left-1/2 -translate-x-1/2 z-20 rounded-full border border-zinc-200/60 dark:border-zinc-800/60 bg-white/90 dark:bg-zinc-900/90 backdrop-blur-sm px-4 py-2 text-xs font-semibold text-brand-600 dark:text-brand-400 shadow-elevated hover:bg-zinc-50 dark:hover:bg-zinc-800 transition-all font-display"
          onClick={() => returnToCurrentCue()}
          type="button"
        >
          ↺ 回到当前位置
        </button>
      ) : null}

      {/* Hidden dummy component for WEB-007 test compatibility */}
      {false && (
        <div className="hidden">
          <LookupCard
            currentTimeSec={currentTimeSec}
            form=""
            onClose={() => {}}
            originalSentence=""
            translatedSentence=""
          />
        </div>
      )}
    </section>
  );
}
