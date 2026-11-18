// Timestamp: 2026-11-18 11:25
"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import { BookOpen, Clock, Headphones, Layers, PlayCircle, Volume2 } from "lucide-react";
import type { LecturaContinueItem, LecturaFeedItem } from "@/lib/lectura/catalog";
import type { LecturaContentKind, LecturaLevel } from "@/lib/lectura/catalog-logic";

type LecturaDiscoveryClientProps = {
  initialItems: LecturaFeedItem[];
  continueReading: LecturaContinueItem | null;
  sources: Array<{ id: string; label: string; contentKind: LecturaContentKind; count: number }>;
};

type LevelFilter = "ALL" | LecturaLevel | "UNCONFIRMED";
type DurationFilter = "ALL" | "SHORT" | "MEDIUM" | "LONG";
type ViewTab = "discover" | "sources";

const KIND_LABEL: Record<LecturaContentKind, string> = {
  story: "分级短文",
  blog: "文化博客",
  news: "精选新闻"
};

const levelBadgeClass: Record<string, string> = {
  A1: "bg-brand-50 dark:bg-brand-950/30 text-brand-700 dark:text-brand-400 border border-brand-200/40 dark:border-brand-800/30",
  A2: "bg-sky-50 dark:bg-sky-950/30 text-sky-700 dark:text-sky-300 border border-sky-200/40 dark:border-sky-800/30",
  B1: "bg-amber-50 dark:bg-amber-950/20 text-amber-700 dark:text-amber-400 border border-amber-200/40 dark:border-amber-800/30",
  UNCONFIRMED: "bg-zinc-100 dark:bg-zinc-800 text-zinc-600 dark:text-zinc-300 border border-zinc-200/60 dark:border-zinc-700/60"
};

