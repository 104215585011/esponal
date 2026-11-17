// Timestamp: 2026-11-17 23:09
export type VideoLevel = "A1" | "A2" | "B1";
export type SupportedVideoLanguage = "es" | "de" | "en" | "fr" | "ja";

export type YouTubeVideoPayload = {
  id: string;
  title: string;
  thumbnail: string;
  duration: string;
  channelId?: string;
  channelTitle: string;
  publishedAt: string;
  language?: SupportedVideoLanguage;
  level?: VideoLevel | null;
  levelSource?: "curated" | "inferred";
  topic?: string | null;
};

export function formatVideoDurationBadge(duration: string) {
  const hours = Number.parseInt(duration.match(/(\d+)H/)?.[1] ?? "0", 10);
  const minutes = Number.parseInt(duration.match(/(\d+)M/)?.[1] ?? "0", 10);
  const seconds = Number.parseInt(duration.match(/(\d+)S/)?.[1] ?? "0", 10);

  if (hours > 0) {
    return `${hours}:${String(minutes).padStart(2, "0")}:${String(seconds).padStart(2, "0")}`;
  }

  return `${String(minutes).padStart(2, "0")}:${String(seconds).padStart(2, "0")}`;
}
