// Timestamp: 2026-06-01 17:32
"use client";

import { useState, useEffect, useRef } from "react";
import Link from "next/link";
import { BackLink } from "@/app/components/web/BackLink";
import { SubtitlePanel } from "./SubtitlePanel";
import { TranscriptPanel } from "./TranscriptPanel";
import type { YouTubeVideoPayload } from "@/lib/youtube-shared";
import { formatTimestamp } from "./pdf-helpers";

type ActiveLookup = {
  form: string;
  originalSentence: string;
  translatedSentence?: string;
  source?: any;
};

type WatchMobileLayoutProps = {
  videoId: string;
  videoInfo: {
    title: string;
    channelTitle: string;
  };
  relatedVideos: YouTubeVideoPayload[];
  currentTimeSec: number;
  playbackRate: number;
  videoEnded: boolean;
  setVideoEnded: (ended: boolean) => void;
  refreshKey: number;
  setRefreshKey: (key: number | ((prev: number) => number)) => void;
  currentSpanish: string;
  setCurrentSpanish: (spanish: string) => void;
  currentChinese: string;
  setCurrentChinese: (chinese: string) => void;
  activeCue: any;
  setActiveCue: (cue: any) => void;
  isFullscreen: boolean;
  toggleFullscreen: () => void;
  playerContainerRef: React.RefObject<HTMLDivElement>;
  PLAYER_IFRAME_ID: string;
  handleLookup: (lookup: ActiveLookup) => void;
  handleCloseLookup: (options?: { autoPlay?: boolean }) => void;
  handleSpeedChange: (speed: number) => void;
  handleSeek: (seconds: number) => void;
  isPlaying: boolean;
  durationSec: number;
  volume: number;
  isMuted: boolean;
  handlePlayPause: () => void;
  handleVolumeChange: (volume: number) => void;
  handleToggleMute: () => void;
};

