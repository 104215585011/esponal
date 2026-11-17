// Timestamp: 2026-11-17 16:22
"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import Link from "next/link";
import { Tv, Shuffle, Sparkles, Compass, ArrowLeft } from "lucide-react";
import type {
  PoolLanguage,
  TaggedVideoItem,
  VideoFeedResponsePayload
} from "@/lib/video-pool-logic";
import { formatVideoDurationBadge } from "@/lib/youtube-shared";
import { VideoCard } from "@/app/components/web/VideoCard";

type WatchHomeDiscoveryProps = {
  initialFeed: VideoFeedResponsePayload;
};

type ViewMode = "feed" | "channels";

const SESSION_KEY = "esponal.web.watch.session.v1";

type SessionSnapshot = {
  language: PoolLanguage;
  seed: number;
  level: string;
  channelId: string | null;
  viewMode: ViewMode;
};

const TOPICS_BY_LANG: Record<PoolLanguage, Array<{ label: string; query: string }>> = {
  es: [
    { label: "慢速故事", query: "spanish comprehensible input beginner" },
    { label: "日常对话", query: "spanish daily conversation" },
    { label: "西语美食", query: "comida española vlog" },
    { label: "旅行西语", query: "viajar por españa vlog" }
  ],
  de: [
    { label: "DW 入门新闻", query: "DW Deutsch lernen A1 A2" },
    { label: "日常情景", query: "Learn German Original Dialog" },
    { label: "柏林街头", query: "Easy German A1 A2" },
    { label: "慢速德语", query: "Slow German Podcast" }
  ]
};

