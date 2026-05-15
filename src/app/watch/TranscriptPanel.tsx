"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { LookupCard } from "./LookupCard";

type SubtitleCue = {
  start: number;
  dur: number;
  text: string;
};

type TranscriptPanelProps = {
  iframeId: string;
  videoId: string;
};

type TranslateResponse = {
  translation?: string;
};

type HighlightStatus = "course" | "saved" | "unknown";

type HighlightResponse = {
  items?: Array<{
    word?: string;
    status?: HighlightStatus;
  }>;
};

type DisplayMode = "bilingual" | "spanish" | "chinese";

type ActiveLookup = {
  cueIndex: number;
  form: string;
};

type TranscriptYouTubePlayerStateChangeEvent = {
  data: number;
};

type TranscriptYouTubePlayer = {
  destroy: () => void;
  getCurrentTime: () => number;
  playVideo: () => void;
  seekTo: (seconds: number, allowSeekAhead?: boolean) => void;
};

type TranscriptYouTubePlayerConstructor = new (
  elementId: string,
  config: {
    playerVars?: {
      origin?: string;
    };
    events?: {
      onReady?: () => void;
      onStateChange?: (event: TranscriptYouTubePlayerStateChangeEvent) => void;
    };
  }
) => TranscriptYouTubePlayer;

type TranscriptYouTubeNamespace = {
  Player: TranscriptYouTubePlayerConstructor;
  PlayerState?: {
    PLAYING?: number;
    PAUSED?: number;
    BUFFERING?: number;
  };
};

const COURSE_HIGHLIGHT = "#86EFAC";
const SAVED_HIGHLIGHT = "#93C5FD";
const TRANSLATION_BATCH_SIZE = 5;
const ABOVE_THE_FOLD_CUES = 8;

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
  return cues.findIndex(
    (cue) => currentTime >= cue.start && currentTime <= cue.start + cue.dur
  );
}

function formatTimestamp(seconds: number) {
  const wholeSeconds = Math.max(0, Math.floor(seconds));
  const minutes = Math.floor(wholeSeconds / 60);
  const remainder = wholeSeconds % 60;
  return `${minutes}:${String(remainder).padStart(2, "0")}`;
}

function loadYouTubeIframeApi() {
  if (typeof window === "undefined") {
    return Promise.reject(new Error("window is not available"));
  }

  const youtubeWindow = window as Window & {
    YT?: TranscriptYouTubeNamespace;
    onYouTubeIframeAPIReady?: () => void;
  };

  if (youtubeWindow.YT?.Player) {
    return Promise.resolve(youtubeWindow.YT);
  }

  return new Promise<TranscriptYouTubeNamespace>((resolve, reject) => {
    const existingScript = document.querySelector<HTMLScriptElement>(
      'script[src="https://www.youtube.com/iframe_api"]'
    );

    const handleReady = () => {
      if (youtubeWindow.YT?.Player) {
        resolve(youtubeWindow.YT);
        return;
      }

      reject(new Error("YouTube iframe API did not initialize"));
    };

    const previousReady = youtubeWindow.onYouTubeIframeAPIReady;
    youtubeWindow.onYouTubeIframeAPIReady = () => {
      previousReady?.();
      handleReady();
    };

    if (!existingScript) {
      const script = document.createElement("script");
      script.src = "https://www.youtube.com/iframe_api";
      script.async = true;
      script.onerror = () => reject(new Error("Failed to load YouTube iframe API"));
      document.head.appendChild(script);
    }
  });
}

function chunkWords(words: string[]) {
  const chunks: string[][] = [];

  for (let index = 0; index < words.length; index += 64) {
    chunks.push(words.slice(index, index + 64));
  }

  return chunks;
}

