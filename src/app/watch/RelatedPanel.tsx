"use client";

import Link from "next/link";
import type { YouTubeVideoPayload } from "@/lib/youtube-shared";
import { formatVideoDurationBadge } from "@/lib/youtube-shared";

type RelatedPanelProps = {
  relatedVideos: YouTubeVideoPayload[];
};

export function RelatedPanel({ relatedVideos }: RelatedPanelProps) {
  return (
    <div className="flex h-full w-full flex-col">
      <div className="flex items-center border-b border-gray-100 px-3 py-3">
        <span className="text-[13px] font-semibold text-gray-700">相关视频</span>
      </div>

      <div className="flex-1 overflow-y-auto px-2 py-2">
        {relatedVideos.length === 0 ? (
          <div className="px-3 py-6 text-sm text-gray-400">暂时还没有拉到相关视频</div>
        ) : (
          relatedVideos.map((video) => (
            <Link
              className="flex gap-2 rounded-card px-2 py-1.5 transition hover:bg-gray-50"
              href={`/watch?v=${video.id}`}
              key={video.id}
            >
              <div className="relative h-[54px] w-[96px] shrink-0 overflow-hidden rounded-md bg-gray-200">
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img
                  alt={video.title}
                  className="h-full w-full object-cover"
                  loading="lazy"
                  src={video.thumbnail || "https://placehold.co/320x180?text=Esponal"}
                />
                {video.duration ? (
                  <span className="absolute bottom-1 right-1 rounded bg-black/80 px-1.5 py-0.5 text-[10px] font-semibold text-white">
                    {formatVideoDurationBadge(video.duration)}
                  </span>
                ) : null}
              </div>
              <div className="min-w-0 pt-0.5">
                <p className="line-clamp-2 text-[12.5px] font-medium leading-5 text-gray-900">
                  {video.title}
                </p>
                <p className="mt-1 text-[11px] text-gray-400">{video.channelTitle}</p>
              </div>
            </Link>
          ))
        )}
      </div>
    </div>
  );
}
