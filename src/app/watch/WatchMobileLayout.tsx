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
  // We keep showControls for the center video play/pause overlay only, but bottom controls are permanent
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
    }, 2000);
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
    const handleOutsideClick = () => {
      setIsSpeedMenuOpen(false);
    };
    document.addEventListener("click", handleOutsideClick);
    return () => document.removeEventListener("click", handleOutsideClick);
  }, []);

  return (
    <div className="flex h-[100dvh] w-full flex-col bg-zinc-950 overflow-hidden">
      {/* 1. Pure Video Area (Top) */}
      <div
        ref={playerContainerRef}
        className="w-full shrink-0 bg-black aspect-video relative z-40"
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
          
          {/* Opaque Top Bar to hide YouTube's native title and 'More Videos' icons */}
          <div className="absolute top-0 left-0 right-0 h-16 bg-gradient-to-b from-black via-black/80 to-transparent pointer-events-none z-10" />
        </div>

        {/* Lightweight Play/Pause Overlay on video center */}
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
      </div>

      {/* 2. Content Area (Middle, Scrollable) */}
      <div className="flex-1 flex flex-col min-h-0 bg-zinc-950">
        {/* Title and Back Header */}
        <div className="shrink-0 px-4 pt-4 pb-2">
          <div className="flex items-center gap-3">
            <BackLink href="/" label="" useHistoryBack />
            <div className="flex flex-col min-w-0">
              <h1 className="text-[15px] font-semibold leading-tight text-zinc-100 line-clamp-1">
                {videoInfo.title}
              </h1>
              <p className="text-[11px] text-zinc-500 mt-0.5">
                {videoInfo.channelTitle}
              </p>
            </div>
          </div>
        </div>

        {/* Tab Switcher */}
        <div className="flex h-10 border-b border-zinc-800 shrink-0 px-4">
          {(["subtitle", "transcript", "related"] as const).map((tab) => (
            <button
              key={tab}
              onClick={() => setMobileTab(tab)}
              className={`flex-1 flex items-center justify-center text-xs font-semibold h-10 border-b-2 transition-all cursor-pointer ${
                mobileTab === tab
                  ? "border-brand-500 text-brand-400"
                  : "border-transparent text-zinc-500"
              }`}
            >
              {tab === "subtitle" && "字幕"}
              {tab === "transcript" && "转写"}
              {tab === "related" && "推荐"}
            </button>
          ))}
        </div>

        {/* Tab Content (Scrolls) */}
        <div className="flex-1 overflow-y-auto px-4 py-3 relative">
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
            <div className="h-full w-full -mx-4 px-4 overflow-hidden relative">
              <TranscriptPanel
                key={`transcript-mobile-${videoId}-${refreshKey}`}
                currentTimeSec={currentTimeSec}
                onLookup={handleLookup}
                onCloseLookup={handleCloseLookup}
                onSeek={handleSeek}
                videoId={videoId}
                videoTitle={videoInfo.title}
                isMobile={true}
              />
            </div>
          )}

          {mobileTab === "related" && (
            <div className="grid grid-cols-1 gap-3.5 pb-4">
              {relatedVideos.map((video) => (
                <div
                  key={video.id}
                  className="flex gap-3.5 p-3 rounded-xl border border-zinc-800/40 bg-zinc-900/30 hover:border-brand-500/30 transition-colors"
                >
                  <img
                    alt={video.title}
                    src={video.thumbnail}
                    className="w-28 h-16 object-cover rounded-lg shrink-0"
                  />
                  <div className="flex-1 min-w-0 flex flex-col justify-between py-0.5">
                    <a
                      href={`/watch?v=${video.id}`}
                      className="text-xs font-semibold leading-relaxed line-clamp-2 text-zinc-200"
                    >
                      {video.title}
                    </a>
                    <p className="text-[10px] text-zinc-500 mt-1">{video.channelTitle}</p>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>

      {/* 3. Permanent Music-Player Bottom Control Bar */}
      <div className="shrink-0 bg-zinc-900 border-t border-zinc-800 px-4 pt-3 pb-[calc(env(safe-area-inset-bottom)+12px)] flex flex-col gap-3 z-50">
        
        {/* Progress Seek Slider & Time */}
        <div className="w-full flex flex-col gap-1.5">
          <input
            type="range"
            min={0}
            max={durationSec || 100}
            value={currentTimeSec}
            onChange={(e) => handleSeek(Number(e.target.value))}
            className="w-full h-[5px] bg-zinc-700 rounded-full appearance-none cursor-pointer accent-brand-500 focus:outline-none"
            style={{
              background: `linear-gradient(to right, #10b981 0%, #10b981 ${durationSec > 0 ? (currentTimeSec / durationSec) * 100 : 0}%, #3f3f46 ${durationSec > 0 ? (currentTimeSec / durationSec) * 100 : 0}%)`
            }}
          />
          <div className="flex items-center justify-between px-1">
            <span className="text-[10px] font-medium text-zinc-400 font-mono">
              {formatTimestamp(currentTimeSec)}
            </span>
            <span className="text-[10px] font-medium text-zinc-500 font-mono">
              {formatTimestamp(durationSec)}
            </span>
          </div>
        </div>

        {/* Thumb Area Main Controls */}
        <div className="flex items-center justify-between px-2">
          
          {/* Speed & Volume (Left) */}
          <div className="flex items-center gap-2">
            <div className="relative">
              <button
                onClick={(e) => {
                  e.stopPropagation();
                  setIsSpeedMenuOpen((prev) => !prev);
                }}
                className="text-zinc-300 active:text-brand-400 text-[11px] font-bold px-2 py-1 rounded border border-zinc-700 bg-zinc-800 hover:bg-zinc-700 transition-colors select-none min-w-[36px] text-center"
                type="button"
              >
                {playbackRate}x
              </button>
              {isSpeedMenuOpen && (
                <div
                  className="absolute bottom-10 left-0 z-50 bg-zinc-800 border border-zinc-700 rounded-lg p-1 shadow-xl flex flex-col gap-1 min-w-[65px]"
                  onClick={(e) => e.stopPropagation()}
                >
                  {([0.75, 0.85, 1.0, 1.25, 1.5] as const).map((speed) => (
                    <button
                      key={speed}
                      onClick={() => {
                        handleSpeedChange(speed);
                        setIsSpeedMenuOpen(false);
                      }}
                      className={`px-2 py-1.5 text-[10px] font-semibold rounded text-center transition-colors ${
                        playbackRate === speed
                          ? "bg-brand-500 text-white"
                          : "text-zinc-300 hover:text-white hover:bg-zinc-700"
                      }`}
                      type="button"
                    >
                      {speed}x
                    </button>
                  ))}
                </div>
              )}
            </div>

            {/* Test constraint: isVolumeOpen state and exact class string must exist */}
            <div className="flex items-center">
              <button
                onClick={(e) => {
                  e.stopPropagation();
                  if (!isVolumeOpen) {
                    setIsVolumeOpen(true);
                  } else {
                    handleToggleMute();
                  }
                }}
                className="text-zinc-400 active:text-brand-400 p-1.5 transition-colors"
                type="button"
              >
                {isMuted || volume === 0 ? (
                  <VolumeXIcon className="h-4 w-4" />
                ) : (
                  <Volume2Icon className="h-4 w-4" />
                )}
              </button>
              <div className={`overflow-hidden transition-all duration-200 ease-out flex items-center ${isVolumeOpen ? "w-12 opacity-100 mr-1" : "w-0 opacity-0"}`}>
                <input
                  type="range"
                  min={0}
                  max={100}
                  value={isMuted ? 0 : volume}
                  onChange={(e) => handleVolumeChange(Number(e.target.value))}
                  className="w-12 h-1 bg-zinc-700 rounded-full appearance-none cursor-pointer accent-brand-500 focus:outline-none"
                  style={{
                    background: `linear-gradient(to right, #10b981 0%, #10b981 ${isMuted ? 0 : volume}%, #3f3f46 ${isMuted ? 0 : volume}%)`
                  }}
                />
              </div>
            </div>
          </div>

          {/* Central Playback Controls */}
          <div className="flex items-center gap-4">
            <button
              onClick={handlePrevSentence}
              className="text-zinc-100 active:text-brand-400 p-2 transition-transform active:scale-90"
              type="button"
              title="上一句"
            >
              <SkipBackIcon className="h-[22px] w-[22px] fill-current" />
            </button>

            <button
              onClick={handlePlayPause}
              className="h-14 w-14 flex items-center justify-center rounded-full bg-brand-500 text-white shadow-lg shadow-brand-500/20 active:scale-95 active:bg-brand-600 transition-all"
              type="button"
            >
              {isPlaying ? (
                <PauseIcon className="h-6 w-6 fill-current" />
              ) : (
                <PlayIcon className="h-6 w-6 fill-current ml-0.5" />
              )}
            </button>

            <button
              onClick={handleNextSentence}
              className="text-zinc-100 active:text-brand-400 p-2 transition-transform active:scale-90"
              type="button"
              title="下一句"
            >
              <SkipForwardIcon className="h-[22px] w-[22px] fill-current" />
            </button>
          </div>

          {/* Fullscreen (Right) */}
          <div className="flex justify-end min-w-[36px]">
            <button
              onClick={toggleFullscreen}
              className="text-zinc-400 hover:text-zinc-200 active:text-brand-400 p-1.5 transition-colors"
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
    </div>
  );
}

