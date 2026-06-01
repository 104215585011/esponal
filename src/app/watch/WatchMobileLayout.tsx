// Timestamp: 2026-06-01 22:15
"use client";

import { useState, useEffect, useRef } from "react";
import Link from "next/link";
import { BackLink } from "@/app/components/web/BackLink";
import { SubtitlePanel } from "./SubtitlePanel";
import { TranscriptPanel } from "./TranscriptPanel";
import type { YouTubeVideoPayload } from "@/lib/youtube-shared";

import { formatTimestamp } from "./pdf-helpers";

function SkipBackIcon({ className }: { className?: string }) {
  return (
    <svg
      xmlns="http://www.w3.org/2000/svg"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
      className={className}
    >
      <polygon points="19 20 9 12 19 4 19 20" />
      <line x1="5" x2="5" y1="19" y2="5" />
    </svg>
  );
}

function SkipForwardIcon({ className }: { className?: string }) {
  return (
    <svg
      xmlns="http://www.w3.org/2000/svg"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
      className={className}
    >
      <polygon points="5 4 15 12 5 20 5 4" />
      <line x1="19" x2="19" y1="5" y2="19" />
    </svg>
  );
}

function PlayIcon({ className }: { className?: string }) {
  return (
    <svg
      xmlns="http://www.w3.org/2000/svg"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
      className={className}
    >
      <polygon points="6 3 20 12 6 21 6 3" />
    </svg>
  );
}

function PauseIcon({ className }: { className?: string }) {
  return (
    <svg
      xmlns="http://www.w3.org/2000/svg"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
      className={className}
    >
      <rect x="14" y="4" width="4" height="16" rx="1" />
      <rect x="6" y="4" width="4" height="16" rx="1" />
    </svg>
  );
}

function MaximizeIcon({ className }: { className?: string }) {
  return (
    <svg
      xmlns="http://www.w3.org/2000/svg"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
      className={className}
    >
      <path d="M15 3h6v6" />
      <path d="M9 21H3v-6" />
      <path d="M21 3l-7 7" />
      <path d="M3 21l7-7" />
    </svg>
  );
}

function MinimizeIcon({ className }: { className?: string }) {
  return (
    <svg
      xmlns="http://www.w3.org/2000/svg"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
      className={className}
    >
      <path d="M4 14h6v6" />
      <path d="M20 10h-6V4" />
      <path d="M14 10l7-7" />
      <path d="M10 14l-7 7" />
    </svg>
  );
}

function Volume2Icon({ className }: { className?: string }) {
  return (
    <svg
      xmlns="http://www.w3.org/2000/svg"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
      className={className}
    >
      <polygon points="11 5 6 9 2 9 2 15 6 15 11 19 11 5" />
      <path d="M15.54 8.46a5 5 0 0 1 0 7.07" />
      <path d="M19.07 4.93a10 10 0 0 1 0 14.14" />
    </svg>
  );
}

