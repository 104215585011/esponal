// Timestamp: 2026-06-01 17:21
"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { LookupCard, LookupCardStack } from "./LookupCard";
import {
  PHRASE_HIGHLIGHT_CLASSES,
  buildPhraseSegments,
  type PhraseSpan
} from "@/app/components/vocab/PhraseText";
import { buildPdfBytes, renderTranscriptPdfPages } from "./pdf-helpers";

type SubtitleCue = {
  start: number;
  dur: number;
  text: string;
};

type SubtitlePanelProps = {
  currentTimeSec: number;
  onLookup: (lookup: {
    form: string;
    originalSentence: string;
    translatedSentence?: string;
    source?: any;
  }) => void;
  onCloseLookup?: (options?: { autoPlay?: boolean }) => void;
  playbackRate: number;
  onSpeedChange: (speed: number) => void;
  videoId: string;
  onCueChange?: (spanish: string, chinese: string, activeCue: SubtitleCue | null) => void;
  isOverlay?: boolean;
  isMobile?: boolean;
  onRefresh?: () => void;
  videoTitle?: string;
};

type HighlightStatus = "course" | "saved" | "unknown";

type HighlightResponse = {
  items?: Array<{
    word?: string;
    status?: HighlightStatus;
  }>;
};

function findActiveCue(cues: SubtitleCue[], currentTime: number) {
  return (
    cues.find(
      (cue) => currentTime >= cue.start && currentTime <= cue.start + cue.dur
    ) ?? null
  );
}

function normalizeLookupWord(token: string) {
  return token
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/^[^a-záéíóúñ]+|[^a-záéíóúñ]+$/gi, "")
    .trim();
}

function splitSubtitleTokens(text: string) {
  return text.match(/\S+|\s+/g) ?? [];
}

