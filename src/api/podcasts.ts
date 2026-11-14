// Timestamp: 2026-11-15 07:55
import { apiFetch } from "@/api/client";

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

export async function fetchPodcasts(forceRefresh = false) {
  const query = forceRefresh ? "?refresh=1" : "";
  return apiFetch<{ shows: PodcastShow[]; episodes: PodcastEpisode[]; total: number }>(
    `/api/listening/podcasts${query}`
  );
}
