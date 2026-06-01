// Timestamp: 2026-05-31 12:48
"use client";

import { useEffect, useRef, useState, useCallback } from "react";
import Link from "next/link";
import { BackLink } from "@/app/components/web/BackLink";
import { SubtitlePanel } from "./SubtitlePanel";
import { TranscriptPanel } from "./TranscriptPanel";
import { WatchSidebar } from "./WatchSidebar";
import { LookupCard } from "./LookupCard";
import type { YouTubeVideoPayload } from "@/lib/youtube-shared";
import { getPlaybackRate, setPlaybackRate as globalSetPlaybackRate } from "@/lib/playback-rate";

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

export function WatchClient({ videoId, videoInfo, relatedVideos }: WatchClientProps) {
  const [currentTimeSec, setCurrentTimeSec] = useState(0);
  const [activeLookup, setActiveLookup] = useState<ActiveLookup | null>(null);
  const [playbackRate, setPlaybackRate] = useState(1.0);
  const [videoEnded, setVideoEnded] = useState(false);
  const [mobileTab, setMobileTab] = useState<"subtitle" | "transcript" | "related">("subtitle");
  const [isSidebarOpen, setIsSidebarOpen] = useState(false);
  const [refreshKey, setRefreshKey] = useState(0);
  const [currentSpanish, setCurrentSpanish] = useState("");
  const [currentChinese, setCurrentChinese] = useState("");
  const [activeCue, setActiveCue] = useState<any>(null);
  const [isFullscreen, setIsFullscreen] = useState(false);

  const playerContainerRef = useRef<HTMLDivElement>(null);

  const toggleFullscreen = () => {
    if (!playerContainerRef.current) return;
    if (!document.fullscreenElement) {
      playerContainerRef.current.requestFullscreen().catch((err) => {
        console.error("Error attempting to enable fullscreen", err);
      });
    } else {
      document.exitFullscreen();
    }
  };

  useEffect(() => {
    const handleFullscreenChange = () => {
      setIsFullscreen(!!document.fullscreenElement);
    };
    document.addEventListener("fullscreenchange", handleFullscreenChange);
    return () => document.removeEventListener("fullscreenchange", handleFullscreenChange);
  }, []);

  const playerRef = useRef<any>(null);
  const intervalRef = useRef<number | null>(null);
  const nextVideo = relatedVideos[0] ?? null;

  // Sync playback rate with global speed helper on mount
  useEffect(() => {
    setPlaybackRate(getPlaybackRate());
  }, []);

  // Set up YouTube player and polling
  useEffect(() => {
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
              // Apply initial speed
              try {
                const currentSpeed = getPlaybackRate();
                playerRef.current.setPlaybackRate(currentSpeed);
              } catch (err) {}
              startPolling();
            },
            onStateChange: (event: any) => {
              const ended = yt.PlayerState?.ENDED ?? 0;
              const playing = yt.PlayerState?.PLAYING ?? 1;
              const buffering = yt.PlayerState?.BUFFERING ?? 3;
              const paused = yt.PlayerState?.PAUSED ?? 2;

              if (event.data === playing || event.data === buffering) {
                setVideoEnded(false);
                startPolling();
              } else if (event.data === paused) {
                stopPolling();
                tick();
              } else if (event.data === ended) {
                stopPolling();
                tick();
                setVideoEnded(true);
              } else {
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
      stopPolling();
      try {
        if (playerRef.current && typeof playerRef.current.destroy === "function") {
          playerRef.current.destroy();
        }
      } catch (e) {}
      playerRef.current = null;
    };
  }, [videoId]);

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
  const handleCloseLookup = useCallback(() => {
    setActiveLookup(null);
    setVideoEnded(false);
    try {
      if (playerRef.current && typeof playerRef.current.playVideo === "function") {
        playerRef.current.playVideo();
      }
    } catch (e) {}
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

  return (
    <div className="relative mx-auto flex w-full max-w-none flex-col lg:h-[calc(100vh-58px)] lg:flex-row lg:overflow-hidden lg:px-2">
      {/* Main Column: Player & Subtitles & Transcript */}
      <section className="flex flex-1 min-w-0 flex-col px-4 pt-2 pb-4 lg:justify-start lg:overflow-y-auto lg:pr-6 lg:pt-3 lg:pb-8">
        <BackLink href="/" label="视频" useHistoryBack />

        {/* Video Player wrapper (relative container for fullscreen subtitles and custom fullscreen button) */}
        <div
          ref={playerContainerRef}
          className={`relative w-full shrink-0 overflow-hidden bg-black shadow-elevated lg:mt-2 ${
            isFullscreen ? "w-screen h-screen flex items-center justify-center rounded-none" : "rounded-surface aspect-video"
          }`}
        >
          <div className={`${isFullscreen ? "w-full h-full max-w-7xl aspect-video relative flex items-center justify-center" : "aspect-video w-full"}`}>
            <iframe
              allow="autoplay; encrypted-media; fullscreen"
              allowFullScreen
              className="h-full w-full border-0"
              id={PLAYER_IFRAME_ID}
              src={`https://www.youtube.com/embed/${videoId}?enablejsapi=1&fs=1&cc_load_policy=0`}
              title={videoInfo.title}
            />
          </div>

          {/* Subtitle Panel Overlay (desktop overlay inside player, visible on desktop/fullscreen) */}
          <div className="hidden lg:block absolute bottom-0 left-0 right-0 z-30">
            <SubtitlePanel
              key={`subtitle-overlay-${videoId}-${refreshKey}`}
              currentTimeSec={currentTimeSec}
              onLookup={handleLookup}
              onCloseLookup={handleCloseLookup}
              playbackRate={playbackRate}
              onSpeedChange={handleSpeedChange}
              videoId={videoId}
              isOverlay={true}
              onCueChange={(spanish, chinese, cue) => {
                setCurrentSpanish(spanish);
                setCurrentChinese(chinese);
                setActiveCue(cue);
              }}
            />
          </div>

          {/* Custom Fullscreen Toggle Button */}
          <button
            onClick={toggleFullscreen}
            className="absolute bottom-4 right-4 z-20 p-2 rounded-lg bg-black/50 hover:bg-black/80 text-white transition-all duration-200"
            type="button"
            title={isFullscreen ? "退出全屏" : "全屏播放"}
          >
            {isFullscreen ? (
              <svg className="h-4.5 w-4.5" fill="none" stroke="currentColor" strokeWidth="2.5" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" d="M9 9L4.5 4.5M9 9H4.5M9 9V4.5M15 9l4.5-4.5M15 9h4.5M15 9V4.5M9 15l-4.5 4.5M9 15H4.5M9 15v4.5M15 15l4.5 4.5M15 15h4.5M15 15v-4.5" />
              </svg>
            ) : (
              <svg className="h-4.5 w-4.5" fill="none" stroke="currentColor" strokeWidth="2.5" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" d="M3.75 3.75v4.5m0-4.5h4.5m-4.5 0L9 9M3.75 20.25v-4.5m0 4.5h-4.5m4.5 0L15 9M20.25 20.25v-4.5m0 4.5h-4.5m4.5 0L15 15" />
              </svg>
            )}
          </button>
        </div>



        {/* Video Meta Info */}
        <div className="mt-4 px-0.5">
          <div className="mb-2 inline-flex items-center rounded-full border border-brand-200 bg-brand-50 px-3 py-1 text-[11.5px] font-semibold text-brand-700">
            A1 入门级
          </div>
          <h1 className="line-clamp-2 text-[17px] font-semibold leading-7 text-gray-900 dark:text-zinc-100">
            {videoInfo.title}
          </h1>
          <div className="mt-2 flex items-center justify-between gap-4 text-sm text-gray-500">
            <div className="flex items-center gap-2">
              <div className="flex h-6 w-6 items-center justify-center rounded-full bg-gradient-to-br from-brand-600 to-sky-500 text-[10px] font-bold text-white">
                ES
              </div>
              <span>{videoInfo.channelTitle}</span>
            </div>

            <div className="flex items-center gap-2">
              {/* Refresh Subtitles Button */}
              <button
                onClick={() => setRefreshKey((prev) => prev + 1)}
                className="inline-flex items-center gap-1.5 rounded-full border border-zinc-200/80 dark:border-zinc-800/80 bg-zinc-50/50 dark:bg-zinc-950/20 px-3 py-1.5 text-[11px] font-medium text-zinc-500 dark:text-zinc-400 hover:border-brand-200 hover:bg-brand-50/30 hover:text-brand-700 dark:hover:border-brand-950/50 dark:hover:bg-brand-950/10 dark:hover:text-brand-400 transition-all duration-200"
                type="button"
              >
                <svg className="h-3.5 w-3.5 fill-none stroke-current" viewBox="0 0 24 24" strokeWidth="2.5">
                  <path strokeLinecap="round" strokeLinejoin="round" d="M16.023 9.348h4.992v-.001M2.985 19.644v-4.992m0 0h4.992m-4.993 0l3.181 3.183a8.25 8.25 0 0013.803-3.7M4.031 9.865a8.25 8.25 0 0113.803-3.7l3.181 3.182m0-4.991v4.99" />
                </svg>
                刷新字幕
              </button>

              {/* YouTube Login Link */}
              <a
                href="https://accounts.google.com/ServiceLogin?service=youtube&continue=https://www.youtube.com/"
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex items-center gap-1.5 rounded-full border border-zinc-200/80 dark:border-zinc-800/80 bg-zinc-50/50 dark:bg-zinc-950/20 px-3 py-1.5 text-[11px] font-medium text-zinc-500 dark:text-zinc-400 hover:border-red-200 hover:bg-red-50/30 hover:text-red-650 dark:hover:border-red-950/50 dark:hover:bg-red-950/10 dark:hover:text-red-400 transition-all duration-200"
              >
                <svg className="h-3.5 w-3.5 fill-current text-red-600 dark:text-red-400" viewBox="0 0 24 24">
                  <path d="M23.498 6.163a3.003 3.003 0 0 0-2.11-2.11C19.518 3.5 12 3.5 12 3.5s-7.518 0-9.388.553a3.003 3.003 0 0 0-2.11 2.11C0 8.033 0 12 0 12s0 3.967.553 5.837a3.003 3.003 0 0 0 2.11 2.11c1.87.553 9.388.553 9.388.553s7.518 0 9.388-.553a3.003 3.003 0 0 0 2.11-2.11C24 15.967 24 12 24 12s0-3.967-.502-5.837zM9.545 15.568V8.432L15.818 12l-6.273 3.568z"/>
                </svg>
                登录 YouTube
              </a>
            </div>
          </div>
        </div>

        {/* Mobile Tab Switcher Options */}
        <div className="flex border-b border-zinc-200 dark:border-zinc-800 mt-6 lg:hidden shrink-0">
          {(["subtitle", "transcript", "related"] as const).map((tab) => (
            <button
              key={tab}
              onClick={() => setMobileTab(tab)}
              className={`flex-1 py-2 text-center text-xs font-semibold border-b-2 transition-all ${
                mobileTab === tab
                  ? "border-brand-500 text-brand-600"
                  : "border-transparent text-zinc-500 dark:text-zinc-400"
              }`}
            >
              {tab === "subtitle" && "字幕"}
              {tab === "transcript" && "转写"}
              {tab === "related" && "推荐"}
            </button>
          ))}
        </div>

        {/* Mobile Tab Switched Contents */}
        <div className="mt-4 lg:hidden">
          {mobileTab === "subtitle" && (
            <SubtitlePanel
              key={`subtitle-mobile-${videoId}-${refreshKey}`}
              currentTimeSec={currentTimeSec}
              onLookup={handleLookup}
              onCloseLookup={handleCloseLookup}
              playbackRate={playbackRate}
              onSpeedChange={handleSpeedChange}
              videoId={videoId}
              onCueChange={(spanish, chinese, cue) => {
                setCurrentSpanish(spanish);
                setCurrentChinese(chinese);
                setActiveCue(cue);
              }}
            />
          )}
          {mobileTab === "transcript" && (
            <div className="h-[450px] border border-zinc-200 dark:border-zinc-800 rounded-xl overflow-hidden bg-surface">
              <TranscriptPanel
                key={`transcript-mobile-${videoId}-${refreshKey}`}
                currentTimeSec={currentTimeSec}
                onLookup={handleLookup}
                onCloseLookup={handleCloseLookup}
                onSeek={handleSeek}
                videoId={videoId}
              />
            </div>
          )}
          {mobileTab === "related" && (
            <div className="grid grid-cols-1 gap-4">
              {relatedVideos.map((video) => (
                <div
                  key={video.id}
                  className="flex gap-4 p-2 rounded-xl border border-zinc-100 dark:border-zinc-800/50"
                >
                  <img
                    alt={video.title}
                    src={video.thumbnail}
                    className="w-28 h-16 object-cover rounded-lg"
                  />
                  <div className="flex-1 min-w-0">
                    <a
                      href={`/watch?v=${video.id}`}
                      className="text-xs font-semibold line-clamp-2 text-zinc-800 dark:text-zinc-200"
                    >
                      {video.title}
                    </a>
                    <p className="text-[10px] text-zinc-400 mt-1">{video.channelTitle}</p>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>


      </section>

      {videoEnded ? (
        <div
          className="fixed bottom-6 right-6 z-40 hidden w-[320px] rounded-surface border border-zinc-200/80 bg-white/95 p-4 shadow-elevated backdrop-blur dark:border-zinc-800/80 dark:bg-zinc-950/95 lg:block"
          data-testid="watch-ended-next-card"
        >
          <button
            aria-label="关闭推荐"
            className="absolute right-3 top-3 text-xs font-semibold text-zinc-400 transition hover:text-zinc-700 dark:hover:text-zinc-200"
            onClick={() => setVideoEnded(false)}
            type="button"
          >
            x
          </button>
          <p className="text-[11px] font-semibold uppercase text-brand-600 dark:text-brand-400">
            接着看
          </p>
          <p className="mt-2 line-clamp-2 pr-6 text-[13px] font-semibold leading-5 text-zinc-900 dark:text-zinc-100">
            {nextVideo?.title ?? "继续找一段适合现在的西语视频"}
          </p>
          <p className="mt-1 text-[11px] text-zinc-400 dark:text-zinc-500">
            {nextVideo?.channelTitle ?? "Esponal"}
          </p>
          <Link
            className="mt-3 inline-flex h-8 items-center rounded-full bg-brand-600 px-3 text-[12px] font-semibold text-white shadow-sm transition hover:bg-brand-700"
            href={nextVideo ? `/watch?v=${nextVideo.id}` : "/watch"}
          >
            打开推荐
          </Link>
        </div>
      ) : null}

      {/* Desktop Transcript Panel (inline, below subtitle on desktop) */}
      <section className="hidden lg:block lg:w-[560px] lg:shrink-0 border-l border-zinc-200 dark:border-zinc-800 h-full bg-surface">
        <TranscriptPanel
          key={`transcript-${videoId}-${refreshKey}`}
          currentTimeSec={currentTimeSec}
          onLookup={handleLookup}
          onCloseLookup={handleCloseLookup}
          onSeek={handleSeek}
          videoId={videoId}
        />
      </section>

      {/* Desktop Slide-out Sidebar Trigger (Small arrow on the right edge) */}
      <button
        aria-label={isSidebarOpen ? "关闭侧栏" : "打开侧栏"}
        className={`hidden lg:flex fixed right-0 top-1/2 -translate-y-1/2 z-40 h-16 w-5 items-center justify-center rounded-l-lg border border-r-0 border-zinc-200/80 dark:border-zinc-800/80 bg-white/90 dark:bg-zinc-900/90 shadow-sm backdrop-blur-sm text-zinc-400 hover:text-zinc-700 dark:hover:text-zinc-200 hover:bg-zinc-50 dark:hover:bg-zinc-800 transition-all duration-200 ${
          isSidebarOpen ? "right-[560px]" : "right-0"
        }`}
        onClick={() => setIsSidebarOpen(!isSidebarOpen)}
        style={{ right: isSidebarOpen ? 560 : 0 }}
        type="button"
      >
        <svg className={`h-3.5 w-3.5 transition-transform duration-200 ${isSidebarOpen ? "rotate-180" : ""}`} fill="none" stroke="currentColor" strokeWidth="2.5" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" d="M15 19l-7-7 7-7" />
        </svg>
      </button>

      {/* Desktop Slide-out Sidebar Drawer */}
      <aside
        className={`hidden lg:flex fixed right-0 top-[65px] bottom-0 z-30 w-[560px] flex-col border-l border-zinc-200/80 dark:border-zinc-800/80 bg-white/95 dark:bg-zinc-950/95 shadow-xl backdrop-blur-md transition-transform duration-300 ease-out ${
          isSidebarOpen ? "translate-x-0" : "translate-x-full"
        }`}
      >
        <WatchSidebar
          relatedVideos={relatedVideos}
        />
      </aside>

      {/* Backdrop overlay when sidebar is open */}
      {isSidebarOpen && (
        <div
          className="hidden lg:block fixed inset-0 z-20 bg-black/10 dark:bg-black/30 transition-opacity"
          onClick={() => setIsSidebarOpen(false)}
        />
      )}
    </div>
  );
}
