// Timestamp: 2026-11-13 17:40
import { apiFetch } from "@/api/client";

export type VideoItem = {
  id: string;
  title: string;
  thumbnail: string;
  duration: string;
  channelTitle: string;
  publishedAt: string;
};

export type Cue = {
  start: number;
  dur: number;
  text: string;
};

/** 精选频道 —— 与 Web 端 src/lib/channels.ts 保持一致 */
export const curatedChannels = [
  { id: "UCouyFdE9-Lrjo3M_2idKq1A", title: "Dreaming Spanish", hint: "推荐入门,语速慢" },
  { id: "UCW1FQuVy10_biDAxAj1iTEQ", title: "Spanish Okay", hint: "日常对话" },
  { id: "UCAL4AMMMXKxHDu3FqZV6CbQ", title: "Easy Spanish", hint: "街头采访" }
] as const;

export async function fetchChannelVideos(channelId: string, maxResults = 12) {
  return apiFetch<VideoItem[]>(
    `/api/youtube/channel?id=${encodeURIComponent(channelId)}&maxResults=${maxResults}`
  );
}

export async function fetchSubtitles(videoId: string) {
  const res = await apiFetch<{ cues?: Cue[] }>(
    `/api/subtitle?v=${encodeURIComponent(videoId)}&lang=es`
  );
  return res.cues ?? [];
}

export type LookupResult = {
  word: string;
  lemma: string;
  partOfSpeech?: string | null;
  meanings?: string[];
  examples?: Array<{ es: string; zh: string }>;
  phonetic?: string | null;
  isSaved?: boolean;
  wordId?: string | null;
};

export async function lookupWord(word: string) {
  return apiFetch<LookupResult>(`/api/vocab/lookup?word=${encodeURIComponent(word)}`);
}

export async function saveWord(body: {
  word: string;
  lemma?: string;
  translation?: string;
  context?: string;
}) {
  return apiFetch<{ ok?: boolean }>("/api/vocab/add", {
    method: "POST",
    body: JSON.stringify(body)
  });
}

/** "PT18M28S" → "18:28";也兼容 "PT1H2M3S" */
export function formatDuration(raw: string) {
  const m = /^PT(?:(\d+)H)?(?:(\d+)M)?(?:(\d+)S)?$/.exec(raw ?? "");
  if (!m) return "";
  const h = Number(m[1] ?? 0);
  const min = Number(m[2] ?? 0);
  const sec = Number(m[3] ?? 0);
  const pad = (n: number) => String(n).padStart(2, "0");
  return h > 0 ? `${h}:${pad(min)}:${pad(sec)}` : `${min}:${pad(sec)}`;
}

export function formatClock(seconds: number) {
  const total = Math.max(0, Math.floor(seconds));
  const min = Math.floor(total / 60);
  const sec = total % 60;
  return `${min}:${String(sec).padStart(2, "0")}`;
}
