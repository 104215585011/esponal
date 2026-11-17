// Timestamp: 2026-11-17 15:20
import { apiFetch } from "@/api/client";
import type { LearningLanguage } from "@/lib/preferences";

/** 与 Web 端 /api/vocab/stats 返回结构对齐 */
export type EncounterBucket = {
  label: string;
  min: number;
  max: number | null;
  count: number;
};

export type SourceStat = {
  type: string;
  label: string;
  count: number;
};

export type VocabStats = {
  totalSaved: number;
  encounterBuckets: EncounterBucket[];
  weeklyNew: number;
  bySource: SourceStat[];
};

export type WatchHistoryItem = {
  id: string;
  language?: LearningLanguage;
  videoId: string;
  title: string;
  channelTitle: string;
  thumbnail: string | null;
  viewedAt: string;
  /** 服务端记录的观看进度（秒）；老记录可能没有 */
  position?: number | null;
  duration?: number | null;
};

export async function fetchVocabStats(lang?: LearningLanguage) {
  const qs = lang ? `?lang=${encodeURIComponent(lang)}` : "";
  return apiFetch<VocabStats>(`/api/vocab/stats${qs}`);
}

export async function fetchWatchHistory(
  limit = 8,
  options?: { lang?: LearningLanguage; all?: boolean }
) {
  const params = new URLSearchParams({ limit: String(limit) });
  if (options?.all) params.set("all", "1");
  else if (options?.lang) params.set("lang", options.lang);
  const res = await apiFetch<{ videos?: WatchHistoryItem[] }>(
    `/api/watch/history?${params.toString()}`
  );
  return res.videos ?? [];
}

/** 打开播放页时静默上报,失败不打扰用户 */
export async function reportWatchHistory(item: {
  videoId: string;
  title: string;
  channelTitle: string;
  thumbnail?: string | null;
  language?: LearningLanguage;
}) {
  try {
    await apiFetch("/api/watch/history", {
      method: "POST",
      body: JSON.stringify({
        videoId: item.videoId,
        title: item.title,
        channelTitle: item.channelTitle,
        thumbnail: item.thumbnail ?? null,
        ...(item.language ? { language: item.language } : {})
      })
    });
  } catch {
    // 历史只是辅助数据,失败就算了
  }
}
