// Timestamp: 2026-11-14 15:14
import { apiFetch } from "@/api/client";

export type VocabBucket = "all" | "new" | "learning" | "mastered";
export type VocabSort = "recent" | "alpha" | "due";

export type VocabListItem = {
  id: string;
  lemma: string;
  translation: string;
  partOfSpeech: string | null;
  phonetic: string | null;
  meanings: string[];
  encounterCount: number;
  srsDue: string | null;
  srsReps: number;
  srsState: string | null;
  createdAt: string;
};

export type VocabListResult = {
  total: number;
  items: VocabListItem[];
};

export async function fetchVocabList(
  params: {
    q?: string;
    bucket?: VocabBucket;
    sort?: VocabSort;
    limit?: number;
    offset?: number;
  } = {}
) {
  const search = new URLSearchParams();
  if (params.q?.trim()) search.set("q", params.q.trim());
  if (params.bucket && params.bucket !== "all") search.set("bucket", params.bucket);
  if (params.sort) search.set("sort", params.sort);
  search.set("limit", String(params.limit ?? 60));
  search.set("offset", String(params.offset ?? 0));

  return apiFetch<VocabListResult>(`/api/vocab/list?${search.toString()}`);
}

export async function deleteVocabWord(id: string) {
  return apiFetch<{ ok: boolean; deleted: number }>(
    `/api/vocab/list?id=${encodeURIComponent(id)}`,
    { method: "DELETE" }
  );
}

export type SavedPhrase = {
  id: string;
  lemma: string;
  kind: string;
  translationZh: string | null;
  explanationZh: string | null;
  /** Web 端保存时塞的是 { meanings, examples, phonetic, source } */
  data?: {
    examples?: Array<{ es?: string; zh?: string }>;
    source?: { sentence?: string; title?: string; url?: string; type?: string };
  } | null;
  createdAt: string;
};

export async function fetchSavedPhrases(limit = 100) {
  const res = await apiFetch<{ phrases?: SavedPhrase[] }>(
    `/api/vocab/phrase/list?limit=${limit}`
  );
  return res.phrases ?? [];
}
