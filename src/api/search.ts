// Timestamp: 2026-11-14 14:40
import { ApiError, apiFetch } from "@/api/client";
import type { VideoItem } from "@/api/watch";

export type VideoSearchResult = {
  videos: VideoItem[];
  nextPageToken: string;
  prevPageToken: string;
};

/**
 * 服务端 /api/youtube/search 有 24h 缓存 + 限流(每次 search.list 花 100 配额),
 * 所以同样的关键词重复搜不花钱;配额用完会返回 429。
 */
export async function searchVideos(
  query: string,
  options: { maxResults?: number; pageToken?: string } = {}
) {
  const params = new URLSearchParams({
    q: query,
    maxResults: String(options.maxResults ?? 20)
  });
  if (options.pageToken) params.set("page", options.pageToken);

  try {
    return await apiFetch<VideoSearchResult>(`/api/youtube/search?${params.toString()}`);
  } catch (e) {
    if (e instanceof ApiError && e.status === 429) {
      throw new Error(
        e.message.includes("配额")
          ? e.message
          : "搜索太频繁或今日配额已用完,过一会儿再试"
      );
    }
    throw e;
  }
}
