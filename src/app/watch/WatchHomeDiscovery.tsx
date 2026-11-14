// Timestamp: 2026-11-15 02:45
"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import { Shuffle, Sparkles, Clock } from "lucide-react";
import type { CuratedChannel } from "@/lib/channels";
import { formatVideoDurationBadge, type YouTubeVideoPayload } from "@/lib/youtube-shared";
import { VideoCard } from "@/app/components/web/VideoCard";

export type ChannelSectionData = {
  channel: CuratedChannel;
  videos: YouTubeVideoPayload[];
};

type WatchHomeDiscoveryProps = {
  sections: ChannelSectionData[];
};

const TOPIC_CHIPS = [
  { label: "慢速故事", query: "spanish comprehensible input beginner" },
  { label: "日常对话", query: "spanish daily conversation" },
  { label: "西语美食", query: "comida española vlog" },
  { label: "旅行西语", query: "viajar por españa vlog" },
];

function getChannelFreshnessLabel(videos: YouTubeVideoPayload[]) {
  const latest = videos
    .map((v) => Date.parse(v.publishedAt))
    .filter((t) => Number.isFinite(t))
    .sort((a, b) => b - a)[0];

  if (!latest) return null;
  const ageDays = (Date.now() - latest) / (1000 * 60 * 60 * 24);
  if (ageDays <= 45) return { text: "近期更新", fresh: true };
  if (ageDays >= 180) return { text: "经典合集", fresh: false };
  return { text: "精选片库", fresh: false };
}

