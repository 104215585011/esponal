// Timestamp: 2026-11-14 14:35
import { apiFetch } from "@/api/client";

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
  videoId: string;
  title: string;
  channelTitle: string;
  thumbnail: string | null;
  viewedAt: string;
};

export async function fetchVocabStats() {
  return apiFetch<VocabStats>("/api/vocab/stats");
}

export async function fetchWatchHistory(limit = 8) {
  const res = await apiFetch<{ videos?: WatchHistoryItem[] }>(
    `/api/watch/history?limit=${limit}`
  );
  return res.videos ?? [];
}

/** 打开播放页时静默上报,失败不打扰用户 */
export async function reportWatchHistory(item: {
  videoId: string;
  title: string;
  channelTitle: string;
  thumbnail?: string | null;
}) {
  try {
    await apiFetch("/api/watch/history", {
      method: "POST",
      body: JSON.stringify({
        videoId: item.videoId,
        title: item.title,
        channelTitle: item.channelTitle,
        thumbnail: item.thumbnail ?? null
      })
    });
  } catch {
    // 历史只是辅助数据,失败就算了
  }
}
