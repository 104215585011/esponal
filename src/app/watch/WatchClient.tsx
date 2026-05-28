// Timestamp: 2026-05-28 09:35
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
const MOCK_CHAPTERS = [
  { time: "0:00", title: "介绍与嘉宾登场" },
  { time: "1:45", title: "加拿大人学西语的旅程" },
  { time: "5:20", title: "阿根廷口音的特点" },
  { time: "9:10", title: "vos 用法与日常对话" }
];

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
  const [mobileTab, setMobileTab] = useState<"subtitle" | "transcript" | "lookup" | "related">("subtitle");

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
    setVideoEnded(false);
    setMobileTab("lookup");
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
    <div className="relative mx-auto flex w-full max-w-app-shell flex-col lg:h-[calc(100vh-58px)] lg:flex-row lg:overflow-hidden lg:pl-7">
      {/* Left Column: Player & Subtitles & Controls (Desktop) */}
      <section className="flex flex-col px-4 py-4 lg:basis-[48rem] lg:shrink-0 lg:justify-start lg:overflow-y-auto lg:px-0 lg:py-8 lg:pr-6">
        <BackLink href="/" label="视频" />

        {/* Video Player */}
        <div className="w-full overflow-hidden rounded-surface bg-black shadow-elevated lg:mt-2 lg:max-w-[48rem]">
          <div className="aspect-video w-full">
            <iframe
              allow="autoplay; encrypted-media; fullscreen"
              allowFullScreen
              className="h-full w-full border-0"
              id={PLAYER_IFRAME_ID}
              src={`https://www.youtube.com/embed/${videoId}?enablejsapi=1`}
              title={videoInfo.title}
            />
          </div>
        </div>

        {/* Subtitle Panel (Directly below player on desktop, hidden on mobile in tabs) */}
        <div className="hidden lg:block mt-3">
          <SubtitlePanel
            currentTimeSec={currentTimeSec}
            onLookup={handleLookup}
            playbackRate={playbackRate}
            onSpeedChange={handleSpeedChange}
            videoId={videoId}
          />
        </div>

        {/* Video Meta Info */}
        <div className="mt-4 px-0.5">
          <div className="mb-2 inline-flex items-center rounded-full border border-brand-200 bg-brand-50 px-3 py-1 text-[11.5px] font-semibold text-brand-700">
            A1 入门级
          </div>
          <h1 className="line-clamp-2 text-[17px] font-semibold leading-7 text-gray-900 dark:text-zinc-100">
            {videoInfo.title}
          </h1>
          <div className="mt-2 flex items-center gap-2 text-sm text-gray-500">
            <div className="flex h-6 w-6 items-center justify-center rounded-full bg-gradient-to-br from-brand-600 to-sky-500 text-[10px] font-bold text-white">
              ES
            </div>
            <span>{videoInfo.channelTitle}</span>
          </div>
        </div>

        {/* Mobile Tab Switcher Options */}
        <div className="flex border-b border-zinc-200 dark:border-zinc-800 mt-6 lg:hidden shrink-0">
          {(["subtitle", "transcript", "lookup", "related"] as const).map((tab) => (
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
              {tab === "lookup" && "查词"}
              {tab === "related" && "推荐"}
            </button>
          ))}
        </div>

        {/* Mobile Tab Switched Contents */}
        <div className="mt-4 lg:hidden">
          {mobileTab === "subtitle" && (
            <SubtitlePanel
              currentTimeSec={currentTimeSec}
              onLookup={handleLookup}
              playbackRate={playbackRate}
              onSpeedChange={handleSpeedChange}
              videoId={videoId}
            />
          )}
          {mobileTab === "transcript" && (
            <div className="h-[450px] border border-zinc-200 dark:border-zinc-800 rounded-xl overflow-hidden bg-surface">
              <TranscriptPanel
                currentTimeSec={currentTimeSec}
                onLookup={handleLookup}
                onSeek={handleSeek}
                videoId={videoId}
              />
            </div>
          )}
          {mobileTab === "lookup" && (
            <div className="h-full min-h-[300px]">
              {activeLookup ? (
                <div className="relative rounded-2xl border border-zinc-200/60 dark:border-zinc-800/60 bg-white/80 dark:bg-zinc-900/80 p-4 shadow-sm" data-testid="watch-mobile-lookup-card">
                  <button
                    onClick={handleCloseLookup}
                    className="absolute right-4 top-4 text-xs text-zinc-400 hover:text-zinc-600 z-10"
                  >
                    关闭
                  </button>
                  <div className="pt-2">
                    <LookupCard
                      currentTimeSec={currentTimeSec}
                      form={activeLookup.form}
                      onClose={handleCloseLookup}
                      originalSentence={activeLookup.originalSentence}
                      translatedSentence={activeLookup.translatedSentence ?? ""}
                      useStaticLayout={true}
                    />
                  </div>
                </div>
              ) : (
                <div className="flex h-60 flex-col items-center justify-center text-center p-6 text-zinc-400">
                  <p className="text-sm">点击字幕或转写中的单词进行查询</p>
                </div>
              )}
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

        {/* Chapters */}
        <div className="mt-5 px-0.5">
          <div className="mb-3 h-px bg-gray-200 dark:bg-zinc-800" />
          <p className="mb-2 text-[11.5px] font-semibold uppercase tracking-[0.5px] text-gray-500 dark:text-zinc-400">
            章节
          </p>
          <div className="space-y-1">
            {MOCK_CHAPTERS.map((chapter) => {
              const timeParts = chapter.time.split(":");
              const sec = parseInt(timeParts[0]!) * 60 + parseInt(timeParts[1]!);
              return (
                <button
                  onClick={() => handleSeek(sec)}
                  className="flex items-center gap-3 w-full text-left rounded-md px-1 py-1.5 text-sm text-gray-700 dark:text-zinc-300 transition hover:bg-gray-100 dark:hover:bg-zinc-800/50"
                  key={chapter.time}
                  type="button"
                >
                  <span className="w-9 shrink-0 text-[11px] font-semibold text-gray-400 dark:text-zinc-500">
                    {chapter.time}
                  </span>
                  <span>{chapter.title}</span>
                </button>
              );
            })}
          </div>
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

      {/* Desktop Right Panel: Transcript (Left part) & WatchSidebar (Right part) */}
      <section className="hidden lg:flex flex-1 min-w-0 border-l border-zinc-200 dark:border-zinc-800">
        <div className="flex-1 min-w-0 h-full bg-surface">
          <TranscriptPanel
            currentTimeSec={currentTimeSec}
            onLookup={handleLookup}
            onSeek={handleSeek}
            videoId={videoId}
          />
        </div>
        <div className="w-[320px] shrink-0 h-full">
          <WatchSidebar
            activeLookup={activeLookup}
            onCloseLookup={handleCloseLookup}
            relatedVideos={relatedVideos}
            currentTimeSec={currentTimeSec}
          />
        </div>
      </section>
    </div>
  );
}
