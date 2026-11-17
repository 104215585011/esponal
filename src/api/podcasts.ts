// Timestamp: 2026-11-17 15:20
import { API_BASE, apiFetch } from "@/api/client";
import type { LearningLanguage } from "@/lib/preferences";

export type PodcastShow = {
  id: string;
  language?: LearningLanguage;
  title: string;
  host: string;
  level: "A2" | "B1";
  description: string;
  coverUrl?: string;
};

export type PodcastEpisode = {
  id: string;
  language?: LearningLanguage;
  showId: string;
  showTitle: string;
  level: "A2" | "B1";
  title: string;
  description: string;
  audioUrl: string;
  coverUrl?: string;
  durationSec: number | null;
  publishedAt: string;
  link: string;
};

export type PodcastCue = {
  start: number;
  dur: number;
  text: string;
  zh: string;
};

/** 走服务器 /api/listening/image 代理海外播客/新闻封面图（国内稳定秒开、24h 缓存） */
export function getProxiedCoverUrl(rawUrl?: string | null): string {
  const trimmed = rawUrl?.trim() ?? "";
  if (!trimmed) return "";
  if (trimmed.includes("/api/listening/image")) return trimmed;
  return `${API_BASE}/api/listening/image?url=${encodeURIComponent(trimmed)}`;
}

/** 走服务器 /api/listening/audio 代理转发海外播客 CDN（国内直连易超时）并保留 Range 断点续传 */
export function getProxiedPodcastAudioUrl(rawUrl: string): string {
  const trimmed = rawUrl.trim();
  if (!trimmed) return "";
  if (trimmed.includes("/api/listening/audio")) return trimmed;
  return `${API_BASE}/api/listening/audio?url=${encodeURIComponent(trimmed)}`;
}

export async function fetchPodcasts(forceRefresh = false, lang?: LearningLanguage) {
  const params = new URLSearchParams();
  if (forceRefresh) params.set("refresh", "1");
  if (lang) params.set("lang", lang);
  const query = params.toString();
  return apiFetch<{ shows: PodcastShow[]; episodes: PodcastEpisode[]; total: number }>(
    `/api/listening/podcasts${query ? `?${query}` : ""}`
  );
}

export async function fetchPodcastSubtitles(body: {
  audioUrl: string;
  startSec?: number;
  durationSec?: number;
  pageUrl?: string;
  sourceText?: string;
  language?: LearningLanguage;
}) {
  return apiFetch<{
    cues: PodcastCue[];
    available?: boolean;
    windowStartSec: number;
    windowEndSec: number;
    source?: "transcript" | "article-text" | "ai-asr";
    cached?: boolean;
  }>("/api/listening/subtitles", {
    method: "POST",
    body: JSON.stringify(body)
  });
}