export function LecturaDiscoveryClient({
  initialItems,
  continueReading,
  sources
}: LecturaDiscoveryClientProps) {
  const [viewTab, setViewTab] = useState<ViewTab>("discover");
  const [levelFilter, setLevelFilter] = useState<LevelFilter>("ALL");
  const [topicFilter, setTopicFilter] = useState<string>("ALL");
  const [durationFilter, setDurationFilter] = useState<DurationFilter>("ALL");
  const [sourceFilter, setSourceFilter] = useState<string | null>(null);

  const availableTopics = useMemo(() => {
    const counts = new Map<string, number>();
    for (const item of initialItems) {
      counts.set(item.topic, (counts.get(item.topic) ?? 0) + 1);
    }
    return Array.from(counts.entries())
      .sort((a, b) => b[1] - a[1])
      .map(([topic]) => topic);
  }, [initialItems]);

  const filteredItems = useMemo(() => {
    return initialItems.filter((item) => {
      if (sourceFilter && item.sourceId !== sourceFilter) return false;
      if (levelFilter === "UNCONFIRMED" && item.level !== null) return false;
      if (
        (levelFilter === "A1" || levelFilter === "A2" || levelFilter === "B1") &&
        item.level !== levelFilter
      ) {
        return false;
      }
      if (topicFilter !== "ALL" && item.topic !== topicFilter) return false;
      if (durationFilter === "SHORT" && item.durationMin > 3) return false;
      if (durationFilter === "MEDIUM" && (item.durationMin < 4 || item.durationMin > 6)) return false;
      if (durationFilter === "LONG" && item.durationMin < 7) return false;
      return true;
    });
  }, [initialItems, sourceFilter, levelFilter, topicFilter, durationFilter]);

  const activeSourceLabel = useMemo(
    () => sources.find((s) => s.id === sourceFilter)?.label ?? null,
    [sources, sourceFilter]
  );

  return (
    <div className="space-y-6">
      {/* 1. 最顶部：继续阅读 */}
      {continueReading ? (
        <Link
          href={`/lectura/${continueReading.slug}?p=${continueReading.lastParagraphIndex}`}
          className="group block rounded-[22px] border border-brand-200/70 bg-gradient-to-r from-brand-50/80 via-white to-white p-5 shadow-card transition hover:-translate-y-[1px] hover:shadow-elevated dark:border-brand-800/40 dark:from-brand-950/30 dark:via-zinc-900 dark:to-zinc-900"
        >
          <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
            <div className="min-w-0 flex-1 space-y-1">
              <div className="flex flex-wrap items-center gap-2 text-xs font-semibold text-brand-700 dark:text-brand-400">
                <PlayCircle className="h-4 w-4" aria-hidden />
                <span>继续阅读</span>
                <span className="text-zinc-400 dark:text-zinc-500">·</span>
                <span className="text-zinc-600 dark:text-zinc-300">
                  已读到第 {continueReading.lastParagraphIndex + 1} /{" "}
                  {Math.max(1, continueReading.totalParagraphs)} 段
                </span>
              </div>
              <h2 className="truncate text-lg font-bold text-zinc-900 group-hover:text-brand-600 dark:text-zinc-100 dark:group-hover:text-brand-400">
                {continueReading.titleZh}
              </h2>
              <p className="line-clamp-1 text-sm text-zinc-600 dark:text-zinc-400">
                {continueReading.summaryZh}
              </p>
            </div>
            <span className="inline-flex shrink-0 items-center justify-center rounded-full bg-brand-500 px-4 py-2 text-xs font-semibold text-white transition group-hover:bg-brand-600">
              接着读 →
            </span>
          </div>
          <div className="mt-3 h-1.5 w-full overflow-hidden rounded-full bg-zinc-200/70 dark:bg-zinc-800">
            <div
              className="h-full rounded-full bg-brand-500 transition-all"
              style={{
                width: `${Math.min(
                  100,
                  Math.max(
                    8,
                    Math.round(
                      ((continueReading.lastParagraphIndex + 1) /
                        Math.max(1, continueReading.totalParagraphs)) *
                        100
                    )
                  )
                )}%`
              }}
            />
          </div>
        </Link>
      ) : null}

      {/* 2. 独立入口切换（精选推荐 vs 来源列表） */}
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="inline-flex rounded-full border border-zinc-200 bg-white p-1 dark:border-zinc-800 dark:bg-zinc-900">
          <button
            type="button"
            onClick={() => {
              setViewTab("discover");
              setSourceFilter(null);
            }}
            className={`inline-flex items-center gap-1.5 rounded-full px-4 py-1.5 text-xs font-semibold transition ${
              viewTab === "discover" && !sourceFilter
                ? "bg-zinc-900 text-white dark:bg-zinc-100 dark:text-zinc-900"
                : "text-zinc-600 hover:text-zinc-900 dark:text-zinc-300"
            }`}
          >
            <BookOpen className="h-3.5 w-3.5" aria-hidden />
            <span>精选推荐 ({initialItems.length})</span>
          </button>
          <button
            type="button"
            onClick={() => setViewTab("sources")}
            className={`inline-flex items-center gap-1.5 rounded-full px-4 py-1.5 text-xs font-semibold transition ${
              viewTab === "sources" || Boolean(sourceFilter)
                ? "bg-zinc-900 text-white dark:bg-zinc-100 dark:text-zinc-900"
                : "text-zinc-600 hover:text-zinc-900 dark:text-zinc-300"
            }`}
          >
            <Layers className="h-3.5 w-3.5" aria-hidden />
            <span>来源列表 ({sources.length})</span>
          </button>
        </div>

        {activeSourceLabel ? (
          <button
            type="button"
            onClick={() => {
              setSourceFilter(null);
              setViewTab("discover");
            }}
            className="text-xs font-semibold text-brand-600 hover:underline dark:text-brand-400"
          >
            正在看：{activeSourceLabel} · 返回跨来源推荐 ✕
          </button>
        ) : null}
      </div>

      {/* 来源列表视图 */}
      {viewTab === "sources" && !sourceFilter ? (
        <div className="grid grid-cols-1 gap-3.5 md:grid-cols-2 lg:grid-cols-3">
          {sources.map((src) => (
            <button
              key={src.id}
              type="button"
              onClick={() => {
                setSourceFilter(src.id);
                setViewTab("discover");
              }}
              className="flex flex-col justify-between rounded-[20px] border border-zinc-200/70 bg-surface p-5 text-left shadow-card transition hover:-translate-y-[2px] hover:border-brand-300 hover:shadow-elevated dark:border-zinc-800/70"
            >
              <div>
                <div className="flex items-center justify-between gap-2">
                  <span className="rounded-full bg-zinc-100 px-2.5 py-0.5 text-[11px] font-semibold text-zinc-600 dark:bg-zinc-800 dark:text-zinc-300">
                    {KIND_LABEL[src.contentKind]}
                  </span>
                  <span className="text-xs text-zinc-400">{src.count} 篇已校验全文</span>
                </div>
                <h3 className="mt-3 text-base font-bold text-zinc-900 dark:text-zinc-100">
                  {src.label}
                </h3>
              </div>
              <p className="mt-4 text-xs font-semibold text-brand-600 dark:text-brand-400">
                查看该来源全部文章 →
              </p>
            </button>
          ))}
        </div>
      ) : (
        <>
          {/* 3. 多维筛选栏：难度 + 题材 + 阅读时长 */}
          <div className="space-y-2.5 rounded-[20px] border border-zinc-200/60 bg-surface p-4 dark:border-zinc-800/60">
            <div className="flex flex-wrap items-center gap-2">
              <span className="text-[11px] font-semibold text-zinc-400">难度</span>
              {(
                [
                  { key: "ALL", label: "全部" },
                  { key: "A1", label: "A1" },
                  { key: "A2", label: "A2" },
                  { key: "B1", label: "B1" },
                  { key: "UNCONFIRMED", label: "难度待确认" }
                ] as const
              ).map((opt) => (
                <button
                  key={opt.key}
                  type="button"
                  onClick={() => setLevelFilter(opt.key)}
                  className={`rounded-full px-3 py-1 text-xs font-semibold transition ${
                    levelFilter === opt.key
                      ? "bg-brand-500 text-white"
                      : "bg-zinc-100 text-zinc-600 hover:bg-zinc-200 dark:bg-zinc-800 dark:text-zinc-300"
                  }`}
                >
                  {opt.label}
                </button>
              ))}
            </div>

            <div className="flex flex-wrap items-center gap-2">
              <span className="text-[11px] font-semibold text-zinc-400">题材</span>
              <button
                type="button"
                onClick={() => setTopicFilter("ALL")}
                className={`rounded-full px-3 py-1 text-xs font-semibold transition ${
                  topicFilter === "ALL"
                    ? "bg-zinc-900 text-white dark:bg-zinc-100 dark:text-zinc-900"
                    : "bg-zinc-100 text-zinc-600 hover:bg-zinc-200 dark:bg-zinc-800 dark:text-zinc-300"
                }`}
              >
                全部题材
              </button>
              {availableTopics.map((topic) => (
                <button
                  key={topic}
                  type="button"
                  onClick={() => setTopicFilter(topic)}
                  className={`rounded-full px-3 py-1 text-xs font-semibold transition ${
                    topicFilter === topic
                      ? "bg-zinc-900 text-white dark:bg-zinc-100 dark:text-zinc-900"
                      : "bg-zinc-100 text-zinc-600 hover:bg-zinc-200 dark:bg-zinc-800 dark:text-zinc-300"
                  }`}
                >
                  {topic}
                </button>
              ))}
            </div>

            <div className="flex flex-wrap items-center gap-2">
              <span className="text-[11px] font-semibold text-zinc-400">时长</span>
              {(
                [
                  { key: "ALL", label: "全部" },
                  { key: "SHORT", label: "3 分钟内" },
                  { key: "MEDIUM", label: "4–6 分钟" },
                  { key: "LONG", label: "7 分钟+" }
                ] as const
              ).map((opt) => (
                <button
                  key={opt.key}
                  type="button"
                  onClick={() => setDurationFilter(opt.key)}
                  className={`rounded-full px-3 py-1 text-xs font-semibold transition ${
                    durationFilter === opt.key
                      ? "bg-zinc-900 text-white dark:bg-zinc-100 dark:text-zinc-900"
                      : "bg-zinc-100 text-zinc-600 hover:bg-zinc-200 dark:bg-zinc-800 dark:text-zinc-300"
                  }`}
                >
                  {opt.label}
                </button>
              ))}
            </div>
          </div>

          {/* 4. 选文推荐卡片列表（中文标题 + 一句具体看点 + 时长/难度/主题 + 原文标题） */}
          {filteredItems.length === 0 ? (
            <div className="rounded-[20px] border border-zinc-200/70 bg-surface p-8 text-center text-sm text-zinc-500 dark:border-zinc-800/70">
              当前筛选条件下暂无匹配文章，试试放宽难度或时长筛选。
            </div>
          ) : (
            <div className="grid grid-cols-1 gap-3.5 md:grid-cols-2 md:gap-4 lg:grid-cols-3">
              {filteredItems.map((story) => {
                const lvlKey = story.level ?? "UNCONFIRMED";
                const href =
                  !story.completed && story.lastParagraphIndex > 0
                    ? `/lectura/${story.slug}?p=${story.lastParagraphIndex}`
                    : `/lectura/${story.slug}`;
                return (
                  <Link
                    key={story.slug}
                    href={href}
                    className={`group flex flex-col justify-between gap-3 rounded-[20px] border p-4 shadow-card transition-all active:scale-[0.98] md:p-[18px] md:hover:-translate-y-[2px] md:hover:border-brand-200 md:dark:hover:border-brand-800 md:hover:shadow-elevated ${
                      story.completed
                        ? "border-brand-100/60 bg-brand-50/5 dark:border-brand-900/30"
                        : "border-zinc-200/60 bg-surface dark:border-zinc-800/60"
                    }`}
                  >
                    <div>
                      <div className="flex flex-wrap items-center justify-between gap-1.5">
                        <div className="flex flex-wrap items-center gap-1.5">
                          <span
                            className={`inline-flex items-center rounded-full px-2 py-0.5 text-[10px] font-semibold ${
                              levelBadgeClass[lvlKey]
                            }`}
                          >
                            {story.level ?? "难度待确认"}
                          </span>
                          <span className="rounded-full bg-zinc-100 px-2 py-0.5 text-[10px] font-medium text-zinc-600 dark:bg-zinc-800 dark:text-zinc-300">
                            {story.topic}
                          </span>
                          {!story.isFullText ? (
                            <span className="rounded-full bg-amber-50 px-2 py-0.5 text-[10px] font-medium text-amber-700 dark:bg-amber-950/30 dark:text-amber-300">
                              节选
                            </span>
                          ) : null}
                        </div>

                        {story.completed ? (
                          <span className="inline-flex items-center rounded-full border border-brand-100/50 bg-brand-50 px-1.5 py-0.5 text-[10px] font-bold text-brand-600 dark:border-brand-900/30 dark:bg-brand-950/40 dark:text-brand-400">
                            已读完
                          </span>
                        ) : story.lastParagraphIndex > 0 ? (
                          <span className="rounded-full bg-sky-50 px-2 py-0.5 text-[10px] font-semibold text-sky-700 dark:bg-sky-950/40 dark:text-sky-300">
                            第 {story.lastParagraphIndex + 1}/{story.paragraphCount} 段
                          </span>
                        ) : null}
                      </div>

                      <h3 className="mt-2.5 line-clamp-2 text-[17px] font-bold leading-snug text-zinc-900 group-hover:text-brand-600 dark:text-zinc-100 dark:group-hover:text-brand-400">
                        {story.titleZh}
                      </h3>

                      <p className="mt-1.5 line-clamp-2 text-[13px] leading-relaxed text-zinc-600 dark:text-zinc-400">
                        {story.summaryZh}
                      </p>

                      <p className="mt-2 line-clamp-1 text-[11.5px] font-medium text-zinc-400 dark:text-zinc-500">
                        {story.title}
                      </p>
                    </div>

                    <div className="flex flex-wrap items-center justify-between gap-2 border-t border-zinc-100 pt-2.5 text-[11px] font-medium text-zinc-500 dark:border-zinc-800/80 dark:text-zinc-400">
                      <span className="inline-flex items-center gap-1">
                        <Clock className="h-3 w-3" aria-hidden />约 {story.durationMin} 分钟 ·{" "}
                        {story.source}
                      </span>
                      <span className="inline-flex items-center gap-1">
                        {story.audioType === "native" ? (
                          <>
                            <Headphones className="h-3 w-3 text-brand-600" aria-hidden />
                            <span className="text-brand-700 dark:text-brand-400">原声</span>
                          </>
                        ) : (
                          <>
                            <Volume2 className="h-3 w-3" aria-hidden />
                            <span>合成朗读</span>
                          </>
                        )}
                      </span>
                    </div>
                  </Link>
                );
              })}
            </div>
          )}
        </>
      )}
    </div>
  );
}
