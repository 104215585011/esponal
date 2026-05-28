// Timestamp: 2026-05-28 17:25
"use client";

import { RelatedPanel } from "./RelatedPanel";
import type { YouTubeVideoPayload } from "@/lib/youtube-shared";

type WatchSidebarProps = {
  relatedVideos: YouTubeVideoPayload[];
};

export function WatchSidebar({ relatedVideos }: WatchSidebarProps) {
  return (
    <div className="flex h-full w-full flex-col border-l border-zinc-200/80 dark:border-zinc-800/80 bg-zinc-50/50 dark:bg-zinc-950/20 backdrop-blur-md p-4 overflow-y-auto">
      <div className="mb-4 shrink-0 px-1">
        <h3 className="text-xs font-semibold uppercase tracking-wider text-zinc-400 dark:text-zinc-500">
          推荐视频
        </h3>
      </div>
      <RelatedPanel relatedVideos={relatedVideos} />
    </div>
  );
}
