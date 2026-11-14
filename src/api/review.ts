// Timestamp: 2026-11-14 12:35
import { apiFetch } from "@/api/client";

export type DueWord = {
  id: string;
  lemma: string;
  translation: string | null;
  partOfSpeech: string | null;
  /** 保存词时快照的词典数据,翻面时展示释义/例句 */
  dictData?: {
    meanings?: string[];
    examples?: Array<{ es: string; zh: string }>;
    phonetic?: string | null;
  } | null;
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

export async function fetchReviewQueue() {
  return apiFetch<ReviewQueue>("/api/vocab/review");
}

/** 四档评分,服务端 FSRS 调度,返回下次复习时间 */
export function gradeReviewWord(wordId: string, rating: ReviewRating) {
  return apiFetch<GradeResult>(`/api/vocab/review/${wordId}`, {
    method: "POST",
    body: JSON.stringify({ rating })
  });
}
