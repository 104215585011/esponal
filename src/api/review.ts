// Timestamp: 2026-11-18 17:38
import { apiFetch } from "@/api/client";
import { savePhrase, saveWord, type CognateHint, type NounArticleCue } from "@/api/watch";
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

export type ReviewQueueMode = "all" | "recent" | "due" | "quick5";

export type ReviewCounts = {
  recent: number;
  due: number;
  quick5: number;
  unstartedNew: number;
};

export type DueWord = {
  id: string;
  itemType?: "word" | "phrase";
  phraseKind?: string | null;
  queueBucket?: "recent" | "due" | "new";
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
  mode?: ReviewQueueMode;
  counts?: ReviewCounts;
};

export type ReviewRating = "Again" | "Hard" | "Good" | "Easy";

export type GradeResult = {
  nextDue: string;
  state: string;
  itemType?: "word" | "phrase";
};

export type StarterHighFreqItem = {
  id: string;
  language: LearningLanguage | string;
  lemma: string;
  displayForm: string;
  kind: "word" | "phrase";
  posLabel: string;
  translationZh: string;
  exampleEs: string;
  exampleZh: string;
  noteZh: string;
  inVocab?: boolean;
  status?: string | null;
};

/** 按模式拉取复习队列：recent（最近遇到） / due（到期复习） / quick5（练5分钟） / all */
export async function fetchReviewQueue(
  limit?: number,
  lang?: LearningLanguage,
  mode: ReviewQueueMode = "all"
) {
  const params = new URLSearchParams();
  if (limit && limit > 0) params.set("limit", String(Math.floor(limit)));
  if (lang) params.set("lang", lang);
  if (mode !== "all") params.set("mode", mode);
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

/** 获取起步高频骨架词卡包（先混眼熟、看中文听读音） */
export async function fetchStarterPack(lang?: LearningLanguage) {
  const qs = lang ? `?lang=${encodeURIComponent(lang)}` : "";
  const res = await apiFetch<{ language: string; items: StarterHighFreqItem[] }>(
    `/api/vocab/starter${qs}`
  );
  return res.items ?? [];
}

/** 将起步卡包中的词/语块一键加入待复习或标为早就会了 */
export async function saveStarterItem(
  item: StarterHighFreqItem,
  status: "NEW" | "KNOWN",
  lang: LearningLanguage
) {
  if (item.kind === "phrase") {
    return savePhrase({
      lemma: item.lemma,
      kind: "phrase",
      translationZh: item.translationZh,
      explanationZh: item.noteZh,
      language: lang,
      data: {
        meanings: [item.translationZh],
        examples: [{ es: item.exampleEs, zh: item.exampleZh }],
        source: { sentence: item.exampleEs, type: "starter" }
      }
    });
  }
  return saveWord({
    word: item.lemma,
    lemma: item.lemma,
    status,
    translation: item.translationZh,
    form: item.lemma,
    language: lang,
    sourceType: "course",
    sourceUrl: "app://mobile/starter",
    originalSentence: item.exampleEs,
    translatedSentence: item.exampleZh,
    timestampSec: 0
  });
}