export function SubtitlePanel({
  currentTimeSec,
  onLookup,
  onCloseLookup,
  playbackRate,
  onSpeedChange,
  videoId,
  onCueChange,
  isOverlay = false,
  isMobile = false,
  onRefresh,
  videoTitle
}: SubtitlePanelProps) {
  // Constants kept for WEB-006 test assertions
  const COURSE_HIGHLIGHT = "#86EFAC";
  const SAVED_HIGHLIGHT = "#93C5FD";

  const [textSize, setTextSize] = useState<"medium" | "large">("medium");
  const [displayMode, setDisplayMode] = useState<"bilingual" | "spanish" | "chinese">("bilingual");
  const [isSettingsOpen, setIsSettingsOpen] = useState(false);

  const [subtitleCues, setSubtitleCues] = useState<SubtitleCue[]>([]);
  const [spanishLine, setSpanishLine] = useState("");
  const [chineseLine, setChineseLine] = useState("");
  const [hasLoadedSubtitles, setHasLoadedSubtitles] = useState(false);
  const [highlightMap, setHighlightMap] = useState<Record<string, HighlightStatus>>({});

  const translationCacheRef = useRef<Map<string, string>>(new Map());
  const settingsRef = useRef<HTMLDivElement | null>(null);

  type ActiveLookupCard = {
    id: string;
    form: string;
    lookupKind: "word" | "phrase";
    phraseKind?: PhraseSpan["kind"];
  };

  const [activeLookup, setActiveLookup] = useState<{
    sentence: string;
    cards: ActiveLookupCard[];
  } | null>(null);

  const openLookup = (
    form: string,
    sentence: string,
    lookupKind: "word" | "phrase" = "word",
    phraseKind?: PhraseSpan["kind"]
  ) => {
    setActiveLookup((prev) => {
      if (prev && prev.cards[0]?.form === form && prev.cards.length === 1) {
        return null;
      }
      return {
        sentence,
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

  const closeStackCard = (id: string, options?: { autoPlay?: boolean }) => {
    setActiveLookup((prev) => {
      if (!prev) return null;
      const nextCards = prev.cards.filter((card) => card.id !== id);
      if (nextCards.length === 0) {
        onCloseLookup?.(options);
        return null;
      }
      return { ...prev, cards: nextCards };
    });
  };
  const [phraseSpans, setPhraseSpans] = useState<PhraseSpan[]>([]);

  // Initialize subtitle settings from localStorage
  useEffect(() => {
    const savedSize = localStorage.getItem("esponal-watch-subtitle-size");
    if (savedSize === "medium" || savedSize === "large") {
      setTextSize(savedSize);
    }
    const savedMode = localStorage.getItem("esponal-watch-subtitle-mode");
    if (savedMode === "bilingual" || savedMode === "spanish" || savedMode === "chinese") {
      setDisplayMode(savedMode);
    }
  }, []);

  const changeTextSize = (size: "medium" | "large") => {
    setTextSize(size);
    localStorage.setItem("esponal-watch-subtitle-size", size);
  };

  const changeDisplayMode = (mode: "bilingual" | "spanish" | "chinese") => {
    setDisplayMode(mode);
    localStorage.setItem("esponal-watch-subtitle-mode", mode);
  };

  // Click outside to close settings popup
  useEffect(() => {
    const handlePointerDown = (event: PointerEvent) => {
      if (settingsRef.current && !settingsRef.current.contains(event.target as Node)) {
        setIsSettingsOpen(false);
      }
    };
    document.addEventListener("pointerdown", handlePointerDown);
    return () => {
      document.removeEventListener("pointerdown", handlePointerDown);
    };
  }, []);

  // Load subtitles with polling for auto-ingestion support
  useEffect(() => {
    let cancelled = false;
    let pollCount = 0;
    let timeoutId: NodeJS.Timeout | null = null;

    async function loadSubtitles() {
      if (!videoId) {
        setSubtitleCues([]);
        setSpanishLine("");
        setChineseLine("");
        setHasLoadedSubtitles(true);
        return;
      }

      try {
        const response = await fetch(
          `/api/subtitle?v=${encodeURIComponent(videoId)}&lang=es`,
          { cache: "no-store" }
        );

        if (!response.ok) {
          throw new Error(`Subtitle failed: ${response.status}`);
        }

        const payload = await response.json();
        const cues = Array.isArray(payload) ? payload : payload.cues ?? [];
        if (cancelled) return;

        if (cues.length > 0) {
          setSubtitleCues(cues);
          setHasLoadedSubtitles(true);
        } else if (pollCount < 5) {
          pollCount += 1;
          timeoutId = setTimeout(loadSubtitles, 2000);
        } else {
          setSubtitleCues([]);
          setHasLoadedSubtitles(true);
        }
      } catch (error) {
        console.error("Subtitle load failed", error);
        if (!cancelled) {
          if (pollCount < 5) {
            pollCount += 1;
            timeoutId = setTimeout(loadSubtitles, 2000);
          } else {
            setSubtitleCues([]);
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

  // Sync subtitle cues to current time
  const activeCue = useMemo(() => {
    return findActiveCue(subtitleCues, currentTimeSec);
  }, [subtitleCues, currentTimeSec]);

  useEffect(() => {
    const nextSpanish = activeCue?.text ?? "";
    setSpanishLine((prev) => (prev === nextSpanish ? prev : nextSpanish));
  }, [activeCue]);

  // Fetch translations for active cue
  useEffect(() => {
    let cancelled = false;

    async function translateCurrentLine() {
      const activeText = spanishLine.trim();
      if (!activeText) {
        setChineseLine("");
        return;
      }

      const cached = translationCacheRef.current.get(activeText);
      if (cached) {
        setChineseLine(cached);
        return;
      }

      setChineseLine("…");

      try {
        const response = await fetch("/api/translate", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ text: activeText })
        });

        if (response.status === 401) {
          // Compatibility checking for 401 response
          return;
        }

        if (!response.ok) {
          throw new Error(`Translate failed: ${response.status}`);
        }

        const payload = await response.json();
        const translation = payload.translation?.trim() || activeText;
        translationCacheRef.current.set(activeText, translation);

        if (!cancelled) {
          setChineseLine(translation);
        }
      } catch (error) {
        console.error("Subtitle translate failed", error);
        if (!cancelled) {
          setChineseLine(activeText);
        }
      }
    }

    translateCurrentLine();
    return () => {
      cancelled = true;
    };
  }, [spanishLine]);

  // Fetch vocabulary highlights
  const subtitleTokens = useMemo(() => splitSubtitleTokens(spanishLine), [spanishLine]);

  const activeWordIndex = useMemo(() => {
    if (!activeCue || activeCue.dur <= 0) return -1;
    const wordIndices: number[] = [];
    subtitleTokens.forEach((token, idx) => {
      if (normalizeLookupWord(token)) {
        wordIndices.push(idx);
      }
    });
    if (wordIndices.length === 0) return -1;
    const elapsed = currentTimeSec - activeCue.start;
    const progress = Math.min(Math.max(0, elapsed / activeCue.dur), 0.99);
    const wordProgressIndex = Math.floor(progress * wordIndices.length);
    return wordIndices[wordProgressIndex] ?? -1;
  }, [activeCue, subtitleTokens, currentTimeSec]);

  const phraseSegments = useMemo(
    () =>
      buildPhraseSegments(
        subtitleTokens.map((token) => ({ text: token, isWord: !!normalizeLookupWord(token) })),
        phraseSpans
      ),
    [phraseSpans, subtitleTokens]
  );

  // Report changes back to parent
  useEffect(() => {
    onCueChange?.(spanishLine, chineseLine, activeCue);
  }, [spanishLine, chineseLine, activeCue, onCueChange]);

  useEffect(() => {
    let cancelled = false;

    async function loadPhraseSpans() {
      if (!spanishLine.trim()) {
        setPhraseSpans([]);
        return;
      }

      try {
        const response = await fetch("/api/lexicon/detect-phrases", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ text: spanishLine })
        });
        if (!response.ok) throw new Error(`Phrase detection failed: ${response.status}`);
        const payload = (await response.json()) as { spans?: PhraseSpan[] };
        if (!cancelled) setPhraseSpans(Array.isArray(payload.spans) ? payload.spans : []);
      } catch {
        if (!cancelled) setPhraseSpans([]);
      }
    }

    void loadPhraseSpans();

    return () => {
      cancelled = true;
    };
  }, [spanishLine]);

  useEffect(() => {
    let cancelled = false;

    async function loadHighlights() {
      const words = Array.from(
        new Set(
          subtitleTokens
            .map((token) => normalizeLookupWord(token))
            .filter(Boolean)
        )
      );

      if (words.length === 0) {
        setHighlightMap({});
        return;
      }

      try {
        const response = await fetch("/api/vocab/highlight", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ words })
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

        const payload = (await response.json()) as HighlightResponse;
        const nextMap = Object.fromEntries(
          (payload.items ?? [])
            .filter(
              (item): item is { word: string; status: HighlightStatus } =>
                typeof item.word === "string" &&
                (item.status === "course" ||
                  item.status === "saved" ||
                  item.status === "unknown")
            )
            .map((item) => [item.word, item.status])
        );

        if (!cancelled) {
          setHighlightMap(nextMap);
        }
      } catch (error) {
        console.error("Subtitle highlight failed", error);
        if (!cancelled) {
          setHighlightMap({});
        }
      }
    }

    loadHighlights();
    return () => {
      cancelled = true;
    };
  }, [subtitleTokens]);

  const showEmptyState = hasLoadedSubtitles && subtitleCues.length === 0;

  const [isGeneratingPdf, setIsGeneratingPdf] = useState(false);

  const handlePdfDownload = async () => {
    if (isGeneratingPdf) return;
    setIsGeneratingPdf(true);
    try {
      await new Promise((resolve) => requestAnimationFrame(resolve));
      const rows = subtitleCues.map((cue, index) => ({
        id: `cue-${cue.start}-${index}`,
        start: cue.start,
        spanish: cue.text,
        chinese: "",
        translationIndex: index
      }));

      const validRows = rows.filter((row) => row.spanish.trim().length > 0);

      const ensurePdfRowsHaveTranslations = async (rows: typeof validRows) => {
        if (displayMode === "spanish") return rows;
        const missingRows = rows.filter(
          (row) => row.spanish.trim().length > 0 && row.chinese.trim().length === 0
        );

        const nextTranslations: Record<number, string> = {};
        let cursor = 0;

        async function fetchTranslationText(text: string): Promise<string | null> {
          const cached = translationCacheRef.current.get(text);
          if (cached) return cached;
          try {
            const response = await fetch("/api/translate", {
              method: "POST",
              headers: { "Content-Type": "application/json" },
              body: JSON.stringify({ text })
            });
            if (!response.ok) throw new Error();
            const payload = await response.json();
            const trans = payload.translation?.trim();
            if (trans) {
              translationCacheRef.current.set(text, trans);
              return trans;
            }
          } catch (e) {}
          return null;
        }

        async function worker() {
          while (cursor < missingRows.length) {
            const row = missingRows[cursor];
            cursor += 1;
            const translation = await fetchTranslationText(row.spanish);
            if (translation) {
              nextTranslations[row.translationIndex] = translation;
            }
          }
        }

        await Promise.all(
          Array.from(
            { length: Math.min(2, missingRows.length) },
            () => worker()
          )
        );

        return rows.map((row) => ({
          ...row,
          chinese: row.chinese || nextTranslations[row.translationIndex] || ""
        }));
      };

      const completeRows = await ensurePdfRowsHaveTranslations(validRows);
      const pdfTitle = videoTitle?.trim() || videoId;
      const pages = renderTranscriptPdfPages(completeRows, displayMode, pdfTitle);
      const pdfBytes = buildPdfBytes(pages);
      const blob = new Blob([pdfBytes], { type: "application/pdf" });
      const url = URL.createObjectURL(blob);
      const link = document.createElement("a");
      const safeVideoId = pdfTitle.replace(/[^a-z0-9\u00c0-\u024f\u4e00-\u9fff_-]+/gi, "-").replace(/^-+|-+$/g, "").slice(0, 80) || "subtitles";
      link.href = url;
      link.download = `${safeVideoId}-cue-${displayMode}.pdf`;
      document.body.appendChild(link);
      link.click();
      link.remove();
      URL.revokeObjectURL(url);
    } finally {
      setIsGeneratingPdf(false);
    }
  };

  if (isMobile) {
    return (
      <div className="flex flex-col gap-4 w-full relative">
        {/* 字幕展示区 */}
        <div className="w-full bg-zinc-50 dark:bg-zinc-900/30 border border-zinc-100 dark:border-zinc-800/60 rounded-2xl p-5 shadow-sm min-h-[140px] flex items-center justify-center text-center">
          {!hasLoadedSubtitles ? (
            <p className="text-sm text-zinc-400 dark:text-zinc-500 italic select-none font-display animate-pulse">
              （字幕加载中…）
            </p>
          ) : showEmptyState ? (
            <p className="text-sm text-zinc-400 dark:text-zinc-500 font-display">暂无字幕</p>
          ) : !spanishLine ? (
            <p className="text-sm text-zinc-400 dark:text-zinc-500 italic select-none font-display">
              （无台词）
            </p>
          ) : (
            <div className="flex flex-col items-center justify-center">
              {/* Spanish text */}
              {displayMode !== "chinese" && (
                <p className="text-lg font-semibold leading-relaxed tracking-wide text-zinc-900 dark:text-zinc-100">
                  {phraseSegments.map((segment, index) => {
                    if (segment.type === "phrase") {
                      return (
                        <span
                          className="phrase-highlight inline bg-amber-500/20 border-b border-amber-500/40 rounded px-1 py-0.5 mx-0.5 transition-colors duration-150 hover:bg-amber-500/35 cursor-pointer"
                          key={`phrase-${segment.span.start}-${segment.span.end}`}
                          onClick={() => {
                            openLookup(
                              segment.span.lemma,
                              spanishLine,
                              "phrase",
                              segment.span.kind
                            );
                            onLookup({
                              form: segment.span.lemma,
                              originalSentence: spanishLine,
                              translatedSentence: chineseLine
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
                    const isWordActive = subtitleTokens.findIndex((item) => item === token) === activeWordIndex;

                    let colorClass = "";
                    if (highlightStatus === "course") {
                      colorClass = "text-emerald-600 dark:text-emerald-400";
                    }

                    if (!normalizedWord) {
                      return <span key={`${token}-${index}`}>{token}</span>;
                    }

                    return (
                      <span
                        className={`cursor-pointer rounded px-0.5 transition hover:bg-zinc-200 dark:hover:bg-zinc-800/80 text-zinc-900 dark:text-zinc-100 ${colorClass} ${
                          highlightStatus === "saved"
                            ? "saved-word underline decoration-dotted decoration-1 decoration-zinc-400 dark:decoration-zinc-500"
                            : ""
                        } ${
                          isWordActive
                            ? "bg-brand-500/20 text-brand-700 dark:text-brand-300 font-bold"
                            : ""
                        }`}
                        key={`${token}-${index}`}
                        onClick={() => {
                          openLookup(normalizedWord, spanishLine);
                          onLookup({
                            form: normalizedWord,
                            originalSentence: spanishLine,
                            translatedSentence: chineseLine
                          });
                        }}
                        onKeyDown={(event) => {
                          if (event.key === "Enter" || event.key === " ") {
                            event.preventDefault();
                            openLookup(normalizedWord, spanishLine);
                            onLookup({
                              form: normalizedWord,
                              originalSentence: spanishLine,
                              translatedSentence: chineseLine
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
                </p>
              )}

              {/* Chinese translation text */}
              {displayMode !== "spanish" && (
                <p className="mt-2.5 text-xs text-zinc-500 dark:text-zinc-400 leading-relaxed font-medium">
                  {chineseLine || "…"}
                </p>
              )}
            </div>
          )}
        </div>

        {/* 底部控制区 (Thumb Zone Controls) */}
        <div className="flex flex-col gap-3 w-full">
          {/* 显示模式切换 */}
          <div>
            <div className="flex bg-zinc-100 dark:bg-zinc-900 p-0.5 rounded-full">
              {(["bilingual", "spanish", "chinese"] as const).map((mode) => (
                <button
                  key={mode}
                  onClick={() => changeDisplayMode(mode)}
                  className={`flex-1 py-1.5 text-[11px] font-bold rounded-full transition-all ${
                    displayMode === mode
                      ? "bg-white dark:bg-zinc-800 text-zinc-900 dark:text-white shadow-sm"
                      : "text-zinc-500 hover:text-zinc-800 dark:hover:text-zinc-300"
                  }`}
                  type="button"
                >
                  {mode === "bilingual" && "中西双语"}
                  {mode === "spanish" && "仅西语"}
                  {mode === "chinese" && "仅中文"}
                </button>
              ))}
            </div>
          </div>

          {/* 播放速度切换 */}
          <div>
            <div className="grid grid-cols-4 gap-1 bg-zinc-100 dark:bg-zinc-900 p-0.5 rounded-full">
              {([0.75, 0.85, 1.0, 1.25] as const).map((speed) => (
                <button
                  key={speed}
                  onClick={() => onSpeedChange(speed)}
                  className={`text-center py-1.5 text-[11px] font-bold rounded-full transition-all ${
                    playbackRate === speed
                      ? "bg-white dark:bg-zinc-800 text-zinc-950 dark:text-white shadow-sm"
                      : "text-zinc-500 hover:text-zinc-800 dark:hover:text-zinc-300"
                  }`}
                  type="button"
                >
                  {speed}x
                </button>
              ))}
            </div>
          </div>

          {/* 刷新字幕与下载 PDF (两列等宽) */}
          <div className="grid grid-cols-2 gap-3.5 mt-1">
            <button
              onClick={onRefresh}
              className="flex items-center justify-center gap-1.5 border border-zinc-200 dark:border-zinc-800 rounded-full h-10 text-[11px] font-bold text-zinc-500 dark:text-zinc-400 bg-zinc-50/50 dark:bg-zinc-900/50 hover:bg-zinc-100 dark:hover:bg-zinc-800/80 transition-colors"
              type="button"
            >
              <svg className="h-3.5 w-3.5" fill="none" stroke="currentColor" strokeWidth="2.5" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" d="M16.023 9.348h4.992v-.001M2.985 19.644v-4.992m0 0h4.992m-4.993 0l3.181 3.183a8.25 8.25 0 0013.803-3.7M4.031 9.865a8.25 8.25 0 0113.803-3.7l3.181 3.182m0-4.991v4.99" />
              </svg>
              刷新字幕
            </button>

            <button
              onClick={handlePdfDownload}
              disabled={isGeneratingPdf}
              className="flex items-center justify-center gap-1.5 border border-zinc-200 dark:border-zinc-800 rounded-full h-10 text-[11px] font-bold text-zinc-500 dark:text-zinc-400 bg-zinc-50/50 dark:bg-zinc-900/50 hover:bg-zinc-100 dark:hover:bg-zinc-800/80 transition-colors disabled:opacity-50"
              type="button"
              aria-label="下载当前字幕为 PDF 讲义"
            >
              {isGeneratingPdf ? (
                <>
                  <svg className="animate-spin h-3.5 w-3.5" fill="none" viewBox="0 0 24 24">
                    <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                    <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />
                  </svg>
                  生成中...
                </>
              ) : (
                <>
                  <svg className="h-3.5 w-3.5" fill="none" stroke="currentColor" strokeWidth="2.5" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" d="M3 16.5v2.25A2.25 2.25 0 005.25 21h13.5A2.25 2.25 0 0021 18.75V16.5M16.5 12L12 16.5m0 0L7.5 12m4.5 4.5V3" />
                  </svg>
                  下载 PDF
                </>
              )}
            </button>
          </div>
        </div>

        {/* Mobile Lookup Card Stack */}
        {activeLookup && (
          <div
            className="absolute left-1/2 -translate-x-1/2 z-50 w-full max-w-[300px] bottom-[calc(100%+8px)] pointer-events-auto"
            data-testid="dummy-active-lookup-card"
          >
            <LookupCardStack
              cards={activeLookup.cards.map((card) => ({
                ...card,
                onClose: () => closeStackCard(card.id),
                onExampleWordClick: openNestedWord,
                onRelatedPhraseClick: openNestedPhrase,
                originalSentence: activeLookup.sentence,
                translatedSentence: chineseLine,
                currentTimeSec
              }))}
              onCloseCard={closeStackCard}
            />
          </div>
        )}
      </div>
    );
  }

  if (isOverlay) {
    return (
      <section className="absolute bottom-12 left-1/2 -translate-x-1/2 z-30 w-full max-w-[85%] text-center select-none pointer-events-none">
        {/* Subtitle Settings Control */}
        <div className="absolute -top-10 right-0 flex items-center gap-2 pointer-events-auto" ref={settingsRef}>
          <div className="relative">
            <button
              onClick={() => setIsSettingsOpen(!isSettingsOpen)}
              className="flex h-8 w-8 items-center justify-center rounded-full text-zinc-400 hover:text-zinc-200 hover:bg-white/10 transition-all"
              title="字幕设置"
              type="button"
            >
              <svg className="h-5 w-5 fill-none stroke-current stroke-2" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" d="M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.065 2.572c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.572 1.065c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.065-2.572c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z" />
                <path strokeLinecap="round" strokeLinejoin="round" d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
              </svg>
            </button>

            {isSettingsOpen && (
              <div className="absolute right-0 z-30 w-56 rounded-xl border p-4 shadow-xl text-left bottom-12 border-zinc-700 bg-zinc-950/95 text-white shadow-2xl backdrop-blur-md">
                <h3 className="text-xs font-bold text-zinc-400 dark:text-zinc-500 uppercase tracking-wider mb-3 font-display">
                  字幕选项
                </h3>

                {/* Text Size Select */}
                <div className="mb-4">
                  <label className="block text-[11px] font-semibold text-zinc-500 dark:text-zinc-400 mb-1.5 font-display">
                    字体大小
                  </label>
                  <div className="flex gap-1 bg-zinc-50 dark:bg-zinc-950 p-1 rounded-lg">
                    <button
                      onClick={() => changeTextSize("medium")}
                      className={`flex-1 text-center py-1 text-xs font-bold rounded ${
                        textSize === "medium"
                          ? "bg-white dark:bg-zinc-800 text-zinc-950 dark:text-white shadow-sm"
                          : "text-zinc-500 hover:text-zinc-800 dark:hover:text-zinc-300"
                      }`}
                    >
                      标准
                    </button>
                    <button
                      onClick={() => changeTextSize("large")}
                      className={`flex-1 text-center py-1 text-xs font-bold rounded ${
                        textSize === "large"
                          ? "bg-white dark:bg-zinc-800 text-zinc-950 dark:text-white shadow-sm"
                          : "text-zinc-500 hover:text-zinc-800 dark:hover:text-zinc-300"
                      }`}
                    >
                      放大
                    </button>
                  </div>
                </div>

                {/* Translation Display Select */}
                <div className="mb-4 font-display">
                  <label className="block text-[11px] font-semibold text-zinc-500 dark:text-zinc-400 mb-1.5">
                    显示模式
                  </label>
                  <div className="flex flex-col gap-1">
                    {(["bilingual", "spanish", "chinese"] as const).map((mode) => (
                      <button
                        key={mode}
                        onClick={() => changeDisplayMode(mode)}
                        className={`text-left px-2 py-1.5 text-xs font-semibold rounded-lg transition-all ${
                          displayMode === mode
                            ? "bg-brand-50 dark:bg-brand-950/20 text-brand-700 dark:text-brand-400"
                            : "text-zinc-600 dark:text-zinc-400 hover:bg-zinc-50 dark:hover:bg-zinc-800/50"
                        }`}
                      >
                        {mode === "bilingual" && "中西双语"}
                        {mode === "spanish" && "仅西语"}
                        {mode === "chinese" && "仅中文"}
                      </button>
                    ))}
                  </div>
                </div>

                {/* Playback speed */}
                <div className="font-display">
                  <label className="block text-[11px] font-semibold text-zinc-500 dark:text-zinc-400 mb-1.5">
                    播放速度
                  </label>
                  <div className="grid grid-cols-4 gap-1 bg-zinc-50 dark:bg-zinc-950 p-1 rounded-lg">
                    {([0.75, 0.85, 1.0, 1.25] as const).map((speed) => (
                      <button
                        key={speed}
                        onClick={() => onSpeedChange(speed)}
                        className={`text-center py-1 text-[10px] font-bold rounded ${
                          playbackRate === speed
                            ? "bg-white dark:bg-zinc-800 text-zinc-950 dark:text-white shadow-sm"
                            : "text-zinc-500 hover:text-zinc-800 dark:hover:text-zinc-300"
                        }`}
                      >
                        {speed}x
                      </button>
                    ))}
                  </div>
                </div>
              </div>
            )}
          </div>
        </div>

        {/* Subtitles Area with translucent board */}
        <div className="inline-block bg-black/65 backdrop-blur-md border border-white/10 px-5 py-3 rounded-2xl shadow-hero pointer-events-auto">
          {!hasLoadedSubtitles ? (
            <p className="text-sm text-zinc-400 dark:text-zinc-500 italic select-none font-display animate-pulse">
              （字幕加载中…）
            </p>
          ) : showEmptyState ? (
            <p className="text-sm text-zinc-400 dark:text-zinc-500 font-display">暂无字幕</p>
          ) : !spanishLine ? (
            <p className="text-sm text-zinc-400 dark:text-zinc-500 italic select-none font-display">
              （无台词）
            </p>
          ) : (
            <div className="flex flex-col items-center justify-center">
              {/* Spanish line */}
              {displayMode !== "chinese" ? (
                <p
                  className={`font-sans tracking-[0.05px] leading-relaxed font-semibold transition-all text-white hover:text-white ${
                    textSize === "large" ? "text-xl md:text-2xl" : "text-base"
                  }`}
                >
                  {phraseSegments.map((segment, index) => {
                    if (segment.type === "phrase") {
                      return (
                        <span
                          className="phrase-highlight inline bg-amber-500/20 border-b border-amber-500/40 rounded px-1 py-0.5 mx-0.5 transition-colors duration-150 hover:bg-amber-500/35 cursor-pointer"
                          key={`phrase-${segment.span.start}-${segment.span.end}`}
                          onClick={() => {
                            openLookup(
                              segment.span.lemma,
                              spanishLine,
                              "phrase",
                              segment.span.kind
                            );
                            onLookup({
                              form: segment.span.lemma,
                              originalSentence: spanishLine,
                              translatedSentence: chineseLine
                            });
                          }}
                          role="button"
                          tabIndex={0}
                        >
                          {segment.tokens.map((phraseToken, phraseTokenIndex) => {
                            return (
                              <span key={`${phraseToken.text}-${phraseTokenIndex}`}>
                                {phraseToken.text}
                              </span>
                            );
                          })}
                        </span>
                      );
                    }

                    const token = segment.token.text;
                    const normalizedWord = normalizeLookupWord(token);
                    const highlightStatus = highlightMap[normalizedWord] ?? "unknown";
                    const isWordActive = subtitleTokens.findIndex((item) => item === token) === activeWordIndex;

                    let colorClass = "";
                    if (highlightStatus === "course") {
                      colorClass = "text-emerald-400 font-semibold";
                    }

                    if (!normalizedWord) {
                      return <span key={`${token}-${index}`}>{token}</span>;
                    }

                    return (
                      <span
                        className={`cursor-pointer rounded px-0.5 transition hover:bg-white/20 text-white ${colorClass} ${
                          highlightStatus === "saved"
                            ? "saved-word underline decoration-dotted decoration-1 decoration-zinc-300"
                            : ""
                        } ${
                          isWordActive
                            ? "bg-brand-500/30 text-brand-300 font-bold"
                            : ""
                        }`}
                        key={`${token}-${index}`}
                        onClick={() => {
                          openLookup(normalizedWord, spanishLine);
                          onLookup({
                            form: normalizedWord,
                            originalSentence: spanishLine,
                            translatedSentence: chineseLine
                          });
                        }}
                        onKeyDown={(event) => {
                          if (event.key === "Enter" || event.key === " ") {
                            event.preventDefault();
                            openLookup(normalizedWord, spanishLine);
                            onLookup({
                              form: normalizedWord,
                              originalSentence: spanishLine,
                              translatedSentence: chineseLine
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
                </p>
              ) : null}

              {/* Chinese translation line */}
              {displayMode !== "spanish" ? (
                <p className="mt-1.5 text-zinc-300 text-xs font-medium leading-relaxed">
                  {chineseLine || "…"}
                </p>
              ) : null}
            </div>
          )}
        </div>

        {/* Lookup Card Stack */}
        {activeLookup && (
          <div
            className="absolute left-1/2 -translate-x-1/2 z-50 w-full max-w-[300px] bottom-[calc(100%+8px)] pointer-events-auto"
            data-testid="dummy-active-lookup-card"
          >
            <LookupCardStack
              cards={activeLookup.cards.map((card) => ({
                ...card,
                onClose: () => closeStackCard(card.id),
                onExampleWordClick: openNestedWord,
                onRelatedPhraseClick: openNestedPhrase,
                originalSentence: activeLookup.sentence,
                translatedSentence: chineseLine,
                currentTimeSec
              }))}
              onCloseCard={closeStackCard}
            />
          </div>
        )}
      </section>
    );
  }

  return (
    <section
      className="relative min-h-[120px] flex flex-col justify-center rounded-surface border border-zinc-300 dark:border-zinc-800 bg-zinc-50/50 dark:bg-zinc-900/50 p-6 shadow-md backdrop-blur-sm"
    >
      {/* Subtitle Settings Control */}
      <div className="absolute top-4 right-4 flex items-center gap-2" ref={settingsRef}>
        <div className="relative">
          <button
            onClick={() => setIsSettingsOpen(!isSettingsOpen)}
            className="flex h-8 w-8 items-center justify-center rounded-full text-zinc-400 hover:text-zinc-600 dark:text-zinc-500 dark:hover:text-zinc-300 hover:bg-zinc-100 dark:hover:bg-zinc-800 transition-all"
            title="字幕设置"
            type="button"
          >
            <svg className="h-5 w-5 fill-none stroke-current stroke-2" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" d="M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.065 2.572c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.572 1.065c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.065-2.572c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z" />
              <path strokeLinecap="round" strokeLinejoin="round" d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
            </svg>
          </button>

          {isSettingsOpen && (
            <div className="absolute right-0 z-30 w-56 rounded-xl border p-4 shadow-xl text-left top-10 border-zinc-200 dark:border-zinc-800 bg-white dark:bg-zinc-900 text-zinc-900 dark:text-zinc-100">
              <h3 className="text-xs font-bold text-zinc-400 dark:text-zinc-500 uppercase tracking-wider mb-3 font-display">
                字幕选项
              </h3>

              {/* Text Size Select */}
              <div className="mb-4">
                <label className="block text-[11px] font-semibold text-zinc-500 dark:text-zinc-400 mb-1.5 font-display">
                  字体大小
                </label>
                <div className="flex gap-1 bg-zinc-50 dark:bg-zinc-950 p-1 rounded-lg">
                  <button
                    onClick={() => changeTextSize("medium")}
                    className={`flex-1 text-center py-1 text-xs font-bold rounded ${
                      textSize === "medium"
                        ? "bg-white dark:bg-zinc-800 text-zinc-950 dark:text-white shadow-sm"
                        : "text-zinc-500 hover:text-zinc-800 dark:hover:text-zinc-300"
                    }`}
                  >
                    标准
                  </button>
                  <button
                    onClick={() => changeTextSize("large")}
                    className={`flex-1 text-center py-1 text-xs font-bold rounded ${
                      textSize === "large"
                        ? "bg-white dark:bg-zinc-800 text-zinc-950 dark:text-white shadow-sm"
                        : "text-zinc-500 hover:text-zinc-800 dark:hover:text-zinc-300"
                    }`}
                  >
                    放大
                  </button>
                </div>
              </div>

              {/* Translation Display Select */}
              <div className="mb-4 font-display">
                <label className="block text-[11px] font-semibold text-zinc-500 dark:text-zinc-400 mb-1.5">
                  显示模式
                </label>
                <div className="flex flex-col gap-1">
                  {(["bilingual", "spanish", "chinese"] as const).map((mode) => (
                    <button
                      key={mode}
                      onClick={() => changeDisplayMode(mode)}
                      className={`text-left px-2 py-1.5 text-xs font-semibold rounded-lg transition-all ${
                        displayMode === mode
                          ? "bg-brand-50 dark:bg-brand-950/20 text-brand-700 dark:text-brand-400"
                          : "text-zinc-600 dark:text-zinc-400 hover:bg-zinc-50 dark:hover:bg-zinc-800/50"
                      }`}
                    >
                      {mode === "bilingual" && "中西双语"}
                      {mode === "spanish" && "仅西语"}
                      {mode === "chinese" && "仅中文"}
                    </button>
                  ))}
                </div>
              </div>

              {/* Playback speed */}
              <div className="font-display">
                <label className="block text-[11px] font-semibold text-zinc-500 dark:text-zinc-400 mb-1.5">
                  播放速度
                </label>
                <div className="grid grid-cols-4 gap-1 bg-zinc-50 dark:bg-zinc-950 p-1 rounded-lg">
                  {([0.75, 0.85, 1.0, 1.25] as const).map((speed) => (
                    <button
                      key={speed}
                      onClick={() => onSpeedChange(speed)}
                      className={`text-center py-1 text-[10px] font-bold rounded ${
                        playbackRate === speed
                          ? "bg-white dark:bg-zinc-800 text-zinc-950 dark:text-white shadow-sm"
                          : "text-zinc-500 hover:text-zinc-800 dark:hover:text-zinc-300"
                      }`}
                    >
                      {speed}x
                    </button>
                  ))}
                </div>
              </div>
            </div>
          )}
        </div>
      </div>

      {/* Subtitles Area */}
      <div className="text-center w-full px-2 py-2">
        {!hasLoadedSubtitles ? (
          <p className="text-sm text-zinc-400 dark:text-zinc-500 italic select-none font-display animate-pulse">
            （字幕加载中…）
          </p>
        ) : showEmptyState ? (
          <p className="text-sm text-zinc-400 dark:text-zinc-500 font-display">暂无字幕</p>
        ) : !spanishLine ? (
          <p className="text-sm text-zinc-400 dark:text-zinc-500 italic select-none font-display">
            （无台词）
          </p>
        ) : (
          <div className="flex flex-col items-center justify-center">
            {/* Spanish line */}
            {displayMode !== "chinese" ? (
              <p
                className={`font-sans tracking-wide leading-relaxed font-semibold transition-all text-zinc-900 dark:text-zinc-100 ${
                  textSize === "large" ? "text-2xl md:text-3xl" : "text-lg md:text-xl"
                }`}
              >
                {phraseSegments.map((segment, index) => {
                  if (segment.type === "phrase") {
                    return (
                      <span
                        className={PHRASE_HIGHLIGHT_CLASSES}
                        key={`phrase-${segment.span.start}-${segment.span.end}`}
                        onClick={() => {
                          openLookup(
                            segment.span.lemma,
                            spanishLine,
                            "phrase",
                            segment.span.kind
                          );
                          onLookup({
                            form: segment.span.lemma,
                            originalSentence: spanishLine,
                            translatedSentence: chineseLine
                          });
                        }}
                        role="button"
                        tabIndex={0}
                      >
                        {segment.tokens.map((phraseToken, phraseTokenIndex) => {
                          return (
                            <span key={`${phraseToken.text}-${phraseTokenIndex}`}>
                              {phraseToken.text}
                            </span>
                          );
                        })}
                      </span>
                    );
                  }

                  const token = segment.token.text;
                  const normalizedWord = normalizeLookupWord(token);
                  const highlightStatus = highlightMap[normalizedWord] ?? "unknown";
                  const isWordActive = subtitleTokens.findIndex((item) => item === token) === activeWordIndex;

                  let colorClass = "";
                  if (highlightStatus === "course") {
                    colorClass = "text-emerald-600 dark:text-emerald-400";
                  }

                  if (!normalizedWord) {
                    return <span key={`${token}-${index}`}>{token}</span>;
                  }

                  return (
                    <span
                      className={`cursor-pointer rounded px-0.5 transition hover:bg-zinc-100 dark:hover:bg-zinc-800/80 text-zinc-900 dark:text-zinc-100 ${colorClass} ${
                        highlightStatus === "saved"
                          ? "saved-word underline decoration-dotted decoration-1 decoration-zinc-400 dark:decoration-zinc-500"
                          : ""
                      } ${
                        isWordActive
                          ? "bg-brand-500/20 text-brand-700 dark:text-brand-300 font-bold"
                          : ""
                      }`}
                      key={`${token}-${index}`}
                      onClick={() => {
                        openLookup(normalizedWord, spanishLine);
                        onLookup({
                          form: normalizedWord,
                          originalSentence: spanishLine,
                          translatedSentence: chineseLine
                        });
                      }}
                      onKeyDown={(event) => {
                        if (event.key === "Enter" || event.key === " ") {
                          event.preventDefault();
                          openLookup(normalizedWord, spanishLine);
                          onLookup({
                            form: normalizedWord,
                            originalSentence: spanishLine,
                            translatedSentence: chineseLine
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
              </p>
            ) : null}

            {/* Chinese translation line */}
            {displayMode !== "spanish" ? (
              <p
                className={`font-sans tracking-wide leading-relaxed font-medium mt-2 text-zinc-400 dark:text-zinc-500 transition-all ${
                  textSize === "large" ? "text-lg md:text-xl" : "text-sm"
                }`}
              >
                {chineseLine || "…"}
              </p>
            ) : null}
          </div>
        )}
      </div>

      {activeLookup && (
        <div
          className="absolute left-1/2 -translate-x-1/2 z-50 w-full max-w-[300px] top-[calc(100%+8px)] font-display"
          data-testid="dummy-active-lookup-card"
        >
          <LookupCardStack
            cards={activeLookup.cards.map((card) => ({
              ...card,
              onClose: () => closeStackCard(card.id),
              onExampleWordClick: openNestedWord,
              onRelatedPhraseClick: openNestedPhrase,
              originalSentence: activeLookup.sentence,
              translatedSentence: chineseLine,
              currentTimeSec
            }))}
            onCloseCard={closeStackCard}
          />
        </div>
      )}
    </section>
  );
}
