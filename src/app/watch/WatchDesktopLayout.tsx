// Timestamp: 2026-06-01 22:15
"use client";

import { useState } from "react";
import Link from "next/link";
import { BackLink } from "@/app/components/web/BackLink";
import { SubtitlePanel } from "./SubtitlePanel";
import { TranscriptPanel } from "./TranscriptPanel";
import { WatchSidebar } from "./WatchSidebar";
import type { YouTubeVideoPayload } from "@/lib/youtube-shared";
import { formatTimestamp } from "./pdf-helpers";

type ActiveLookup = {
  form: string;
  originalSentence: string;
  translatedSentence?: string;
  source?: any;
};

type WatchDesktopLayoutProps = {
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
  isSidebarOpen: boolean;
  setIsSidebarOpen: (open: boolean) => void;
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

export function WatchDesktopLayout({
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
  handleToggleMute
}: WatchDesktopLayoutProps) {
  const nextVideo = relatedVideos[0] ?? null;

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
            title={isFullscreen ? "退出全屏" : "全屏"}
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
              <div className="flex h-6 w-6 items-center justify-center rounded-full bg-gradient-to-br from-brand-600 to-brand-400 text-[10px] font-bold text-white">
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
          videoTitle={videoInfo.title}
        />
      </section>

      {/* Desktop Slide-out Sidebar Trigger */}
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
        <WatchSidebar relatedVideos={relatedVideos} />
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
