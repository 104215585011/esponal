// Timestamp: 2026-11-17 15:20
import { apiFetch } from "@/api/client";
import type { LearningLanguage } from "@/lib/preferences";

export type WordEncounterItem = {
  id: string;
  sourceType: string;
  sourceUrl: string;
  timestampSec: number;
  originalSentence: string;
  translatedSentence: string;
  createdAt: string;
};

export type DueWord = {
  id: string;
  language?: LearningLanguage | string;
  lemma: string;
  translation: string | null;
  partOfSpeech: string | null;
  /** 保存词时快照的词典数据,翻面时展示释义/例句/名词单复数 */
  dictData?: {
    meanings?: string[];
    examples?: Array<{ es: string; zh: string }>;
    phonetic?: string | null;
    nounForms?: { singular: string; plural: string; gender: string };
  } | null;
  encounters?: WordEncounterItem[];
  srsDue: string | null;
  srsState: string | null;
  /** FSRS 累计复习次数,用来显示"已复习 N 次" */
  srsReps?: number;
};

export type ReviewQueue = {
  dueWords: DueWord[];
  totalDue: number;
};

export type ReviewRating = "Again" | "Hard" | "Good" | "Easy";

export type GradeResult = {
  nextDue: string;
  state: string;
};

/** 批大小可选(默认 20,服务端上限 50);自动续批时用同一默认,保持节奏稳定 */
export async function fetchReviewQueue(limit?: number, lang?: LearningLanguage) {
  const params = new URLSearchParams();
  if (limit && limit > 0) params.set("limit", String(Math.floor(limit)));
  if (lang) params.set("lang", lang);
  const qs = params.toString();
  return apiFetch<ReviewQueue>(`/api/vocab/review${qs ? `?${qs}` : ""}`);
}

/** 四档评分,服务端 FSRS 调度,返回下次复习时间 */
export function gradeReviewWord(wordId: string, rating: ReviewRating) {
  return apiFetch<GradeResult>(`/api/vocab/review/${wordId}`, {
    method: "POST",
    body: JSON.stringify({ rating })
  });
}
