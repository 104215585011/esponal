"use client";

import { useMemo, useState } from "react";
import { VideoCard } from "@/app/components/web/VideoCard";
import type { YouTubeVideoPayload } from "@/lib/youtube-shared";

type EncounterWord = {
  lemma: string;
  translation: string;
  timestampSec: number;
};

type WatchSidebarProps = {
  relatedVideos: YouTubeVideoPayload[];
  savedWords: EncounterWord[];
  isLoggedIn: boolean;
};

function formatTimestamp(timestampSec: number) {
  const minutes = Math.floor(timestampSec / 60);
  const seconds = timestampSec % 60;

  return `${String(minutes).padStart(2, "0")}:${String(seconds).padStart(2, "0")}`;
}

export function WatchSidebar({
  relatedVideos,
  savedWords,
  isLoggedIn
}: WatchSidebarProps) {
  const [activeTab, setActiveTab] = useState<"related" | "vocab">("related");
  const emptyMessage = useMemo(() => {
    if (!isLoggedIn) {
      return "登录后查看本视频的词库积累";
    }

    return "还没有保存过这个视频的词";
  }, [isLoggedIn]);

  return (
    <aside className="w-full shrink-0 md:w-80">
      <div className="border-b border-gray-100">
        <div className="flex h-11 gap-6">
          <button
            className={`border-b-2 text-sm transition ${
              activeTab === "related"
                ? "border-emerald-500 text-gray-900"
                : "border-transparent text-gray-400"
            }`}
            onClick={() => setActiveTab("related")}
            type="button"
          >
            相关视频
          </button>
          <button
            className={`border-b-2 text-sm transition ${
              activeTab === "vocab"
                ? "border-emerald-500 text-gray-900"
                : "border-transparent text-gray-400"
            }`}
            onClick={() => setActiveTab("vocab")}
            type="button"
          >
            本视频词汇
          </button>
        </div>
      </div>

      {activeTab === "related" ? (
        <div className="mt-4 flex max-h-[60vh] flex-col gap-2 overflow-y-auto">
          {relatedVideos.map((video) => (
            <VideoCard compact key={video.id} video={video} />
          ))}
        </div>
      ) : (
        <div className="mt-8 rounded-xl border border-gray-100 bg-gray-50 px-4 py-8 text-center">
          {savedWords.length === 0 ? (
            <p className="text-sm text-gray-400">{emptyMessage}</p>
          ) : (
            <ul className="space-y-3 text-left">
              {savedWords.map((word) => (
                <li className="rounded-lg bg-white px-3 py-2" key={`${word.lemma}-${word.timestampSec}`}>
                  <div className="flex items-center justify-between gap-3">
                    <span className="text-sm font-medium text-gray-800">{word.lemma}</span>
                    <span className="text-xs text-gray-300">
                      {formatTimestamp(word.timestampSec)}
                    </span>
                  </div>
                  <p className="mt-1 text-sm text-gray-500">{word.translation}</p>
                </li>
              ))}
            </ul>
          )}
        </div>
      )}
    </aside>
  );
}
