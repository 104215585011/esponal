"use client";

import { useEffect, useMemo, useRef, useState } from "react";

type SubtitleCue = {
  start: number;
  dur: number;
  text: string;
};

type SubtitlePanelProps = {
  iframeId: string;
  videoId: string;
};

type TranslateResponse = {
  translation?: string;
};

type YouTubePlayerStateChangeEvent = {
  data: number;
};

type YouTubePlayer = {
  destroy: () => void;
  getCurrentTime: () => number;
};

type YouTubePlayerConstructor = new (
  elementId: string,
  config: {
    events?: {
      onReady?: () => void;
      onStateChange?: (event: YouTubePlayerStateChangeEvent) => void;
    };
  }
) => YouTubePlayer;

type YouTubeNamespace = {
  Player: YouTubePlayerConstructor;
  PlayerState?: {
    PLAYING?: number;
    PAUSED?: number;
    BUFFERING?: number;
  };
};

declare global {
  interface Window {
    YT?: YouTubeNamespace;
    onYouTubeIframeAPIReady?: () => void;
  }
}

function findActiveCue(cues: SubtitleCue[], currentTime: number) {
  return (
    cues.find(
      (cue) => currentTime >= cue.start && currentTime <= cue.start + cue.dur
    ) ?? null
  );
}

function loadYouTubeIframeApi() {
  if (typeof window === "undefined") {
    return Promise.reject(new Error("window is not available"));
  }

  if (window.YT?.Player) {
    return Promise.resolve(window.YT);
  }

  return new Promise<YouTubeNamespace>((resolve, reject) => {
    const existingScript = document.querySelector<HTMLScriptElement>(
      'script[src="https://www.youtube.com/iframe_api"]'
    );

    const handleReady = () => {
      if (window.YT?.Player) {
        resolve(window.YT);
        return;
      }

      reject(new Error("YouTube iframe API did not initialize"));
    };

    const previousReady = window.onYouTubeIframeAPIReady;
    window.onYouTubeIframeAPIReady = () => {
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

export function SubtitlePanel({ iframeId, videoId }: SubtitlePanelProps) {
  const [showChinese, setShowChinese] = useState(true);
  const [subtitleCues, setSubtitleCues] = useState<SubtitleCue[]>([]);
  const [spanishLine, setSpanishLine] = useState("");
  const [chineseLine, setChineseLine] = useState("");
  const [hasLoadedSubtitles, setHasLoadedSubtitles] = useState(false);
  const translationCacheRef = useRef<Map<string, string>>(new Map());
  const playerRef = useRef<YouTubePlayer | null>(null);
  const intervalRef = useRef<number | null>(null);
  const activeCueText = useMemo(() => spanishLine.trim(), [spanishLine]);

  useEffect(() => {
    let cancelled = false;

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
          {
            cache: "no-store"
          }
        );

        if (!response.ok) {
          throw new Error(`Subtitle request failed: ${response.status}`);
        }

        const payload = (await response.json()) as SubtitleCue[];

        if (cancelled) {
          return;
        }

        setSubtitleCues(Array.isArray(payload) ? payload : []);
      } catch (error) {
        console.error("Subtitle load failed", error);

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

    const syncSubtitle = () => {
      const currentTime = playerRef.current?.getCurrentTime?.() ?? 0;
      const activeCue = findActiveCue(subtitleCues, currentTime);
      const nextSpanish = activeCue?.text ?? "";

      setSpanishLine((previous) => (previous === nextSpanish ? previous : nextSpanish));
    };

    const startPolling = () => {
      stopPolling();
      syncSubtitle();
      intervalRef.current = window.setInterval(() => {
        syncSubtitle();
      }, 100);
    };

    void loadYouTubeIframeApi()
      .then((yt) => {
        if (cancelled) {
          return;
        }

        playerRef.current = new yt.Player(iframeId, {
          events: {
            onReady: () => {
              syncSubtitle();
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
                syncSubtitle();
                return;
              }

              stopPolling();
            }
          }
        });
      })
      .catch((error) => {
        console.error("Player setup failed", error);
      });

    return () => {
      cancelled = true;
      stopPolling();
      playerRef.current?.destroy?.();
      playerRef.current = null;
    };
  }, [iframeId, subtitleCues, videoId]);

  useEffect(() => {
    let cancelled = false;

    async function translateCurrentLine() {
      if (!activeCueText) {
        setChineseLine("");
        return;
      }

      const cached = translationCacheRef.current.get(activeCueText);

      if (cached) {
        setChineseLine(cached);
        return;
      }

      setChineseLine("…");

      try {
        const response = await fetch("/api/translate", {
          method: "POST",
          headers: {
            "Content-Type": "application/json"
          },
          body: JSON.stringify({ text: activeCueText })
        });

        if (!response.ok) {
          throw new Error(`Translate request failed: ${response.status}`);
        }

        const payload = (await response.json()) as TranslateResponse;
        const translation = payload.translation?.trim() || activeCueText;

        translationCacheRef.current.set(activeCueText, translation);

        if (!cancelled) {
          setChineseLine(translation);
        }
      } catch (error) {
        console.error("Subtitle translate failed", error);

        if (!cancelled) {
          setChineseLine(activeCueText);
        }
      }
    }

    void translateCurrentLine();

    return () => {
      cancelled = true;
    };
  }, [activeCueText]);

  const showEmptyState = hasLoadedSubtitles && subtitleCues.length === 0 && !spanishLine;

  return (
    <section className="min-h-20 rounded-b-xl bg-[#1A1A1A] px-6 py-3 text-center">
      <div className="mb-2 flex justify-end">
        <button
          className="text-xs text-white/40 transition hover:text-white/70"
          onClick={() => setShowChinese((value) => !value)}
          type="button"
        >
          {showChinese ? "隐藏中文" : "显示中文"}
        </button>
      </div>
      <p className="text-sm leading-6 text-white/75">
        {spanishLine || (showEmptyState ? "暂无字幕" : "")}
      </p>
      <p className={`mt-1.5 text-lg font-medium leading-7 text-white ${showChinese ? "" : "hidden"}`}>
        {showEmptyState ? "" : chineseLine || "…"}
      </p>
      {showEmptyState ? (
        <p className="mt-1 text-xs text-white/20">暂无字幕</p>
      ) : null}
    </section>
  );
}
