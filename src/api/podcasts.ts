// Timestamp: 2026-11-15 14:30
import { API_BASE, apiFetch } from "@/api/client";

export type PodcastShow = {
  id: string;
  title: string;
  host: string;
  level: "A2" | "B1";
  description: string;
};

export type PodcastEpisode = {
  id: string;
  showId: string;
  showTitle: string;
  level: "A2" | "B1";
  title: string;
  description: string;
  audioUrl: string;
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

/** 走服务器 /api/listening/audio 代理转发海外播客 CDN（国内直连易超时）并保留 Range 断点续传 */
export function getProxiedPodcastAudioUrl(rawUrl: string): string {
  const trimmed = rawUrl.trim();
  if (!trimmed) return "";
  if (trimmed.includes("/api/listening/audio")) return trimmed;
  return `${API_BASE}/api/listening/audio?url=${encodeURIComponent(trimmed)}`;
}

export async function fetchPodcasts(forceRefresh = false) {
  const query = forceRefresh ? "?refresh=1" : "";
  return apiFetch<{ shows: PodcastShow[]; episodes: PodcastEpisode[]; total: number }>(
    `/api/listening/podcasts${query}`
  );
}

export async function fetchPodcastSubtitles(body: {
  audioUrl: string;
  startSec?: number;
  durationSec?: number;
}) {
  return apiFetch<{
    cues: PodcastCue[];
    windowStartSec: number;
    windowEndSec: number;
    cached?: boolean;
  }>("/api/listening/subtitles", {
    method: "POST",
    body: JSON.stringify(body)
  });
}
