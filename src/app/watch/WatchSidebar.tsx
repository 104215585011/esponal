// Timestamp: 2026-05-28 09:10
"use client";

import { useEffect, useState } from "react";
import { LookupCard, type LookupSource } from "./LookupCard";
import { RelatedPanel } from "./RelatedPanel";
import type { YouTubeVideoPayload } from "@/lib/youtube-shared";

type ActiveLookup = {
  form: string;
  originalSentence: string;
  translatedSentence?: string;
  source?: LookupSource;
};

type WatchSidebarProps = {
  activeLookup: ActiveLookup | null;
  onCloseLookup: () => void;
  relatedVideos: YouTubeVideoPayload[];
  currentTimeSec?: number;
};

export function WatchSidebar({
  activeLookup,
  onCloseLookup,
  relatedVideos,
  currentTimeSec
}: WatchSidebarProps) {
  const [activeTab, setActiveTab] = useState<"lookup" | "related">("related");

  // Auto-switch to lookup tab when a new word is clicked
  useEffect(() => {
    if (activeLookup) {
      setActiveTab("lookup");
    }
  }, [activeLookup]);

  return (
    <div className="flex h-full w-full flex-col border-l border-zinc-200/80 dark:border-zinc-800/80 bg-zinc-50/50 dark:bg-zinc-950/20 backdrop-blur-md">
      {/* Sidebar Tabs */}
      <div className="flex border-b border-zinc-200/80 dark:border-zinc-800/80 bg-white/40 dark:bg-zinc-900/40 p-1.5 gap-1 shrink-0">
        <button
          className={`flex-1 rounded-lg py-2 text-xs font-semibold tracking-wide transition-all ${
            activeTab === "lookup"
              ? "bg-white dark:bg-zinc-800 text-zinc-950 dark:text-white shadow-sm"
              : "text-zinc-500 dark:text-zinc-400 hover:text-zinc-900 dark:hover:text-zinc-100"
          }`}
          onClick={() => setActiveTab("lookup")}
          type="button"
        >
          查词
        </button>
        <button
          className={`flex-1 rounded-lg py-2 text-xs font-semibold tracking-wide transition-all ${
            activeTab === "related"
              ? "bg-white dark:bg-zinc-800 text-zinc-950 dark:text-white shadow-sm"
              : "text-zinc-500 dark:text-zinc-400 hover:text-zinc-900 dark:hover:text-zinc-100"
          }`}
          onClick={() => setActiveTab("related")}
          type="button"
        >
          推荐视频
        </button>
      </div>

      {/* Tab Content Panel */}
      <div className="flex-1 min-h-0 overflow-y-auto p-4">
        {activeTab === "lookup" ? (
          <div className="h-full w-full">
            {activeLookup ? (
              <div className="relative rounded-2xl border border-zinc-200/60 dark:border-zinc-800/60 bg-white/80 dark:bg-zinc-900/80 p-4 shadow-sm" data-testid="watch-dock-card">
                <LookupCard
                  currentTimeSec={currentTimeSec}
                  form={activeLookup.form}
                  onClose={onCloseLookup}
                  originalSentence={activeLookup.originalSentence}
                  source={activeLookup.source}
                  translatedSentence={activeLookup.translatedSentence ?? ""}
                  useStaticLayout={true}
                />
              </div>
            ) : (
              <div className="flex h-full min-h-[300px] flex-col items-center justify-center text-center p-6 select-none">
                <div className="flex h-12 w-12 items-center justify-center rounded-full bg-zinc-50 dark:bg-zinc-800/50 text-zinc-400 dark:text-zinc-500 mb-4">
                  <svg className="h-6 w-6 fill-none stroke-current stroke-2" viewBox="0 0 24 24">
                    <path d="M12 6.253v13m0-13C10.832 5.477 9.246 5 7.5 5S4.168 5.477 3 6.253v13C4.168 18.477 5.754 18 7.5 18s3.332.477 4.5 1.253m0-13C13.168 5.477 14.754 5 16.5 5c1.747 0 3.332.477 4.5 1.253v13C19.832 18.477 18.247 18 16.5 18c-1.746 0-3.332.477-4.5 1.253" />
                  </svg>
                </div>
                <h3 className="text-sm font-semibold text-zinc-700 dark:text-zinc-300">
                  查词固定面板
                </h3>
                <p className="mt-1.5 text-xs leading-relaxed text-zinc-400 dark:text-zinc-500 max-w-[200px]">
                  点击字幕或右侧转写中的西班牙语单词，释义将固定展示在此处。
                </p>
              </div>
            )}
          </div>
        ) : (
          <RelatedPanel relatedVideos={relatedVideos} />
        )}
      </div>
    </div>
  );
}