export function TranscriptPanel({ iframeId, videoId }: TranscriptPanelProps) {
  const [displayMode, setDisplayMode] = useState<DisplayMode>("bilingual");
  const [subtitleCues, setSubtitleCues] = useState<SubtitleCue[]>([]);
  const [translations, setTranslations] = useState<Record<number, string>>({});
  const [hasLoadedSubtitles, setHasLoadedSubtitles] = useState(false);
  const [currentTimeSec, setCurrentTimeSec] = useState(0);
  const [highlightMap, setHighlightMap] = useState<Record<string, HighlightStatus>>({});
  const [activeLookup, setActiveLookup] = useState<ActiveLookup | null>(null);
  const [autoScrollPaused, setAutoScrollPaused] = useState(false);
  const panelRef = useRef<HTMLElement | null>(null);
  const cueRefs = useRef<Array<HTMLDivElement | null>>([]);
  const translationCacheRef = useRef<Map<string, string>>(new Map());
  const subtitleCuesRef = useRef<SubtitleCue[]>([]);
  const playerRef = useRef<TranscriptYouTubePlayer | null>(null);
  const intervalRef = useRef<number | null>(null);
  const isProgrammaticScrollRef = useRef(false);
  const scrollUnlockRef = useRef<number | null>(null);
  const activeCueIndex = useMemo(
    () => findActiveCueIndex(subtitleCues, currentTimeSec),
    [currentTimeSec, subtitleCues]
  );

  useEffect(() => {
    subtitleCuesRef.current = subtitleCues;
  }, [subtitleCues]);

  useEffect(() => {
    let cancelled = false;

    async function loadSubtitles() {
      if (!videoId) {
        setSubtitleCues([]);
        setTranslations({});
        setHasLoadedSubtitles(true);
        return;
      }

      setHasLoadedSubtitles(false);
      setTranslations({});
      setHighlightMap({});
      setActiveLookup(null);
      setAutoScrollPaused(false);

      try {
        const response = await fetch(
          `/api/subtitle?v=${encodeURIComponent(videoId)}&lang=es`,
          { cache: "no-store" }
        );

        if (!response.ok) {
          throw new Error(`Subtitle request failed: ${response.status}`);
        }

        const payload = (await response.json()) as SubtitleCue[];

        if (!cancelled) {
          setSubtitleCues(Array.isArray(payload) ? payload : []);
        }
      } catch (error) {
        console.error("Transcript subtitle load failed", error);

        if (!cancelled) {
          setSubtitleCues([]);
        }
      } finally {
        if (!cancelled) {
          setHasLoadedSubtitles(true);
        }
      }
    }

    void loadSubtitles();

    return () => {
      cancelled = true;
    };
  }, [videoId]);

  useEffect(() => {
    if (!videoId) {
      return undefined;
    }

    let cancelled = false;

    const stopPolling = () => {
      if (intervalRef.current !== null) {
        window.clearInterval(intervalRef.current);
        intervalRef.current = null;
      }
    };

    const tick = () => {
      try {
        if (!playerRef.current) {
          return;
        }

        setCurrentTimeSec(playerRef.current.getCurrentTime());
      } catch {
        // The player can be unavailable briefly while the iframe settles.
      }
    };

    const startPolling = () => {
      stopPolling();
      tick();
      intervalRef.current = window.setInterval(tick, 100);
    };

    void loadYouTubeIframeApi()
      .then((yt) => {
        if (cancelled || playerRef.current) {
          return;
        }

        playerRef.current = new yt.Player(iframeId, {
          playerVars: {
            origin: window.location.origin
          },
          events: {
            onReady: () => {
              startPolling();
            },
            onStateChange: (event) => {
              const playing = yt.PlayerState?.PLAYING ?? 1;
              const buffering = yt.PlayerState?.BUFFERING ?? 3;
              const paused = yt.PlayerState?.PAUSED ?? 2;

              if (event.data === playing || event.data === buffering) {
                startPolling();
                return;
              }

              if (event.data === paused) {
                stopPolling();
                tick();
                return;
              }

              stopPolling();
            }
          }
        }) as TranscriptYouTubePlayer;
      })
      .catch((error) => {
        console.error("Transcript player setup failed", error);
      });

    return () => {
      cancelled = true;
      stopPolling();

      if (scrollUnlockRef.current !== null) {
        window.clearTimeout(scrollUnlockRef.current);
        scrollUnlockRef.current = null;
      }

      try {
        playerRef.current?.destroy?.();
      } catch {
        // Ignore stale iframe teardown errors during transitions.
      }

      playerRef.current = null;
    };
  }, [iframeId, videoId]);

  useEffect(() => {
    let cancelled = false;

    async function translateCue(index: number, text: string) {
      const cached = translationCacheRef.current.get(text);

      if (cached) {
        setTranslations((previous) =>
          previous[index] === cached ? previous : { ...previous, [index]: cached }
        );
        return;
      }

      try {
        const response = await fetch("/api/translate", {
          method: "POST",
          headers: {
            "Content-Type": "application/json"
          },
          body: JSON.stringify({ text })
        });

        if (!response.ok) {
          throw new Error(`Translate request failed: ${response.status}`);
        }

        const payload = (await response.json()) as TranslateResponse;
        const translation = payload.translation?.trim() || text;

        translationCacheRef.current.set(text, translation);

        if (!cancelled) {
          setTranslations((previous) =>
            previous[index] === translation
              ? previous
              : { ...previous, [index]: translation }
          );
        }
      } catch (error) {
        console.error("Transcript translate failed", error);

        if (!cancelled) {
          setTranslations((previous) =>
            previous[index] === text ? previous : { ...previous, [index]: text }
          );
        }
      }
    }

    async function loadTranslations() {
      if (subtitleCues.length === 0) {
        return;
      }

      const prioritizedIndexes = [
        ...subtitleCues.slice(0, ABOVE_THE_FOLD_CUES).map((_, index) => index),
        ...subtitleCues
          .slice(ABOVE_THE_FOLD_CUES)
          .map((_, index) => index + ABOVE_THE_FOLD_CUES)
      ];
      let cursor = 0;

      async function worker() {
        while (!cancelled) {
          const index = prioritizedIndexes[cursor];
          cursor += 1;

          if (index === undefined) {
            return;
          }

          const cue = subtitleCues[index];

          if (!cue?.text.trim()) {
            continue;
          }

          await translateCue(index, cue.text.trim());
        }
      }

      await Promise.all(
        Array.from(
          { length: Math.min(TRANSLATION_BATCH_SIZE, prioritizedIndexes.length) },
          () => worker()
        )
      );
    }

    void loadTranslations();

    return () => {
      cancelled = true;
    };
  }, [subtitleCues]);

  useEffect(() => {
    let cancelled = false;

    async function loadHighlights() {
      const words = Array.from(
        new Set(
          subtitleCues
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
            throw new Error(`Highlight request failed: ${response.status}`);
          }

          const payload = (await response.json()) as HighlightResponse;

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

    void loadHighlights();

    return () => {
      cancelled = true;
    };
  }, [subtitleCues]);

  useEffect(() => {
    if (activeCueIndex < 0 || autoScrollPaused) {
      return;
    }

    const activeCue = cueRefs.current[activeCueIndex];

    if (!activeCue) {
      return;
    }

    isProgrammaticScrollRef.current = true;
    activeCue.scrollIntoView({ behavior: "smooth", block: "nearest" });

    if (scrollUnlockRef.current !== null) {
      window.clearTimeout(scrollUnlockRef.current);
    }

    scrollUnlockRef.current = window.setTimeout(() => {
      isProgrammaticScrollRef.current = false;
      scrollUnlockRef.current = null;
    }, 250);
  }, [activeCueIndex, autoScrollPaused]);

  useEffect(() => {
    setActiveLookup(null);
  }, [activeCueIndex, displayMode, videoId]);

  useEffect(() => {
    const handlePointerDown = (event: PointerEvent) => {
      if (!panelRef.current) {
        return;
      }

      if (!panelRef.current.contains(event.target as Node)) {
        setActiveLookup(null);
      }
    };

    document.addEventListener("pointerdown", handlePointerDown);
    return () => {
      document.removeEventListener("pointerdown", handlePointerDown);
    };
  }, []);

  const activeCue = activeCueIndex >= 0 ? subtitleCues[activeCueIndex] : null;
  const showEmptyState = hasLoadedSubtitles && subtitleCues.length === 0;

  return (
    <section className="flex h-full min-w-0 flex-col bg-white" ref={panelRef}>
      <div className="flex items-center gap-2 border-b border-gray-100 px-5 py-4">
        <div className="flex rounded-full bg-gray-100 p-0.5 text-[11px] font-semibold text-gray-500">
          <button
            className={`rounded-full px-3 py-1 transition ${
              displayMode === "bilingual" ? "bg-white text-gray-900 shadow-sm" : ""
            }`}
            onClick={() => setDisplayMode("bilingual")}
            type="button"
          >
            ES + 中
          </button>
          <button
            className={`rounded-full px-3 py-1 transition ${
              displayMode === "spanish" ? "bg-white text-gray-900 shadow-sm" : ""
            }`}
            onClick={() => setDisplayMode("spanish")}
            type="button"
          >
            仅西语
          </button>
          <button
            className={`rounded-full px-3 py-1 transition ${
              displayMode === "chinese" ? "bg-white text-gray-900 shadow-sm" : ""
            }`}
            onClick={() => setDisplayMode("chinese")}
            type="button"
          >
            仅中文
          </button>
        </div>
        <span className="ml-auto text-[11.5px] text-gray-400">点击字幕跳转</span>
      </div>

      <div
        className="relative flex-1 overflow-y-auto pb-24 pt-2"
        onScroll={() => {
          if (!isProgrammaticScrollRef.current) {
            setAutoScrollPaused(true);
          }
        }}
      >
        {showEmptyState ? (
          <div className="flex h-full items-center justify-center px-6 text-sm text-gray-400">
            暂无字幕
          </div>
        ) : (
          subtitleCues.map((cue, index) => {
            const tokens = splitSubtitleTokens(cue.text);
            const translation = translations[index] ?? "…";
            const isActive = index === activeCueIndex;

            return (
              <div
                className={`group border-t border-gray-100 px-5 py-3 first:border-t-0 ${
                  isActive ? "border-l-[3px] border-l-green-600" : "border-l-[3px] border-l-transparent"
                }`}
                key={`${cue.start}-${cue.text}`}
                ref={(element) => {
                  cueRefs.current[index] = element;
                }}
              >
                <button
                  className="block w-full text-left"
                  onClick={() => {
                    playerRef.current?.seekTo(cue.start, true);
                    playerRef.current?.playVideo();
                    setAutoScrollPaused(false);
                  }}
                  type="button"
                >
                  {displayMode !== "chinese" ? (
                    <div className="inline">
                      <span
                        className={`mr-2 inline-block text-[10px] font-medium tabular-nums tracking-[0.3px] transition ${
                          isActive
                            ? "opacity-100 text-green-700"
                            : "opacity-0 text-gray-400 group-hover:opacity-100"
                        }`}
                      >
                        {formatTimestamp(cue.start)}
                      </span>
                      <span
                        className={`inline text-[15px] leading-7 tracking-[0.05px] ${
                          isActive ? "font-bold text-green-700" : "font-medium text-gray-900"
                        }`}
                      >
                        {tokens.map((token, tokenIndex) => {
                          const normalizedWord = normalizeLookupWord(token);
                          const highlightStatus = highlightMap[normalizedWord] ?? "unknown";
                          const highlightColor =
                            highlightStatus === "course"
                              ? COURSE_HIGHLIGHT
                              : highlightStatus === "saved"
                                ? SAVED_HIGHLIGHT
                                : undefined;

                          if (!normalizedWord) {
                            return <span key={`${token}-${tokenIndex}`}>{token}</span>;
                          }

                          return (
                            <span
                              className="cursor-pointer rounded-sm px-0.5 transition hover:bg-gray-100"
                              key={`${token}-${tokenIndex}`}
                              onClick={(event) => {
                                event.stopPropagation();
                                setActiveLookup({
                                  cueIndex: index,
                                  form: normalizedWord
                                });
                              }}
                              onKeyDown={(event) => {
                                if (event.key === "Enter" || event.key === " ") {
                                  event.preventDefault();
                                  event.stopPropagation();
                                  setActiveLookup({
                                    cueIndex: index,
                                    form: normalizedWord
                                  });
                                }
                              }}
                              role="button"
                              style={highlightColor ? { color: highlightColor } : undefined}
                              tabIndex={0}
                            >
                              {token}
                            </span>
                          );
                        })}
                      </span>
                    </div>
                  ) : null}

                  {displayMode !== "spanish" ? (
                    <p className={`mt-1.5 font-['Noto_Sans_SC','PingFang_SC','Microsoft_YaHei',sans-serif] text-[12.5px] leading-6 ${isActive ? "text-gray-600" : "text-gray-500"}`}>
                      {translation}
                    </p>
                  ) : null}
                </button>

                {activeLookup?.cueIndex === index ? (
                  <div className="relative mt-3">
                    <LookupCard
                      currentTimeSec={currentTimeSec}
                      form={activeLookup.form}
                      onClose={() => setActiveLookup(null)}
                      originalSentence={cue.text}
                      translatedSentence={translation}
                    />
                  </div>
                ) : null}
              </div>
            );
          })
        )}

        {autoScrollPaused && activeCue ? (
          <button
            className="fixed bottom-8 right-[max(2rem,calc(37vw-7rem))] z-20 rounded-full border border-green-200 bg-white px-4 py-2 text-xs font-medium text-green-700 shadow-sm transition hover:bg-green-50"
            onClick={() => {
              setAutoScrollPaused(false);
              cueRefs.current[activeCueIndex]?.scrollIntoView({
                behavior: "smooth",
                block: "nearest"
              });
            }}
            type="button"
          >
            ↺ 回到当前位置
          </button>
        ) : null}
      </div>
    </section>
  );
}