export function WatchMobileLayout({
  videoId,
  videoInfo,
  relatedVideos,
  currentTimeSec,
  playbackRate,
  videoEnded,
  setVideoEnded,
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
  handleToggleMute
}: WatchMobileLayoutProps) {
  const [mobileTab, setMobileTab] = useState<"subtitle" | "transcript" | "related">("subtitle");
  const [showControls, setShowControls] = useState(false);
  const [isSpeedMenuOpen, setIsSpeedMenuOpen] = useState(false);
  const [isVolumeOpen, setIsVolumeOpen] = useState(false);
  const timerRef = useRef<NodeJS.Timeout | null>(null);

  const resetHidingTimer = () => {
    if (timerRef.current) {
      clearTimeout(timerRef.current);
    }
    timerRef.current = setTimeout(() => {
      setShowControls(false);
    }, 3000);
  };

  const handlePlayerTap = () => {
    setShowControls((prev) => {
      const next = !prev;
      if (next && isPlaying) {
        resetHidingTimer();
      }
      return next;
    });
  };

  useEffect(() => {
    if (isPlaying && showControls) {
      resetHidingTimer();
    }
    return () => {
      if (timerRef.current) clearTimeout(timerRef.current);
    };
  }, [isPlaying, showControls]);

  useEffect(() => {
    if (!showControls) {
      setIsSpeedMenuOpen(false);
      setIsVolumeOpen(false);
    }
  }, [showControls]);

  useEffect(() => {
    const handleOutsideClick = () => {
      setIsSpeedMenuOpen(false);
    };
    document.addEventListener("click", handleOutsideClick);
    return () => document.removeEventListener("click", handleOutsideClick);
  }, []);

  return (
    <div className="relative flex w-full flex-col bg-white dark:bg-zinc-950 min-h-screen">
      {/* Sticky Video Player container */}
      <div
        ref={playerContainerRef}
        className={`sticky top-0 z-40 w-full shrink-0 overflow-hidden bg-black shadow-md aspect-video`}
      >
        <div className="w-full h-full relative" onClick={handlePlayerTap}>
          <iframe
            allow="autoplay; encrypted-media; fullscreen"
            allowFullScreen
            className="h-full w-full border-0 pointer-events-none"
            id={PLAYER_IFRAME_ID}
            src={`https://www.youtube.com/embed/${videoId}?enablejsapi=1&fs=1&cc_load_policy=0&controls=0&disablekb=1&rel=0`}
            title={videoInfo.title}
          />
          {/* Invisible tap target layer */}
          <div className="absolute inset-0 z-10 cursor-pointer" />
        </div>

        {/* Giant play/pause toggle in the center on mobile */}
        <div
          className={`absolute inset-0 z-20 bg-black/30 flex items-center justify-center transition-opacity duration-300 pointer-events-none ${
            showControls ? "opacity-100" : "opacity-0"
          }`}
        >
          <button
            onClick={(e) => {
              e.stopPropagation();
              handlePlayPause();
              if (isPlaying) {
                resetHidingTimer();
              }
            }}
            className="h-14 w-14 flex items-center justify-center rounded-full bg-black/60 text-white shadow-lg active:scale-95 transition-all pointer-events-auto"
            type="button"
          >
            {isPlaying ? (
              <svg className="h-6 w-6 fill-current" viewBox="0 0 24 24">
                <path d="M6 19h4V5H6v14zm8-14v14h4V5h-4z" />
              </svg>
            ) : (
              <svg className="h-6 w-6 fill-current ml-0.5" viewBox="0 0 24 24">
                <path d="M8 5v14l11-7z" />
              </svg>
            )}
          </button>
        </div>

        {/* Custom Mobile Player Controls Bar */}
        <div
          className={`absolute bottom-0 left-0 right-0 z-20 bg-gradient-to-t from-black/90 via-black/45 to-transparent px-3 pb-2 pt-5 flex items-center gap-2.5 transition-all duration-300 ${
            showControls ? "opacity-100 translate-y-0" : "opacity-0 translate-y-2 pointer-events-none"
          }`}
        >
          {/* Play/Pause Button */}
          <button
            onClick={(e) => {
              e.stopPropagation();
              handlePlayPause();
              resetHidingTimer();
            }}
            className="text-white active:text-sky-400 p-1 transition-colors"
            type="button"
          >
            {isPlaying ? (
              <svg className="h-[18px] w-[18px] fill-current" viewBox="0 0 24 24">
                <path d="M6 19h4V5H6v14zm8-14v14h4V5h-4z" />
              </svg>
            ) : (
              <svg className="h-[18px] w-[18px] fill-current" viewBox="0 0 24 24">
                <path d="M8 5v14l11-7z" />
              </svg>
            )}
          </button>

          {/* Volume controls */}
          <div className="flex items-center gap-1">
            <button
              onClick={(e) => {
                e.stopPropagation();
                if (!isVolumeOpen) {
                  setIsVolumeOpen(true);
                } else {
                  handleToggleMute();
                }
                resetHidingTimer();
              }}
              className="text-white active:text-sky-400 p-1 transition-colors"
              type="button"
            >
              {isMuted || volume === 0 ? (
                <svg className="h-[18px] w-[18px] fill-none stroke-current stroke-2.5" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" d="M17.25 9.75L19.5 12m0 0l2.25 2.25M19.5 12l2.25-2.25M19.5 12l-2.25 2.25m-10.5-6L4.5 9H1.5v6h3l4.5 3.75V5.25z" />
                </svg>
              ) : (
                <svg className="h-[18px] w-[18px] fill-none stroke-current stroke-2.5" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" d="M19.114 5.636a9 9 0 010 12.728M16.463 8.288a5.25 5.25 0 010 7.424M6.75 8.25l4.72-4.72a.75.75 0 011.28.53v15.88a.75.75 0 01-1.28.53l-4.72-4.72H4.51c-.88 0-1.704-.507-1.938-1.354A9.01 9.01 0 012.25 12c0-.83.112-1.633.322-2.396C2.806 8.756 3.63 8.25 4.51 8.25H6.75z" />
                </svg>
              )}
            </button>
            <div className={`overflow-hidden transition-all duration-200 ease-out flex items-center ${isVolumeOpen ? "w-12 opacity-100 mr-1" : "w-0 opacity-0"}`}>
              <input
                type="range"
                min={0}
                max={100}
                value={isMuted ? 0 : volume}
                onChange={(e) => {
                  handleVolumeChange(Number(e.target.value));
                  resetHidingTimer();
                }}
                className="w-12 h-1 bg-white/30 rounded-lg appearance-none cursor-pointer accent-sky-500 focus:outline-none"
                style={{
                  background: `linear-gradient(to right, #0ea5e9 0%, #0ea5e9 ${isMuted ? 0 : volume}%, rgba(255, 255, 255, 0.3) ${isMuted ? 0 : volume}%, rgba(255, 255, 255, 0.3) 100%)`
                }}
              />
            </div>
          </div>

          {/* Time text (Current) */}
          <span className="text-[10px] font-semibold text-white/90 font-mono select-none">
            {formatTimestamp(currentTimeSec)}
          </span>

          {/* Slider progress bar */}
          <div className="flex-1 flex items-center min-w-0">
            <input
              type="range"
              min={0}
              max={durationSec || 100}
              value={currentTimeSec}
              onChange={(e) => handleSeek(Number(e.target.value))}
              className="w-full h-1.5 bg-white/30 rounded-lg appearance-none cursor-pointer accent-sky-500 focus:outline-none"
              style={{
                background: `linear-gradient(to right, #0ea5e9 0%, #0ea5e9 ${(currentTimeSec / (durationSec || 1)) * 100}%, rgba(255, 255, 255, 0.3) ${(currentTimeSec / (durationSec || 1)) * 100}%, rgba(255, 255, 255, 0.3) 100%)`
              }}
            />
          </div>

          {/* Time text (Total) */}
          <span className="text-[10px] font-semibold text-white/90 font-mono select-none">
            {formatTimestamp(durationSec)}
          </span>

          {/* Speed Selector */}
          <div className="relative">
            <button
              onClick={(e) => {
                e.stopPropagation();
                setIsSpeedMenuOpen((prev) => !prev);
                resetHidingTimer();
              }}
              className="text-white active:text-sky-400 text-[10px] font-bold px-1.5 py-0.5 rounded bg-white/10 hover:bg-white/20 transition-all select-none"
              type="button"
            >
              {playbackRate}x
            </button>
            {isSpeedMenuOpen && (
              <div
                className="absolute bottom-8 right-0 z-30 bg-zinc-950/95 backdrop-blur-md border border-zinc-800 rounded-lg p-1 shadow-xl flex flex-col gap-1 min-w-[65px]"
                onClick={(e) => e.stopPropagation()}
              >
                {([0.75, 0.85, 1.0, 1.25, 1.5] as const).map((speed) => (
                  <button
                    key={speed}
                    onClick={() => {
                      handleSpeedChange(speed);
                      setIsSpeedMenuOpen(false);
                      resetHidingTimer();
                    }}
                    className={`px-2 py-1 text-[10px] font-semibold rounded-md text-center transition-all ${
                      playbackRate === speed
                        ? "bg-sky-500 text-white"
                        : "text-zinc-300 hover:text-white hover:bg-white/10"
                    }`}
                    type="button"
                  >
                    {speed}x
                  </button>
                ))}
              </div>
            )}
          </div>

          {/* Fullscreen Toggle */}
          <button
            onClick={toggleFullscreen}
            className="text-white active:text-sky-400 p-1 transition-colors"
            type="button"
            title={isFullscreen ? "退出全屏" : "全屏播放"}
          >
            {isFullscreen ? (
              <svg className="h-[18px] w-[18px]" fill="none" stroke="currentColor" strokeWidth="2.5" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" d="M9 9L4.5 4.5M9 9H4.5M9 9V4.5M15 9l4.5-4.5M15 9h4.5M15 9V4.5M9 15l-4.5 4.5M9 15H4.5M9 15v4.5M15 15l4.5 4.5M15 15h4.5M15 15v-4.5" />
              </svg>
            ) : (
              <svg className="h-[18px] w-[18px]" fill="none" stroke="currentColor" strokeWidth="2.5" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" d="M3.75 3.75v4.5m0-4.5h4.5m-4.5 0L9 9M3.75 20.25v-4.5m0 4.5h-4.5m4.5 0L15 9M20.25 20.25v-4.5m0 4.5h-4.5m4.5 0L15 15" />
              </svg>
            )}
          </button>
        </div>
      </div>

      {/* Sticky Tab Switcher right under the player */}
      <div className="sticky top-[56.25vw] z-40 flex h-11 border-b border-zinc-200 dark:border-zinc-800 bg-white/95 dark:bg-zinc-950/95 backdrop-blur-sm shrink-0">
        {(["subtitle", "transcript", "related"] as const).map((tab) => (
          <button
            key={tab}
            onClick={() => setMobileTab(tab)}
            className={`flex-1 flex items-center justify-center text-xs font-semibold h-11 border-b-2 transition-all cursor-pointer ${
              mobileTab === tab
                ? "border-brand-500 text-brand-600 dark:text-brand-400"
                : "border-transparent text-zinc-500 dark:text-zinc-400"
            }`}
          >
            {tab === "subtitle" && "字幕"}
            {tab === "transcript" && "转写"}
            {tab === "related" && "推荐"}
          </button>
        ))}
      </div>

      {/* Tab Switcher Contents */}
      <div className="flex-1 w-full px-4 pt-4 pb-[calc(env(safe-area-inset-bottom)+24px)] overflow-y-auto">
        <div className="mb-4">
          <BackLink href="/" label="视频" useHistoryBack />
          {/* Compact Video Title & Channel info */}
          <div className="mt-2.5">
            <h1 className="text-base font-semibold leading-normal text-gray-900 dark:text-zinc-100">
              {videoInfo.title}
            </h1>
            <p className="text-xs text-zinc-400 dark:text-zinc-500 mt-1">
              {videoInfo.channelTitle}
            </p>
          </div>
        </div>

        {mobileTab === "subtitle" && (
          <SubtitlePanel
            key={`subtitle-mobile-${videoId}-${refreshKey}`}
            currentTimeSec={currentTimeSec}
            onLookup={handleLookup}
            onCloseLookup={handleCloseLookup}
            playbackRate={playbackRate}
            onSpeedChange={handleSpeedChange}
            videoId={videoId}
            isMobile={true}
            onRefresh={() => setRefreshKey((prev) => prev + 1)}
            videoTitle={videoInfo.title}
            onCueChange={(spanish, chinese, cue) => {
              setCurrentSpanish(spanish);
              setCurrentChinese(chinese);
              setActiveCue(cue);
            }}
          />
        )}

        {mobileTab === "transcript" && (
          <div className="h-[calc(100vh-56.25vw-44px-env(safe-area-inset-bottom)-48px)] border border-zinc-200 dark:border-zinc-800 rounded-xl overflow-hidden bg-surface">
            <TranscriptPanel
              key={`transcript-mobile-${videoId}-${refreshKey}`}
              currentTimeSec={currentTimeSec}
              onLookup={handleLookup}
              onCloseLookup={handleCloseLookup}
              onSeek={handleSeek}
              videoId={videoId}
              videoTitle={videoInfo.title}
            />
          </div>
        )}

        {mobileTab === "related" && (
          <div className="grid grid-cols-1 gap-3.5 pb-4">
            {relatedVideos.map((video) => (
              <div
                key={video.id}
                className="flex gap-3.5 p-3 rounded-xl border border-zinc-100 dark:border-zinc-800/40 bg-zinc-50/30 dark:bg-zinc-900/10 hover:border-brand-200/50 transition-colors"
              >
                <img
                  alt={video.title}
                  src={video.thumbnail}
                  className="w-28 h-16 object-cover rounded-lg shrink-0"
                />
                <div className="flex-1 min-w-0 flex flex-col justify-between py-0.5">
                  <a
                    href={`/watch?v=${video.id}`}
                    className="text-xs font-semibold leading-relaxed line-clamp-2 text-zinc-800 dark:text-zinc-200"
                  >
                    {video.title}
                  </a>
                  <p className="text-[10px] text-zinc-400 dark:text-zinc-500 mt-1">{video.channelTitle}</p>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
