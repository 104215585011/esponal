"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
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
  degraded?: boolean;
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
  anchorX: number;
  anchorY: number;
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
const INITIAL_RENDER_COUNT = 12;
const LOAD_MORE_BATCH = 15;
const FOLLOW_EXPAND_THRESHOLD = 5;

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
  const [followMode, setFollowMode] = useState(true);
  const [renderStart, setRenderStart] = useState(0);
  const [renderEnd, setRenderEnd] = useState(INITIAL_RENDER_COUNT);
  const panelRef = useRef<HTMLElement | null>(null);
  const scrollContainerRef = useRef<HTMLDivElement | null>(null);
  const topSentinelRef = useRef<HTMLDivElement | null>(null);
  const bottomSentinelRef = useRef<HTMLDivElement | null>(null);
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
  const visibleCueRange = useMemo(
    () => ({
      start: Math.max(0, Math.min(renderStart, subtitleCues.length)),
      end: Math.max(0, Math.min(renderEnd, subtitleCues.length))
    }),
    [renderEnd, renderStart, subtitleCues.length]
  );
  const visibleCues = useMemo(
    () => subtitleCues.slice(visibleCueRange.start, visibleCueRange.end),
    [subtitleCues, visibleCueRange]
  );
  const renderedCues = visibleCues;

  const expandBottomWindow = useCallback(() => {
    setRenderEnd((previousEnd) =>
      Math.min(subtitleCuesRef.current.length, previousEnd + LOAD_MORE_BATCH)
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
    if (activeCueIndex < 0) {
      setFollowMode(true);
      return;
    }

    setRenderStart((previousStart) =>
      activeCueIndex < previousStart
        ? Math.max(0, activeCueIndex - FOLLOW_EXPAND_THRESHOLD)
        : previousStart
    );
    setRenderEnd((previousEnd) =>
      activeCueIndex >= previousEnd
        ? Math.min(
            subtitleCuesRef.current.length,
            activeCueIndex + FOLLOW_EXPAND_THRESHOLD + 1
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
  }, [activeCueIndex]);

  useEffect(() => {
    subtitleCuesRef.current = subtitleCues;
  }, [subtitleCues]);

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

  useEffect(() => {
    const scrollContainer = scrollContainerRef.current;

    if (!scrollContainer) {
      return undefined;
    }

    const enterBrowseMode = () => {
      if (!isProgrammaticScrollRef.current) {
        setFollowMode(false);
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
  }, []);

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
      setFollowMode(true);
      setRenderStart(0);
      setRenderEnd(INITIAL_RENDER_COUNT);

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
          const cues = Array.isArray(payload) ? payload : [];
          setSubtitleCues(cues);
          setRenderStart(0);
          setRenderEnd(Math.min(cues.length, INITIAL_RENDER_COUNT));
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

        // Degraded = backend translate failed and returned source text as
        // fallback. Don't cache or display it as a real translation; leave
        // the placeholder so the next visible-window refresh retries.
        if (payload.degraded) {
          return;
        }

        const translation = payload.translation?.trim();

        if (!translation) {
          return;
        }

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
        // Leave as placeholder ("…"); will retry when visible window changes.
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
  }, [subtitleCues, visibleCueRange.start, visibleCues]);

  useEffect(() => {
    let cancelled = false;

    async function loadHighlights() {
      const words = Array.from(
        new Set(
          visibleCues
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
  }, [visibleCues]);

  useEffect(() => {
    if (activeCueIndex < 0 || subtitleCues.length === 0) {
      return;
    }

    if (activeCueIndex < renderStart) {
      setRenderStart(Math.max(0, activeCueIndex - FOLLOW_EXPAND_THRESHOLD));
      return;
    }

    if (activeCueIndex >= renderEnd) {
      setRenderStart(Math.max(0, activeCueIndex - FOLLOW_EXPAND_THRESHOLD));
      setRenderEnd(Math.min(subtitleCues.length, activeCueIndex + LOAD_MORE_BATCH));
      return;
    }

    if (activeCueIndex >= renderEnd - FOLLOW_EXPAND_THRESHOLD) {
      setRenderEnd((previousEnd) =>
        Math.min(
          subtitleCues.length,
          Math.max(previousEnd, activeCueIndex + FOLLOW_EXPAND_THRESHOLD + 1)
        )
      );
    }
  }, [activeCueIndex, renderEnd, renderStart, subtitleCues.length]);

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

  // Clear lookup only on context switches (display mode / video change),
  // NOT on activeCueIndex change — user wants the card to stay while
  // playback continues so they can finish reading the entry.
  useEffect(() => {
    setActiveLookup(null);
  }, [displayMode, videoId]);

  useEffect(() => {
    const handlePointerDown = (event: PointerEvent) => {
      if (!panelRef.current) {
        return;
      }

      if (!panelRef.current.contains(event.target as Node)) {
        setActiveLookup(null);
      }
    };

    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        setActiveLookup(null);
      }
    };

    document.addEventListener("pointerdown", handlePointerDown);
    document.addEventListener("keydown", handleKeyDown);
    return () => {
      document.removeEventListener("pointerdown", handlePointerDown);
      document.removeEventListener("keydown", handleKeyDown);
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
              displayMode === "spanish" ? "bg-white text-gray-900 shadow-sm" : ""
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
              displayMode === "chinese" ? "bg-white text-gray-900 shadow-sm" : ""
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
        <span className="ml-auto text-[11.5px] text-gray-400">点击字幕跳转</span>
      </div>

      <div
        className="relative flex-1 overflow-y-auto pb-12 pt-2"
        ref={scrollContainerRef}
        tabIndex={0}
      >
        {showEmptyState ? (
          <div className="flex h-full items-center justify-center px-6 text-sm text-gray-400">
            暂无字幕
          </div>
        ) : (
          <>
            <div ref={topSentinelRef} />
            {renderedCues.map((cue, offset) => {
            const index = visibleCueRange.start + offset;
            const tokens = splitSubtitleTokens(cue.text);
            const translation = translations[index] ?? "…";
            const isActive = index === activeCueIndex;

            return (
              <div
                className={`group border-t border-gray-100 px-5 py-3 first:border-t-0 ${
                  isActive ? "border-l-[3px] border-l-green-600" : "border-l-[3px] border-l-transparent"
                }`}
                data-cue-index={index}
                key={`${cue.start}-${cue.text}`}
                ref={(element) => { cueRefs.current[index] = element; }}
              >
                <button
                  className="block w-full text-left"
                  onClick={() => {
                    if (activeLookup) { setActiveLookup(null); return; }
                    playerRef.current?.seekTo(cue.start, true);
                    playerRef.current?.playVideo();
                    setFollowMode(true);
                  }}
                  type="button"
                >
                  {displayMode !== "chinese" ? (
                    <div className="inline">
                      <span
                        className={`mr-2 inline-block text-[10px] font-medium tabular-nums tracking-[0.3px] transition ${
                          isActive ? "opacity-100 text-green-700" : "opacity-0 text-gray-400 group-hover:opacity-100"
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
                                const rect = (event.currentTarget as HTMLElement).getBoundingClientRect();
                                setActiveLookup({ cueIndex: index, form: normalizedWord, anchorX: rect.left, anchorY: rect.bottom + 6 });
                              }}
                              onKeyDown={(event) => {
                                if (event.key === "Enter" || event.key === " ") {
                                  event.preventDefault();
                                  event.stopPropagation();
                                  const rect = (event.currentTarget as HTMLElement).getBoundingClientRect();
                                  setActiveLookup({ cueIndex: index, form: normalizedWord, anchorX: rect.left, anchorY: rect.bottom + 6 });
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
              </div>
            );
            })}
            <div ref={bottomSentinelRef} />
          </>
        )}

        {activeLookup ? (() => {
          const activeLookupCue = subtitleCues[activeLookup.cueIndex];
          const activeLookupTranslation = translations[activeLookup.cueIndex] ?? "";
          // Clamp horizontally so card doesn't overflow off-screen
          const cardLeft = Math.min(activeLookup.anchorX, window.innerWidth - 340);
          // Flip above the word if too close to bottom
          const cardTop = activeLookup.anchorY + 260 > window.innerHeight
            ? activeLookup.anchorY - 280
            : activeLookup.anchorY;
          return (
            <div
              className="fixed z-50"
              style={{ left: cardLeft, top: cardTop, width: 320 }}
            >
              <LookupCard
                currentTimeSec={currentTimeSec}
                form={activeLookup.form}
                onClose={() => setActiveLookup(null)}
                originalSentence={activeLookupCue?.text ?? ""}
                translatedSentence={activeLookupTranslation}
              />
            </div>
          );
        })() : null}

        {!followMode && activeCue ? (
          <button
            className="fixed bottom-8 right-[max(2rem,calc(37vw-7rem))] z-20 rounded-full border border-green-200 bg-white px-4 py-2 text-xs font-medium text-green-700 shadow-sm transition hover:bg-green-50"
            onClick={() => {
              returnToCurrentCue();
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
