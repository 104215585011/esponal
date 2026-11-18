// Timestamp: 2026-11-18 11:22
import { apiFetch } from "@/api/client";
import type { LearningLanguage } from "@/lib/preferences";

export type LecturaLevel = "A1" | "A2" | "B1";
export type LecturaContentKind = "story" | "blog" | "news";
export type LecturaAudioType = "native" | "tts";

export type LecturaListItem = {
  slug: string;
  language?: LearningLanguage;
  contentKind?: LecturaContentKind;
  sourceId?: string;
  title: string;
  titleZh: string;
  level: LecturaLevel | null;
  source: string;
  sourceType?: "curated" | "rss";
  topic?: string;
  isFullText?: boolean;
  audioType?: LecturaAudioType;
  durationMin: number;
  summaryZh: string;
  paragraphCount: number;
  publishedAt?: string;
  audioUrl?: string;
  coverUrl?: string;
  isRead: boolean;
  completed?: boolean;
  lastParagraphIndex?: number;
};

export type LecturaContinueItem = {
  slug: string;
  language: LearningLanguage;
  title: string;
  titleZh: string;
  summaryZh: string;
  topic: string;
  level: LecturaLevel | null;
  durationMin: number;
  contentKind: LecturaContentKind;
  sourceLabel: string;
  lastParagraphIndex: number;
  totalParagraphs: number;
  updatedAt: string;
};

export type LecturaSourceSummary = {
  sourceId: string;
  sourceLabel: string;
  contentKind: LecturaContentKind;
  count: number;
};

export type LecturaNextRecommendation = {
  slug: string;
  title: string;
  titleZh: string;
  summaryZh: string;
  topic: string;
  level: LecturaLevel | null;
  durationMin: number;
  sourceLabel: string;
  audioType: LecturaAudioType;
  isFullText: boolean;
  matchedWords: string[];
  reasonZh: string;
};

export type LecturaFeedResponse = {
  language?: LearningLanguage;
  items: LecturaListItem[];
  continueReading: LecturaContinueItem | null;
  sources: LecturaSourceSummary[];
  total: number;
};

export type LecturaStory = LecturaListItem & {
  paragraphs: string[];
  glossary: Array<{ word: string; note: string }>;
  sourceUrl?: string;
  coverUrl?: string;
  nextRecommendation?: LecturaNextRecommendation | null;
};

export async function fetchLecturaFeed(
  forceRefresh = false,
  lang?: LearningLanguage
): Promise<LecturaFeedResponse> {
  const params = new URLSearchParams();
  if (forceRefresh) params.set("refresh", "1");
  if (lang) params.set("lang", lang);
  const query = params.toString();
  const res = await apiFetch<LecturaFeedResponse>(
    `/api/lectura/stories${query ? `?${query}` : ""}`
  );
  return {
    language: res.language,
    items: res.items ?? [],
    continueReading: res.continueReading ?? null,
    sources: res.sources ?? [],
    total: res.total ?? (res.items?.length ?? 0)
  };
}

export async function fetchStories(forceRefresh = false, lang?: LearningLanguage) {
  const res = await fetchLecturaFeed(forceRefresh, lang);
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
  const out: string[] = [];
  for (let i = 0; i < paragraphs.length; i += 35) {
    const chunk = paragraphs.slice(i, i + 35);
    const res = await apiFetch<{ translations: string[] }>("/api/lectura/translate", {
      method: "POST",
      body: JSON.stringify({ paragraphs: chunk, sourceLang })
    });
    const list = res.translations ?? [];
    for (let j = 0; j < chunk.length; j += 1) {
      out.push(list[j] ?? "");
    }
  }
  return out;
}

/** 记录段落续读位置（不提前标记「读完了」）。 */
export async function reportLecturaProgress(
  slug: string,
  paragraphIndex: number,
  totalParagraphs: number
) {
  try {
    await apiFetch<{ ok: boolean; completed?: boolean; lastParagraphIndex?: number }>(
      `/api/lectura/${encodeURIComponent(slug)}/read`,
      {
        method: "POST",
        body: JSON.stringify({
          action: "progress",
          paragraphIndex: Math.max(0, Math.floor(paragraphIndex)),
          totalParagraphs: Math.max(0, Math.floor(totalParagraphs))
        })
      }
    );
    return true;
  } catch {
    return false;
  }
}

/** 显式标记「读完了」，并返回下一篇推荐文章。 */
export async function completeLecturaStory(slug: string, totalParagraphs = 0) {
  try {
    const res = await apiFetch<{
      ok: boolean;
      completed?: boolean;
      nextRecommendation?: LecturaNextRecommendation | null;
    }>(`/api/lectura/${encodeURIComponent(slug)}/read`, {
      method: "POST",
      body: JSON.stringify({
        action: "complete",
        totalParagraphs: Math.max(0, Math.floor(totalParagraphs))
      })
    });
    return {
      ok: Boolean(res.ok),
      nextRecommendation: res.nextRecommendation ?? null
    };
  } catch {
    return { ok: false, nextRecommendation: null };
  }
}

/** 兼容旧调用，等价于显式完成。 */
export async function markStoryRead(slug: string) {
  const res = await completeLecturaStory(slug);
  return res.ok;
}