function VolumeXIcon({ className }: { className?: string }) {
  return (
    <svg
      xmlns="http://www.w3.org/2000/svg"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
      className={className}
    >
      <polygon points="11 5 6 9 2 9 2 15 6 15 11 19 11 5" />
      <line x1="22" x2="16" y1="9" y2="15" />
      <line x1="16" x2="22" y1="9" y2="15" />
    </svg>
  );
}


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
  handlePrevSentence: () => void;
  handleNextSentence: () => void;
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
  handleToggleMute,
  handlePrevSentence,
  handleNextSentence
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

  const handlePlayerTap = (e: React.MouseEvent) => {
    e.stopPropagation();
    if (!isPlaying) {
      handlePlayPause();
    } else {
      setShowControls((prev) => {
        const next = !prev;
        if (next && isPlaying) {
          resetHidingTimer();
        }
        return next;
      });
    }
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

        {/* Custom Top Bar Overlay to cover native YouTube title & share buttons */}
        <div
          className={`absolute top-0 left-0 right-0 h-14 bg-gradient-to-b from-black/85 via-black/45 to-transparent px-4 py-3 flex items-start justify-between z-20 transition-opacity duration-300 pointer-events-none ${
            showControls || !isPlaying ? "opacity-100" : "opacity-0"
          }`}
        >
          <div className="flex flex-col min-w-0 pr-12 text-left">
            <span className="text-white text-xs font-bold font-sans line-clamp-1">
              {videoInfo.title}
            </span>
            <span className="text-zinc-300 text-[10px] font-medium mt-0.5">
              {videoInfo.channelTitle}
            </span>
          </div>
        </div>

        {/* Giant play/pause toggle in the center on mobile */}
        <div
          className={`absolute inset-0 z-20 bg-black/40 backdrop-blur-[1px] flex items-center justify-center transition-opacity duration-300 pointer-events-none ${
            showControls || !isPlaying ? "opacity-100" : "opacity-0"
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
            className="h-16 w-16 flex items-center justify-center rounded-full bg-brand-500 hover:bg-brand-600 text-white shadow-xl active:scale-95 transition-all pointer-events-auto"
            type="button"
          >
            {isPlaying ? (
              <PauseIcon className="h-7 w-7 fill-current" />
            ) : (
              <PlayIcon className="h-7 w-7 fill-current ml-1" />
            )}
          </button>
        </div>

        {/* Custom Mobile Player Controls Bar */}
        <div
          className={`absolute bottom-0 left-0 right-0 z-20 bg-gradient-to-t from-black/95 via-black/60 to-transparent px-4 pb-3 pt-6 flex flex-col gap-2.5 transition-all duration-300 ${
            showControls || !isPlaying ? "opacity-100 translate-y-0" : "opacity-0 translate-y-2 pointer-events-none"
          }`}
        >
          {/* Progress Seek Slider */}
          <div className="w-full flex items-center">
            <input
              type="range"
              min={0}
              max={durationSec || 100}
              value={currentTimeSec}
              onChange={(e) => handleSeek(Number(e.target.value))}
              className="w-full h-[5px] bg-white/20 rounded-full appearance-none cursor-pointer accent-brand-500 focus:outline-none"
              style={{
                background: `linear-gradient(to right, #10b981 0%, #10b981 ${durationSec > 0 ? (currentTimeSec / durationSec) * 100 : 0}%, rgba(255, 255, 255, 0.2) ${durationSec > 0 ? (currentTimeSec / durationSec) * 100 : 0}%)`
              }}
            />
          </div>

          {/* Time indicator row */}
          <div className="flex items-center justify-between">
            <span className="text-[10px] font-bold text-white/90 font-mono select-none">
              {formatTimestamp(currentTimeSec)}
            </span>
            <span className="text-[10px] font-bold text-white/90 font-mono select-none">
              {formatTimestamp(durationSec)}
            </span>
          </div>
          {/* Thumb Area controls */}
          <div className="flex items-center justify-between h-14">
            {/* Speed selector and Volume row */}
            <div className="flex items-center gap-1.5">
              {/* Speed selector */}
              <div className="relative">
                <button
                  onClick={(e) => {
                    e.stopPropagation();
                    setIsSpeedMenuOpen((prev) => !prev);
                    resetHidingTimer();
                  }}
                  className="text-white active:text-brand-400 text-[11px] font-bold px-2.5 py-1 rounded-full bg-white/10 hover:bg-white/20 transition-all select-none border border-white/5"
                  type="button"
                >
                  {playbackRate}x
                </button>
                {isSpeedMenuOpen && (
                  <div
                    className="absolute bottom-10 left-0 z-30 bg-zinc-950/95 backdrop-blur-md border border-zinc-800 rounded-lg p-1 shadow-xl flex flex-col gap-1 min-w-[65px]"
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
                            ? "bg-brand-500 text-white"
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
                  className="text-zinc-300 active:text-brand-400 p-1.5 transition-colors"
                  type="button"
                >
                  {isMuted || volume === 0 ? (
                    <VolumeXIcon className="h-5 w-5" />
                  ) : (
                    <Volume2Icon className="h-5 w-5" />
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
                    className="w-12 h-1 bg-white/20 rounded-full appearance-none cursor-pointer accent-brand-500 focus:outline-none"
                    style={{
                      background: `linear-gradient(to right, #10b981 0%, #10b981 ${isMuted ? 0 : volume}%, rgba(255, 255, 255, 0.2) ${isMuted ? 0 : volume}%)`
                    }}
                  />
                </div>
              </div>
            </div>

            {/* Previous Sentence */}
            <button
              onClick={(e) => {
                e.stopPropagation();
                handlePrevSentence();
                resetHidingTimer();
              }}
              className="text-zinc-300 active:text-brand-400 p-2 transition-colors active:scale-90"
              type="button"
              title="上一句"
            >
              <SkipBackIcon className="h-5 w-5" />
            </button>

            {/* Play/Pause */}
            <button
              onClick={(e) => {
                e.stopPropagation();
                handlePlayPause();
                resetHidingTimer();
              }}
              className="h-12 w-12 flex items-center justify-center rounded-full bg-brand-500 text-white shadow-lg active:scale-95 transition-all"
              type="button"
            >
              {isPlaying ? (
                <PauseIcon className="h-5 w-5 fill-current" />
              ) : (
                <PlayIcon className="h-5 w-5 fill-current ml-0.5" />
              )}
            </button>

            {/* Next Sentence */}
            <button
              onClick={(e) => {
                e.stopPropagation();
                handleNextSentence();
                resetHidingTimer();
              }}
              className="text-zinc-300 active:text-brand-400 p-2 transition-colors active:scale-90"
              type="button"
              title="下一句"
            >
              <SkipForwardIcon className="h-5 w-5" />
            </button>

            {/* Fullscreen Toggle */}
            <button
              onClick={(e) => {
                e.stopPropagation();
                toggleFullscreen();
                resetHidingTimer();
              }}
              className="text-zinc-300 active:text-brand-400 p-2 transition-colors"
              type="button"
              title={isFullscreen ? "退出全屏" : "全屏播放"}
            >
              {isFullscreen ? (
                <MinimizeIcon className="h-5 w-5" />
              ) : (
                <MaximizeIcon className="h-5 w-5" />
              )}
            </button>
          </div>
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
