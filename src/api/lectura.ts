// Timestamp: 2026-11-13 23:25
import { apiFetch } from "@/api/client";

export type LecturaLevel = "A1" | "A2" | "B1";

export type LecturaListItem = {
  slug: string;
  title: string;
  titleZh: string;
  level: LecturaLevel;
  source: string;
  durationMin: number;
  summaryZh: string;
  paragraphCount: number;
  isRead: boolean;
};

export type LecturaStory = LecturaListItem & {
  paragraphs: string[];
  glossary: Array<{ word: string; note: string }>;
};

export async function fetchStories() {
  const res = await apiFetch<{ items: LecturaListItem[]; total: number }>(
    "/api/lectura/stories"
  );
  return res.items;
}

export async function fetchStory(slug: string) {
  const res = await apiFetch<{ story: LecturaStory }>(
    `/api/lectura/stories/${encodeURIComponent(slug)}`
  );
  return res.story;
}
