// Timestamp: 2026-11-16 09:08
import { apiFetch } from "@/api/client";

export type LecturaLevel = "A1" | "A2" | "B1";

export type LecturaListItem = {
  slug: string;
  title: string;
  titleZh: string;
  level: LecturaLevel;
  source: string;
  sourceType?: "curated" | "rss";
  durationMin: number;
  summaryZh: string;
  paragraphCount: number;
  publishedAt?: string;
  audioUrl?: string;
  coverUrl?: string;
  isRead: boolean;
};

export type LecturaStory = LecturaListItem & {
  paragraphs: string[];
  glossary: Array<{ word: string; note: string }>;
  sourceUrl?: string;
  coverUrl?: string;
};

export async function fetchStories(forceRefresh = false) {
  const query = forceRefresh ? "?refresh=1" : "";
  const res = await apiFetch<{ items: LecturaListItem[]; total: number }>(
    `/api/lectura/stories${query}`
  );
  return res.items;
}

export async function fetchStory(slug: string) {
  const res = await apiFetch<{ story: LecturaStory }>(
    `/api/lectura/stories/${encodeURIComponent(slug)}`
  );
  return res.story;
}

/** 批量将文章/电子书段落翻译为中文（服务端 Redis 缓存 30 天） */
export async function translateParagraphs(paragraphs: string[], sourceLang = "es") {
  if (paragraphs.length === 0) return [] as string[];
  const res = await apiFetch<{ translations: string[] }>("/api/lectura/translate", {
    method: "POST",
    body: JSON.stringify({ paragraphs, sourceLang })
  });
  return res.translations ?? [];
}

/** 标记已读。失败不抛错 —— 阅读体验不该被这个打断。 */
export async function markStoryRead(slug: string) {
  try {
    await apiFetch<{ ok: boolean }>(
      `/api/lectura/${encodeURIComponent(slug)}/read`,
      { method: "POST" }
    );
    return true;
  } catch {
    return false;
  }
}
