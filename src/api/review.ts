// Timestamp: 2026-11-18 16:45
import { apiFetch } from "@/api/client";
import type { CognateHint, NounArticleCue } from "@/api/watch";
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

export type ReviewCloze = {
  maskedSentence: string;
  answerForm: string;
  fullSentence: string;
  translatedSentence: string;
};

export type DueWord = {
  id: string;
  itemType?: "word" | "phrase";
  phraseKind?: string | null;
  language?: LearningLanguage | string;
  lemma: string;
  forms?: string[];
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
  encounterCount?: number;
  encounterForm?: string | null;
  articleCue?: NounArticleCue | null;
  cloze?: ReviewCloze | null;
  cognateHint?: CognateHint | null;
  frequencyLevel?: string | null;
  priorityReason?: string | null;
  isLowFrequency?: boolean;
  srsDue: string | null;
  srsState: string | null;
  /** FSRS 累计复习次数,用来显示"已复习 N 次" */
  srsReps?: number;
  srsLapses?: number;
};

export type ReviewQueue = {
  dueWords: DueWord[];
  totalDue: number;
};

export type ReviewRating = "Again" | "Hard" | "Good" | "Easy";

export type GradeResult = {
  nextDue: string;
  state: string;
  itemType?: "word" | "phrase";
};

/** 批大小可选(默认 20,服务端上限 50);自动续批时用同一默认,保持节奏稳定 */
export async function fetchReviewQueue(limit?: number, lang?: LearningLanguage) {
  const params = new URLSearchParams();
  if (limit && limit > 0) params.set("limit", String(Math.floor(limit)));
  if (lang) params.set("lang", lang);
  const qs = params.toString();
  return apiFetch<ReviewQueue>(`/api/vocab/review${qs ? `?${qs}` : ""}`);
}

/** 四档评分,服务端 FSRS 调度（支持单词与语块），返回下次复习时间 */
export function gradeReviewWord(
  wordId: string,
  rating: ReviewRating,
  itemType: "word" | "phrase" = "word"
) {
  return apiFetch<GradeResult>(`/api/vocab/review/${wordId}`, {
    method: "POST",
    body: JSON.stringify({ rating, itemType })
  });
}

/** 标为「已掌握」（同源秒懂 / 低频跳过），移出待复习队列但仍保留在词库中 */
export function markVocabStatus(
  id: string,
  status: "KNOWN" | "LEARNING" | "NEW",
  itemType: "word" | "phrase" = "word"
) {
  return apiFetch<{ ok: boolean; status: string }>("/api/vocab/status", {
    method: "POST",
    body: JSON.stringify({ id, status, itemType })
  });
}