export function WatchHomeDiscovery({ initialFeed }: WatchHomeDiscoveryProps) {
  const [feed, setFeed] = useState<VideoFeedResponsePayload>(initialFeed);
  const [language, setLanguage] = useState<PoolLanguage>(initialFeed.language);
  const [seed, setSeed] = useState<number>(initialFeed.seed);
  const [selectedLevel, setSelectedLevel] = useState<string>(initialFeed.level || "all");
  const [selectedChannelId, setSelectedChannelId] = useState<string | null>(initialFeed.channelId);
  const [viewMode, setViewMode] = useState<ViewMode>(
    initialFeed.channelId ? "channels" : "feed"
  );
  const [loading, setLoading] = useState(false);

  const reqSeqRef = useRef(0);
  const restoredRef = useRef(false);

  const loadFeed = useCallback(
    async (opts: {
      nextLang: PoolLanguage;
      nextLevel: string;
      nextChannelId: string | null;
      nextSeed: number;
    }) => {
      const seq = ++reqSeqRef.current;
      setLoading(true);
      try {
        const params = new URLSearchParams({
          lang: opts.nextLang,
          seed: String(opts.nextSeed)
        });
        if (opts.nextLevel && opts.nextLevel !== "all") {
          params.set("level", opts.nextLevel);
        }
        if (opts.nextChannelId) {
          params.set("channelId", opts.nextChannelId);
        }
        const res = await fetch(`/api/videos/feed?${params.toString()}`, {
          cache: "no-store"
        });
        if (!res.ok) return;
        const data = (await res.json()) as VideoFeedResponsePayload;
        if (seq !== reqSeqRef.current) return;
        setFeed(data);
      } finally {
        if (seq === reqSeqRef.current) {
          setLoading(false);
        }
      }
    },
    []
  );

  // 同一次浏览会话里，点进视频再返回时恢复上一次列表、难度筛选与批号
  useEffect(() => {
    if (restoredRef.current) return;
    restoredRef.current = true;
    try {
      const raw = window.sessionStorage.getItem(SESSION_KEY);
      if (!raw) return;
      const saved = JSON.parse(raw) as Partial<SessionSnapshot>;
      if (
        saved.language &&
        saved.seed !== undefined &&
        (saved.language !== initialFeed.language ||
          saved.seed !== initialFeed.seed ||
          (saved.level ?? "all") !== (initialFeed.level ?? "all") ||
          (saved.channelId ?? null) !== (initialFeed.channelId ?? null))
      ) {
        const nextLang: PoolLanguage = saved.language === "de" ? "de" : "es";
        const nextLevel = saved.level ?? "all";
        const nextChannel = saved.channelId ?? null;
        const nextSeed = saved.seed;
        setLanguage(nextLang);
        setSelectedLevel(nextLevel);
        setSelectedChannelId(nextChannel);
        setSeed(nextSeed);
        if (saved.viewMode) setViewMode(saved.viewMode);
        void loadFeed({
          nextLang,
          nextLevel,
          nextChannelId: nextChannel,
          nextSeed
        });
      } else if (saved.viewMode) {
        setViewMode(saved.viewMode);
      }
    } catch {
      // ignore sessionStorage failure
    }
  }, [initialFeed, loadFeed]);

  useEffect(() => {
    try {
      const snap: SessionSnapshot = {
        language,
        seed,
        level: selectedLevel,
        channelId: selectedChannelId,
        viewMode
      };
      window.sessionStorage.setItem(SESSION_KEY, JSON.stringify(snap));
    } catch {
      // ignore
    }
  }, [language, seed, selectedLevel, selectedChannelId, viewMode]);

  const handleSelectLanguage = (nextLang: PoolLanguage) => {
    if (nextLang === language) return;
    const nextLevel = "all";
    const nextChannel = null;
    setLanguage(nextLang);
    setSelectedLevel(nextLevel);
    setSelectedChannelId(nextChannel);
    setViewMode("feed");
    void loadFeed({ nextLang, nextLevel, nextChannelId: nextChannel, nextSeed: seed });
  };

  const handleSelectLevel = (nextLevel: string) => {
    if (nextLevel === selectedLevel) return;
    setSelectedLevel(nextLevel);
    void loadFeed({
      nextLang: language,
      nextLevel,
      nextChannelId: selectedChannelId,
      nextSeed: seed
    });
  };

  const handleSelectChannel = (channelId: string | null) => {
    setSelectedChannelId(channelId);
    setSelectedLevel("all");
    void loadFeed({
      nextLang: language,
      nextLevel: "all",
      nextChannelId: channelId,
      nextSeed: seed
    });
  };

  const handleShuffle = () => {
    const nextSeed = seed + 1;
    setSeed(nextSeed);
    void loadFeed({
      nextLang: language,
      nextLevel: selectedLevel,
      nextChannelId: selectedChannelId,
      nextSeed
    });
  };

  const spotlight: TaggedVideoItem | null = useMemo(
    () => feed.videos[0] ?? feed.nearbyVideos[0] ?? null,
    [feed.videos, feed.nearbyVideos]
  );

  const activeChannel = useMemo(
    () => feed.channels.find((ch) => ch.id === selectedChannelId) ?? null,
    [feed.channels, selectedChannelId]
  );

  const levelPills = useMemo(() => {
    const baseLabel = language === "de" ? "德语精选（全部）" : "全部";
    return [
      { key: "all", label: baseLabel },
      ...feed.availableLevels.map((lvl) => ({ key: lvl, label: lvl }))
    ];
  }, [language, feed.availableLevels]);

  const topicChips = TOPICS_BY_LANG[language] ?? TOPICS_BY_LANG.es;

  return (
    <div className="space-y-8">
      {/* 语种与视图模式栏：跨频道推荐 vs 独立频道入口 */}
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="inline-flex rounded-full border border-zinc-200 bg-white p-1 dark:border-zinc-800 dark:bg-zinc-900">
          {(
            [
              { key: "es", label: "西班牙语视频" },
              { key: "de", label: "德语精选（首批）" }
            ] as const
          ).map((item) => (
            <button
              key={item.key}
              type="button"
              onClick={() => handleSelectLanguage(item.key)}
              className={`rounded-full px-4 py-1.5 text-xs font-semibold transition ${
                language === item.key
                  ? "bg-brand-500 text-white shadow-sm"
                  : "text-zinc-600 hover:text-zinc-900 dark:text-zinc-300"
              }`}
            >
              {item.label}
            </button>
          ))}
        </div>

        <div className="inline-flex rounded-full border border-zinc-200 bg-white p-1 dark:border-zinc-800 dark:bg-zinc-900">
          <button
            type="button"
            onClick={() => {
              setViewMode("feed");
              if (selectedChannelId) handleSelectChannel(null);
            }}
            className={`inline-flex items-center gap-1.5 rounded-full px-3.5 py-1.5 text-xs font-semibold transition ${
              viewMode === "feed" && !selectedChannelId
                ? "bg-zinc-900 text-white dark:bg-zinc-100 dark:text-zinc-900"
                : "text-zinc-600 hover:text-zinc-900 dark:text-zinc-300"
            }`}
          >
            <Compass className="h-3.5 w-3.5" aria-hidden />
            <span>推荐视频</span>
          </button>
          <button
            type="button"
            onClick={() => setViewMode("channels")}
            className={`inline-flex items-center gap-1.5 rounded-full px-3.5 py-1.5 text-xs font-semibold transition ${
              viewMode === "channels" || Boolean(selectedChannelId)
                ? "bg-zinc-900 text-white dark:bg-zinc-100 dark:text-zinc-900"
                : "text-zinc-600 hover:text-zinc-900 dark:text-zinc-300"
            }`}
          >
            <Tv className="h-3.5 w-3.5" aria-hidden />
            <span>频道目录 ({feed.channels.length})</span>
          </button>
        </div>
      </div>

      {/* 发现条：随机挑一集 + 换一批推荐 */}
      <div className="flex flex-col gap-4 rounded-surface border border-zinc-200/70 bg-white p-5 shadow-card dark:border-zinc-800/70 dark:bg-zinc-900 lg:flex-row lg:items-center lg:justify-between">
        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-2 text-xs font-semibold text-brand-600 dark:text-brand-400">
            <Sparkles className="h-3.5 w-3.5" aria-hidden />
            <span>
              {activeChannel
                ? `正在浏览频道 · ${activeChannel.title}`
                : "跨频道精选推荐 · 同一次浏览保持稳定顺序"}
            </span>
          </div>
          {spotlight ? (
            <div className="mt-2 flex flex-wrap items-center gap-3">
              <Link
                href={`/watch?v=${spotlight.id}`}
                className="line-clamp-1 font-display text-base font-bold text-zinc-900 transition hover:text-brand-600 dark:text-zinc-100 dark:hover:text-brand-400"
              >
                {spotlight.title}
              </Link>
              <span className="rounded-full bg-zinc-100 px-2.5 py-0.5 text-[11px] font-medium text-zinc-600 dark:bg-zinc-800 dark:text-zinc-300">
                {spotlight.channelTitle}
                {spotlight.level ? ` · ${spotlight.level}` : ""}
                {spotlight.duration ? ` · ${formatVideoDurationBadge(spotlight.duration)}` : ""}
              </span>
            </div>
          ) : (
            <p className="mt-1.5 text-sm text-zinc-500 dark:text-zinc-400">
              粘贴任意 YouTube 链接，或从下方探索话题搜索你想看的内容。
            </p>
          )}
        </div>

        <div className="flex shrink-0 flex-wrap items-center gap-2">
          {!activeChannel ? (
            <button
              type="button"
              onClick={handleShuffle}
              disabled={loading}
              className="inline-flex items-center gap-1.5 rounded-full border border-zinc-200 bg-white px-3.5 py-2 text-xs font-semibold text-zinc-700 transition hover:bg-zinc-50 disabled:opacity-50 dark:border-zinc-700 dark:bg-zinc-800 dark:text-zinc-200 dark:hover:bg-zinc-700"
            >
              <Shuffle className="h-3.5 w-3.5" aria-hidden />
              <span>换一批推荐</span>
            </button>
          ) : null}
          {spotlight ? (
            <Link
              href={`/watch?v=${spotlight.id}`}
              className="inline-flex items-center rounded-full bg-brand-500 px-4 py-2 text-xs font-semibold text-white transition hover:bg-brand-600"
            >
              立即观看 →
            </Link>
          ) : null}
        </div>
      </div>

      {/* 独立频道目录或具体某频道详情 */}
      {viewMode === "channels" && !selectedChannelId ? (
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {feed.channels.map((ch) => (
            <div
              key={ch.id}
              className="flex flex-col justify-between rounded-surface border border-zinc-200/70 bg-white p-5 shadow-card dark:border-zinc-800/70 dark:bg-zinc-900"
            >
              <div>
                <div className="flex items-center justify-between gap-2">
                  <h2 className="font-display text-base font-bold text-zinc-900 dark:text-zinc-100">
                    {ch.title}
                  </h2>
                  <span className="rounded-full bg-zinc-100 px-2.5 py-0.5 text-[11px] font-medium text-zinc-600 dark:bg-zinc-800 dark:text-zinc-300">
                    {ch.tag}
                  </span>
                </div>
                <p className="mt-2 text-sm leading-relaxed text-zinc-500 dark:text-zinc-400">
                  {ch.description}
                </p>
              </div>
              <div className="mt-4 flex items-center justify-between border-t border-zinc-100 pt-3 dark:border-zinc-800">
                <button
                  type="button"
                  onClick={() => handleSelectChannel(ch.id)}
                  className="text-xs font-semibold text-brand-600 hover:underline dark:text-brand-400"
                >
                  进入频道看全部视频 →
                </button>
                <Link
                  href={`/search?q=${encodeURIComponent(ch.title)}`}
                  className="text-xs text-zinc-400 hover:text-zinc-600 dark:text-zinc-500"
                >
                  搜索更多
                </Link>
              </div>
            </div>
          ))}
        </div>
      ) : null}

      {/* 难度筛选（挂在单条视频上，不绑频道） + 话题探索 */}
      {(viewMode === "feed" || selectedChannelId) ? (
        <>
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div className="flex flex-wrap items-center gap-2">
              {selectedChannelId ? (
                <button
                  type="button"
                  onClick={() => handleSelectChannel(null)}
                  className="inline-flex items-center gap-1 rounded-full border border-zinc-200 bg-white px-3 py-1.5 text-xs font-semibold text-zinc-700 hover:bg-zinc-50 dark:border-zinc-800 dark:bg-zinc-900 dark:text-zinc-200"
                >
                  <ArrowLeft className="h-3 w-3" aria-hidden />
                  <span>返回跨频道推荐</span>
                </button>
              ) : null}

              {levelPills.map((item) => (
                <button
                  key={item.key}
                  type="button"
                  onClick={() => handleSelectLevel(item.key)}
                  className={`rounded-full px-3.5 py-1.5 text-xs font-semibold transition ${
                    selectedLevel === item.key
                      ? "bg-brand-500 text-white shadow-sm"
                      : "border border-zinc-200 bg-white text-zinc-600 hover:bg-zinc-50 dark:border-zinc-800 dark:bg-zinc-900 dark:text-zinc-300"
                  }`}
                >
                  {item.label}
                </button>
              ))}
            </div>

            <div className="flex flex-wrap items-center gap-2">
              <span className="text-xs text-zinc-400 dark:text-zinc-500">探索话题：</span>
              {topicChips.map((topic) => (
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

          <div id="video-sections" className="space-y-8">
            {loading ? (
              <div className="rounded-surface border border-zinc-200/70 bg-white p-8 text-center text-sm text-zinc-400 dark:border-zinc-800 dark:bg-zinc-900">
                正在刷新视频列表…
              </div>
            ) : (
              <>
                {feed.isSparse ? (
                  <div className="rounded-surface border border-amber-200/70 bg-amber-50/70 px-4 py-3 text-xs text-amber-800 dark:border-amber-900/40 dark:bg-amber-950/30 dark:text-amber-200">
                    当前「{feed.level}」共 {feed.videos.length} 条可用视频，已如实展示；下方同时为你补充了相近难度推荐。
                  </div>
                ) : null}

                {feed.videos.length > 0 ? (
                  <div className="grid grid-cols-1 gap-5 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4">
                    {feed.videos.map((video) => (
                      <VideoCard key={video.id} fullWidth video={video} />
                    ))}
                  </div>
                ) : (
                  <div className="rounded-surface border border-dashed border-zinc-200 bg-surface px-6 py-10 text-center text-sm text-zinc-400 dark:border-zinc-800 dark:text-zinc-500">
                    当前「{feed.level}」暂无可用视频，请查看下方相近难度推荐或切回「全部」。
                  </div>
                )}

                {feed.nearbyVideos.length > 0 ? (
                  <section className="border-t border-zinc-100 pt-6 dark:border-zinc-800">
                    <div className="mb-4 flex items-center justify-between">
                      <h2 className="text-base font-semibold text-zinc-800 dark:text-zinc-200">
                        相近难度推荐（{feed.nearbyLevel}）
                      </h2>
                      <button
                        type="button"
                        onClick={() => feed.nearbyLevel && handleSelectLevel(feed.nearbyLevel)}
                        className="text-xs font-semibold text-brand-600 hover:underline dark:text-brand-400"
                      >
                        全部 {feed.nearbyLevel} →
                      </button>
                    </div>
                    <div className="grid grid-cols-1 gap-5 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4">
                      {feed.nearbyVideos.map((video) => (
                        <VideoCard key={`nearby-${video.id}`} fullWidth video={video} />
                      ))}
                    </div>
                  </section>
                ) : null}
              </>
            )}
          </div>
        </>
      ) : (
        <div id="video-sections" />
      )}
    </div>
  );
}
