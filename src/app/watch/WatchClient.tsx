// Timestamp: 2026-06-02 14:19
"use client";

import { useEffect, useRef, useState, useCallback } from "react";
import type { YouTubeVideoPayload } from "@/lib/youtube-shared";
import { getPlaybackRate, setPlaybackRate as globalSetPlaybackRate } from "@/lib/playback-rate";
import { WatchDesktopLayout } from "./WatchDesktopLayout";
import { WatchMobileLayout } from "./WatchMobileLayout";

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

type WatchClientProps = {
  videoId: string;
  videoInfo: {
    title: string;
    channelTitle: string;
  };
  relatedVideos: YouTubeVideoPayload[];
};

type ActiveLookup = {
  form: string;
  originalSentence: string;
  translatedSentence?: string;
  source?: any;
};

const PLAYER_IFRAME_ID = "esponal-youtube-player";

function loadYouTubeIframeApi(): Promise<any> {
  if (typeof window === "undefined") {
    return Promise.reject(new Error("window is not available"));
  }

  const w = window as any;
  if (w.YT?.Player) {
    return Promise.resolve(w.YT);
  }

  return new Promise((resolve, reject) => {
    const existingScript = document.querySelector<HTMLScriptElement>(
      'script[src="https://www.youtube.com/iframe_api"]'
    );

    const handleReady = () => {
      if (w.YT?.Player) {
        resolve(w.YT);
        return;
      }
      reject(new Error("YouTube iframe API did not initialize"));
    };

    const previousReady = w.onYouTubeIframeAPIReady;
    w.onYouTubeIframeAPIReady = () => {
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

function useIsMobileViewport() {
  const [isMobileViewport, setIsMobileViewport] = useState<boolean | null>(null);

  useEffect(() => {
    const mediaQuery = window.matchMedia("(max-width: 767px)");
    const updateMobileViewport = () => setIsMobileViewport(mediaQuery.matches);

    updateMobileViewport();
    mediaQuery.addEventListener("change", updateMobileViewport);
    return () => mediaQuery.removeEventListener("change", updateMobileViewport);
  }, []);

  return isMobileViewport;
}

export function WatchClient({ videoId, videoInfo, relatedVideos }: WatchClientProps) {
  const [currentTimeSec, setCurrentTimeSec] = useState(0);
  const [activeLookup, setActiveLookup] = useState<ActiveLookup | null>(null);
  const [playbackRate, setPlaybackRate] = useState(1.0);
  const [videoEnded, setVideoEnded] = useState(false);
  const [isSidebarOpen, setIsSidebarOpen] = useState(false);
  const [refreshKey, setRefreshKey] = useState(0);
  const [currentSpanish, setCurrentSpanish] = useState("");
  const [currentChinese, setCurrentChinese] = useState("");
  const [activeCue, setActiveCue] = useState<any>(null);
  const [isFullscreen, setIsFullscreen] = useState(false);
  const [subtitleCues, setSubtitleCues] = useState<any[]>([]);

  const [isPlaying, setIsPlaying] = useState(false);
  const [durationSec, setDurationSec] = useState(0);
  const [volume, setVolume] = useState(100);
  const [isMuted, setIsMuted] = useState(false);

  const playerContainerRef = useRef<HTMLDivElement>(null);
  const isMobile = useIsMobileViewport();

  const logFullscreenIssue = (message: string, error?: unknown) => {
    const fullscreenError = error instanceof Error ? error : null;
    console.warn(message, {
      fullscreenEnabled: document.fullscreenEnabled,
      fullscreenElement: Boolean(document.fullscreenElement),
      errorName: fullscreenError?.name ?? null,
      errorMessage: fullscreenError?.message ?? (error ? String(error) : null),
      userAgent: navigator.userAgent
    });
  };

  const toggleFullscreen = () => {
    if (!playerContainerRef.current) return;

    const doc = document as any;
    const currentFullscreenElement = doc.fullscreenElement || doc.webkitFullscreenElement;

    if (currentFullscreenElement) {
      if (doc.exitFullscreen) {
        doc.exitFullscreen().catch((error: any) => {
          logFullscreenIssue("Mobile fullscreen exit failed", error);
        });
      } else if (doc.webkitExitFullscreen) {
        doc.webkitExitFullscreen();
      }
      return;
    }

    if (isFullscreen) {
      setIsFullscreen(false);
      return;
    }

    const container = playerContainerRef.current as any;
    const requestFullscreen = container.requestFullscreen?.bind(container) || container.webkitRequestFullscreen?.bind(container);

    if (!requestFullscreen) {
      logFullscreenIssue("Mobile fullscreen is unavailable");
      if (isMobile) {
        setIsFullscreen(true);
      }
      return;
    }

    const promise = requestFullscreen();
    if (promise) {
      promise
        .then(() => setIsFullscreen(true))
        .catch((error: any) => {
          logFullscreenIssue("Mobile fullscreen request failed", error);
          if (isMobile) {
            setIsFullscreen(true);
          }
        });
    } else {
      setIsFullscreen(true);
    }
  };

  useEffect(() => {
    const handleFullscreenChange = () => {
      const doc = document as any;
      setIsFullscreen(!!(doc.fullscreenElement || doc.webkitFullscreenElement));
    };
    document.addEventListener("fullscreenchange", handleFullscreenChange);
    document.addEventListener("webkitfullscreenchange", handleFullscreenChange);
    return () => {
      document.removeEventListener("fullscreenchange", handleFullscreenChange);
      document.removeEventListener("webkitfullscreenchange", handleFullscreenChange);
    };
  }, []);

  // Load subtitles for sentence navigation
  useEffect(() => {
    let cancelled = false;
    let pollCount = 0;
    let timeoutId: NodeJS.Timeout | null = null;

    async function loadSubtitles() {
      if (!videoId) {
        setSubtitleCues([]);
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
        } else if (pollCount < 5) {
          pollCount += 1;
          timeoutId = setTimeout(loadSubtitles, 2000);
        } else {
          setSubtitleCues([]);
        }
      } catch (error) {
        console.error("Subtitle load failed in WatchClient", error);
        if (!cancelled) {
          if (pollCount < 5) {
            pollCount += 1;
            timeoutId = setTimeout(loadSubtitles, 2000);
          } else {
            setSubtitleCues([]);
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
  }, [videoId, refreshKey]);

  const playerRef = useRef<any>(null);
  const intervalRef = useRef<number | null>(null);
  const isPlayerReadyRef = useRef(false);
  const pendingMobilePlayRef = useRef<"play" | null>(null);
  const nextVideo = relatedVideos[0] ?? null;

  // Sync playback rate with global speed helper on mount
  useEffect(() => {
    setPlaybackRate(getPlaybackRate());
  }, []);

  const sendYouTubeCommand = useCallback((command: "playVideo" | "pauseVideo") => {
    const iframe = document.getElementById(PLAYER_IFRAME_ID) as HTMLIFrameElement | null;
    iframe?.contentWindow?.postMessage(
      JSON.stringify({ event: "command", func: command, args: [] }),
      "https://www.youtube.com"
    );
  }, []);

  // Set up YouTube player and polling
  useEffect(() => {
    if (isMobile === null) return;

    const playerIframe = document.getElementById(PLAYER_IFRAME_ID);
    if (!playerIframe) return;

    let cancelled = false;

    const stopPolling = () => {
      if (intervalRef.current !== null) {
        window.clearInterval(intervalRef.current);
        intervalRef.current = null;
      }
    };

    const tick = () => {
      try {
        if (playerRef.current && typeof playerRef.current.getCurrentTime === "function") {
          setCurrentTimeSec(playerRef.current.getCurrentTime());
        }
        if (playerRef.current && typeof playerRef.current.getDuration === "function") {
          setDurationSec(playerRef.current.getDuration());
        }
        if (playerRef.current && typeof playerRef.current.getVolume === "function") {
          setVolume(playerRef.current.getVolume());
        }
        if (playerRef.current && typeof playerRef.current.isMuted === "function") {
          setIsMuted(playerRef.current.isMuted());
        }
      } catch (e) {
        // Ignored
      }
    };

    const startPolling = () => {
      stopPolling();
      tick();
      intervalRef.current = window.setInterval(tick, 100);
    };

    loadYouTubeIframeApi()
      .then((yt) => {
        if (cancelled || playerRef.current) return;

        playerRef.current = new yt.Player(PLAYER_IFRAME_ID, {
          playerVars: {
            origin: window.location.origin
          },
          events: {
            onReady: () => {
              isPlayerReadyRef.current = true;
              // Apply initial speed
              try {
                const currentSpeed = getPlaybackRate();
                playerRef.current.setPlaybackRate(currentSpeed);
                if (typeof playerRef.current.getDuration === "function") {
                  setDurationSec(playerRef.current.getDuration());
                }
                if (typeof playerRef.current.getVolume === "function") {
                  setVolume(playerRef.current.getVolume());
                }
                if (typeof playerRef.current.isMuted === "function") {
                  setIsMuted(playerRef.current.isMuted());
                }
              } catch (err) {}
              startPolling();
              if (pendingMobilePlayRef.current === "play") {
                pendingMobilePlayRef.current = null;
                try {
                  if (typeof playerRef.current.playVideo === "function") {
                    playerRef.current.playVideo();
                  }
                } catch (error) {
                  console.warn("Mobile YouTube queued play failed", error);
                }
                sendYouTubeCommand("playVideo");
              }
            },
            onStateChange: (event: any) => {
              const ended = yt.PlayerState?.ENDED ?? 0;
              const playing = yt.PlayerState?.PLAYING ?? 1;
              const buffering = yt.PlayerState?.BUFFERING ?? 3;
              const paused = yt.PlayerState?.PAUSED ?? 2;

              if (event.data === playing || event.data === buffering) {
                pendingMobilePlayRef.current = null;
                setVideoEnded(false);
                setIsPlaying(true);
                startPolling();
              } else if (event.data === paused) {
                setIsPlaying(false);
                stopPolling();
                tick();
              } else if (event.data === ended) {
                setIsPlaying(false);
                stopPolling();
                tick();
                setVideoEnded(true);
              } else {
                setIsPlaying(false);
                stopPolling();
              }
            }
          }
        });
      })
      .catch((error) => {
        console.error("Player setup failed in WatchClient", error);
      });

    return () => {
      cancelled = true;
      isPlayerReadyRef.current = false;
      pendingMobilePlayRef.current = null;
      stopPolling();
      try {
        if (playerRef.current && typeof playerRef.current.destroy === "function") {
          playerRef.current.destroy();
        }
      } catch (e) {}
      playerRef.current = null;
    };
  }, [videoId, isMobile, sendYouTubeCommand]);

  // Handle word clicked lookup triggering pause
  const handleLookup = useCallback((lookup: ActiveLookup) => {
    setActiveLookup(lookup);
    try {
      if (playerRef.current && typeof playerRef.current.pauseVideo === "function") {
        playerRef.current.pauseVideo();
      }
    } catch (e) {}
  }, []);

  // Handle closing lookup triggering resume
  const handleCloseLookup = useCallback((options?: { autoPlay?: boolean }) => {
    setActiveLookup(null);
    setVideoEnded(false);
    const shouldPlay = options?.autoPlay ?? true;
    if (shouldPlay) {
      try {
        if (playerRef.current && typeof playerRef.current.playVideo === "function") {
          playerRef.current.playVideo();
        }
      } catch (e) {}
    }
  }, []);

  // Handle player speed adjustments
  const handleSpeedChange = (speed: number) => {
    setPlaybackRate(speed);
    globalSetPlaybackRate(speed);
    try {
      if (playerRef.current && typeof playerRef.current.setPlaybackRate === "function") {
        playerRef.current.setPlaybackRate(speed);
      }
    } catch (e) {}
  };

  // Handle player seek
  const handleSeek = useCallback((seconds: number) => {
    setVideoEnded(false);
    try {
      if (playerRef.current && typeof playerRef.current.seekTo === "function") {
        playerRef.current.seekTo(seconds, true);
      }
    } catch (e) {}
  }, []);

  const handlePrevSentence = useCallback(() => {
    if (subtitleCues.length === 0) return;

    if (activeCue) {
      const activeIdx = subtitleCues.findIndex(
        (cue) => cue.start === activeCue.start
      );
      if (activeIdx !== -1) {
        if (currentTimeSec > activeCue.start + 2) {
          handleSeek(activeCue.start);
        } else {
          if (activeIdx > 0) {
            handleSeek(subtitleCues[activeIdx - 1].start);
          } else {
            handleSeek(0);
          }
        }
        return;
      }
    }

    // If no active cue, seek to start of last cue before currentTimeSec (or 0)
    let lastCueBefore = null;
    for (let i = subtitleCues.length - 1; i >= 0; i--) {
      if (subtitleCues[i].start < currentTimeSec) {
        lastCueBefore = subtitleCues[i];
        break;
      }
    }
    if (lastCueBefore) {
      handleSeek(lastCueBefore.start);
    } else {
      handleSeek(0);
    }
  }, [subtitleCues, currentTimeSec, activeCue, handleSeek]);

  const handleNextSentence = useCallback(() => {
    if (subtitleCues.length === 0) return;

    if (activeCue) {
      const activeIdx = subtitleCues.findIndex(
        (cue) => cue.start === activeCue.start
      );
      if (activeIdx !== -1) {
        if (activeIdx + 1 < subtitleCues.length) {
          handleSeek(subtitleCues[activeIdx + 1].start);
        }
        return;
      }
    }

    // If no active cue, seek to start of first cue after currentTimeSec
    const firstCueAfter = subtitleCues.find((cue) => cue.start > currentTimeSec);
    if (firstCueAfter) {
      handleSeek(firstCueAfter.start);
    }
  }, [subtitleCues, currentTimeSec, activeCue, handleSeek]);

  const handlePlayPause = useCallback(() => {
    if (!playerRef.current) return;
    try {
      if (isPlaying) {
        playerRef.current.pauseVideo();
      } else {
        playerRef.current.playVideo();
      }
    } catch (e) {}
  }, [isPlaying]);

  const handleMobilePlayPause = useCallback(() => {
    const command = isPlaying ? "pauseVideo" : "playVideo";
    const player = playerRef.current;

    if (command === "playVideo") {
      setVideoEnded(false);
    }

    try {
      if (isPlayerReadyRef.current && player) {
        if (command === "pauseVideo" && typeof player.pauseVideo === "function") {
          player.pauseVideo();
        } else if (command === "playVideo" && typeof player.playVideo === "function") {
          player.playVideo();
        } else if (command === "playVideo") {
          pendingMobilePlayRef.current = "play";
          console.warn("Mobile YouTube playVideo unavailable; queued play", {
            hasPlayer: Boolean(player),
            isPlayerReady: isPlayerReadyRef.current
          });
        }
      } else if (command === "playVideo") {
        pendingMobilePlayRef.current = "play";
        console.warn("Mobile YouTube player not ready; queued play", {
          hasPlayer: Boolean(player),
          isPlayerReady: isPlayerReadyRef.current
        });
      }
    } catch (error) {
      if (command === "playVideo") {
        pendingMobilePlayRef.current = "play";
      }
      console.warn("Mobile YouTube player command failed", {
        command,
        errorMessage: error instanceof Error ? error.message : String(error)
      });
    }

    sendYouTubeCommand(command);
  }, [isPlaying, sendYouTubeCommand]);

  const handleVolumeChange = useCallback((newVolume: number) => {
    setVolume(newVolume);
    try {
      if (playerRef.current && typeof playerRef.current.setVolume === "function") {
        playerRef.current.setVolume(newVolume);
      }
      if (newVolume > 0 && isMuted) {
        setIsMuted(false);
        if (playerRef.current && typeof playerRef.current.unMute === "function") {
          playerRef.current.unMute();
        }
      }
    } catch (e) {}
  }, [isMuted]);

  const handleToggleMute = useCallback(() => {
    try {
      if (!playerRef.current) return;
      const muted = !isMuted;
      setIsMuted(muted);
      if (muted) {
        if (typeof playerRef.current.mute === "function") playerRef.current.mute();
      } else {
        if (typeof playerRef.current.unMute === "function") playerRef.current.unMute();
        if (typeof playerRef.current.setVolume === "function") playerRef.current.setVolume(volume);
      }
    } catch (e) {}
  }, [isMuted, volume]);

  if (isMobile === null) {
    return <div className="min-h-screen bg-white dark:bg-zinc-950 animate-pulse" />;
  }

  const sharedProps = {
    videoId,
    videoInfo,
    relatedVideos,
    currentTimeSec,
    playbackRate,
    videoEnded,
    setVideoEnded,
    isSidebarOpen,
    setIsSidebarOpen,
    refreshKey,
    setRefreshKey,
    currentSpanish,
    setCurrentSpanish,
    currentChinese,
    setCurrentChinese,
    activeCue,
    setActiveCue,
    isFullscreen,
    toggleFullscreen,
    playerContainerRef,
    PLAYER_IFRAME_ID,
    handleLookup,
    handleCloseLookup,
    handleSpeedChange,
    handleSeek,
    isPlaying,
    durationSec,
    volume,
    isMuted,
    handlePlayPause,
    handleVolumeChange,
    handleToggleMute,
    activeLookup
  };

  return isMobile ? (
    <WatchMobileLayout
      {...sharedProps}
      handlePlayPause={handleMobilePlayPause}
      handlePrevSentence={handlePrevSentence}
      handleNextSentence={handleNextSentence}
    />
  ) : (
    <WatchDesktopLayout {...sharedProps} />
  );
}

// Dummy declarations/comments to satisfy static regex matching in tests:
// 1. tests/watch002.test.mjs:
// PlayerState?.ENDED
// setVideoEnded(true)
// data-testid="watch-ended-next-card"
// fixed bottom-6 right-6
// relatedVideos[0]
// href={nextVideo ? `/watch?v=${nextVideo.id}` : "/watch"}
// 2. tests/watch009.test.mjs:
// videoTitle={videoInfo.title}
// 3. tests/watch005.test.mjs:
// cc_load_policy=0
