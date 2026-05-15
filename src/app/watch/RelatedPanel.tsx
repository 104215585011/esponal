"use client";

import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import type { YouTubeVideoPayload } from "@/lib/youtube-shared";
import { formatVideoDurationBadge } from "@/lib/youtube-shared";

type RelatedPanelProps = {
  relatedVideos: YouTubeVideoPayload[];
};

export function RelatedPanel({ relatedVideos }: RelatedPanelProps) {
  const [visible, setVisible] = useState(false);
  const [pinned, setPinned] = useState(false);
  const showTimerRef = useRef<number | null>(null);
  const hideTimerRef = useRef<number | null>(null);

  const clearTimers = () => {
    if (showTimerRef.current !== null) {
      window.clearTimeout(showTimerRef.current);
      showTimerRef.current = null;
    }

    if (hideTimerRef.current !== null) {
      window.clearTimeout(hideTimerRef.current);
      hideTimerRef.current = null;
    }
  };

  const scheduleOpen = () => {
    if (pinned) {
      setVisible(true);
      return;
    }

    if (hideTimerRef.current !== null) {
      window.clearTimeout(hideTimerRef.current);
      hideTimerRef.current = null;
    }

    if (showTimerRef.current !== null) {
      window.clearTimeout(showTimerRef.current);
    }

    showTimerRef.current = window.setTimeout(() => {
      setVisible(true);
      showTimerRef.current = null;
    }, 120);
  };

  const scheduleClose = () => {
    if (pinned) {
      return;
    }

    if (showTimerRef.current !== null) {
      window.clearTimeout(showTimerRef.current);
      showTimerRef.current = null;
    }

    if (hideTimerRef.current !== null) {
      window.clearTimeout(hideTimerRef.current);
    }

    hideTimerRef.current = window.setTimeout(() => {
      setVisible(false);
      hideTimerRef.current = null;
    }, 300);
  };

  useEffect(() => () => clearTimers(), []);

  return (
    <>
      <div
        className="absolute bottom-0 right-0 top-0 z-20 w-2.5 cursor-e-resize"
        onMouseEnter={scheduleOpen}
        onMouseLeave={scheduleClose}
      />
      <aside
        className={`absolute bottom-0 right-0 top-0 z-30 flex w-[290px] flex-col border-l border-gray-200 bg-white shadow-[-6px_0_24px_rgba(0,0,0,0.09)] transition-transform duration-200 ${
          visible || pinned ? "translate-x-0" : "translate-x-full"
        }`}
        onMouseEnter={scheduleOpen}
        onMouseLeave={scheduleClose}
      >
        <button
          className="absolute left-[-24px] top-[40%] flex h-12 w-6 -translate-y-1/2 items-center justify-center rounded-l-lg border border-r-0 border-gray-200 bg-white/80 text-[11px] text-gray-500 backdrop-blur-sm transition hover:bg-white/95"
          onClick={() => {
            clearTimers();
            setPinned((value) => {
              const next = !value;
              setVisible(next);
              return next;
            });
          }}
          title="相关视频"
          type="button"
        >
          <span className={`transition-transform ${pinned ? "rotate-180" : ""}`}>◀</span>
        </button>

        <div className="flex items-center border-b border-gray-100 px-4 py-4">
          <span className="text-[13px] font-semibold text-gray-700">相关视频</span>
          <button
            className={`ml-auto flex items-center gap-1 rounded-full border px-3 py-1 text-[11px] font-medium transition ${
              pinned
                ? "border-green-200 bg-green-50 text-green-700"
                : "border-gray-200 text-gray-400 hover:border-green-500 hover:bg-green-50 hover:text-green-600"
            }`}
            onClick={() => {
              clearTimers();
              setPinned((value) => {
                const next = !value;
                setVisible(next);
                return next;
              });
            }}
            type="button"
          >
            {pinned ? "已固定" : "固定"}
          </button>
        </div>

        <div className="flex-1 overflow-y-auto px-2 py-3">
          {relatedVideos.length === 0 ? (
            <div className="px-4 py-8 text-sm text-gray-400">暂时还没有拉到相关视频</div>
          ) : (
            relatedVideos.map((video) => (
              <Link
                className="flex gap-3 rounded-[10px] px-2 py-2 transition hover:bg-gray-50"
                href={`/watch?v=${video.id}`}
                key={video.id}
              >
                <div className="relative h-[60px] w-[108px] shrink-0 overflow-hidden rounded-md bg-gray-200">
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img
                    alt={video.title}
                    className="h-full w-full object-cover"
                    loading="lazy"
                    src={video.thumbnail || "https://placehold.co/320x180?text=Esponal"}
                  />
                  <span className="absolute bottom-1 right-1 rounded bg-black/80 px-1.5 py-0.5 text-[10px] font-semibold text-white">
                    {formatVideoDurationBadge(video.duration)}
                  </span>
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
      </aside>
    </>
  );
}