export function WatchHomeDiscovery({ sections }: WatchHomeDiscoveryProps) {
  const [selectedLevel, setSelectedLevel] = useState<string>("全部");
  const [shuffleSeed, setShuffleSeed] = useState<number>(0);

  const allVideos = useMemo(
    () => sections.flatMap((section) => section.videos),
    [sections]
  );

  const featuredVideo = useMemo(() => {
    if (allVideos.length === 0) return null;
    const index = shuffleSeed % allVideos.length;
    return allVideos[index];
  }, [allVideos, shuffleSeed]);

  const levels = useMemo(
    () => ["全部", ...sections.map((s) => s.channel.level)],
    [sections]
  );

  const visibleSections = useMemo(() => {
    const filtered =
      selectedLevel === "全部"
        ? sections
        : sections.filter((s) => s.channel.level === selectedLevel);

    if (shuffleSeed === 0) return filtered;

    return filtered.map((section) => {
      if (section.videos.length <= 1) return section;
      const offset = shuffleSeed % section.videos.length;
      const rotated = [
        ...section.videos.slice(offset),
        ...section.videos.slice(0, offset),
      ];
      return { ...section, videos: rotated };
    });
  }, [sections, selectedLevel, shuffleSeed]);

  return (
    <div className="space-y-8">
      {/* 发现条：随机推荐一集 + 难度筛选 + 话题直达 */}
      <div className="flex flex-col gap-4 rounded-surface border border-zinc-200/70 bg-white p-5 shadow-card dark:border-zinc-800/70 dark:bg-zinc-900 lg:flex-row lg:items-center lg:justify-between">
        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-2 text-xs font-semibold text-brand-600 dark:text-brand-400">
            <Sparkles className="h-3.5 w-3.5" aria-hidden />
            <span>不知道看什么？随机挑一集</span>
          </div>
          {featuredVideo ? (
            <div className="mt-2 flex flex-wrap items-center gap-3">
              <Link
                href={`/watch?v=${featuredVideo.id}`}
                className="line-clamp-1 font-display text-base font-bold text-zinc-900 transition hover:text-brand-600 dark:text-zinc-100 dark:hover:text-brand-400"
              >
                {featuredVideo.title}
              </Link>
              <span className="rounded-full bg-zinc-100 px-2.5 py-0.5 text-[11px] font-medium text-zinc-600 dark:bg-zinc-800 dark:text-zinc-300">
                {featuredVideo.channelTitle} · {formatVideoDurationBadge(featuredVideo.duration)}
              </span>
            </div>
          ) : (
            <p className="mt-1.5 text-sm text-zinc-500 dark:text-zinc-400">
              粘贴任意 YouTube 链接，或按下方话题搜索你想看的西语内容。
            </p>
          )}
        </div>

        <div className="flex shrink-0 flex-wrap items-center gap-2">
          {featuredVideo ? (
            <>
              <button
                type="button"
                onClick={() => setShuffleSeed((s) => s + 1)}
                className="inline-flex items-center gap-1.5 rounded-full border border-zinc-200 bg-white px-3.5 py-2 text-xs font-semibold text-zinc-700 transition hover:bg-zinc-50 dark:border-zinc-700 dark:bg-zinc-800 dark:text-zinc-200 dark:hover:bg-zinc-700"
              >
                <Shuffle className="h-3.5 w-3.5" aria-hidden />
                <span>换一批排列</span>
              </button>
              <Link
                href={`/watch?v=${featuredVideo.id}`}
                className="inline-flex items-center rounded-full bg-brand-500 px-4 py-2 text-xs font-semibold text-white transition hover:bg-brand-600"
              >
                立即观看 →
              </Link>
            </>
          ) : null}
        </div>
      </div>

      {/* 难度筛选 + 话题探索 */}
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex flex-wrap items-center gap-2">
          {levels.map((level) => (
            <button
              key={level}
              type="button"
              onClick={() => setSelectedLevel(level)}
              className={`rounded-full px-3.5 py-1.5 text-xs font-semibold transition ${
                selectedLevel === level
                  ? "bg-brand-500 text-white shadow-sm"
                  : "border border-zinc-200 bg-white text-zinc-600 hover:bg-zinc-50 dark:border-zinc-800 dark:bg-zinc-900 dark:text-zinc-300"
              }`}
            >
              {level}
            </button>
          ))}
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <span className="text-xs text-zinc-400 dark:text-zinc-500">探索话题：</span>
          {TOPIC_CHIPS.map((topic) => (
            <Link
              key={topic.label}
              href={`/search?q=${encodeURIComponent(topic.query)}`}
              className="rounded-full border border-zinc-200/80 bg-zinc-50 px-3 py-1 text-xs font-medium text-zinc-600 transition hover:border-brand-300 hover:text-brand-700 dark:border-zinc-800 dark:bg-zinc-900 dark:text-zinc-300 dark:hover:text-brand-400"
            >
              {topic.label}
            </Link>
          ))}
        </div>
      </div>

      {/* 频道列表 */}
      <div id="video-sections">
        {visibleSections.map(({ channel, videos }) => {
          const freshness = getChannelFreshnessLabel(videos);
          return (
            <section
              className="mb-12 border-t border-zinc-100 pt-8 first:border-t-0 first:pt-0 dark:border-zinc-800"
              key={channel.id}
            >
              <div className="mb-4 flex items-end justify-between gap-4">
                <div>
                  <div className="flex flex-wrap items-center gap-2">
                    <h2 className="text-lg font-semibold text-zinc-800 dark:text-zinc-200">
                      {channel.title}
                    </h2>
                    <span className="rounded-full bg-brand-50 px-2.5 py-0.5 text-[11px] font-semibold text-brand-700 dark:bg-brand-950/50 dark:text-brand-400">
                      {channel.level}
                    </span>
                    <span className="rounded-full bg-zinc-100 px-2.5 py-0.5 text-[11px] font-medium text-zinc-600 dark:bg-zinc-800 dark:text-zinc-300">
                      {channel.tag}
                    </span>
                    {freshness ? (
                      <span
                        className={`inline-flex items-center gap-1 rounded-full px-2.5 py-0.5 text-[11px] font-medium ${
                          freshness.fresh
                            ? "bg-brand-50 text-brand-700 dark:bg-brand-950/50 dark:text-brand-400"
                            : "bg-zinc-100 text-zinc-500 dark:bg-zinc-800 dark:text-zinc-400"
                        }`}
                      >
                        <Clock className="h-3 w-3" aria-hidden />
                        {freshness.text}
                      </span>
                    ) : null}
                  </div>
                  <p className="mt-1 text-sm text-zinc-400 dark:text-zinc-500">
                    {channel.description}
                  </p>
                </div>
                <Link
                  className="shrink-0 text-sm font-medium text-brand-600 hover:underline dark:text-brand-400"
                  href={`/search?q=${encodeURIComponent(channel.title)}`}
                >
                  查看全部 →
                </Link>
              </div>

              <div className="flex gap-4 overflow-x-auto pb-4 [-ms-overflow-style:none] [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
                {videos.map((video) => (
                  <VideoCard key={video.id} video={video} />
                ))}
                {videos.length === 0 ? (
                  <div className="flex h-40 w-full items-center justify-center rounded-surface border border-dashed border-zinc-200 bg-surface text-sm text-zinc-400 dark:border-zinc-800 dark:text-zinc-500">
                    暂时还没有拉到视频数据
                  </div>
                ) : null}
              </div>
            </section>
          );
        })}
      </div>
    </div>
  );
}
