// Timestamp: 2026-11-14 20:25
import { apiFetch } from "@/api/client";

/** 与服务端 /api/mobile/grammar 返回结构对齐(内容源与 Web 端同一份) */

export type GrammarTopicSummary = {
  slug: string;
  group: string;
  title: string;
  intro: string;
};

export type GrammarListResult = {
  groups: string[];
  topics: GrammarTopicSummary[];
};

export type ConjugationRow = {
  pronoun: string;
  person: string;
  form: string;
  audioLabel?: string;
};

export type GrammarExample = {
  spanish: string;
  chinese: string;
  reason: string;
};

export type GrammarTopic = GrammarTopicSummary & {
  analogy: string;
  conjugations?: ConjugationRow[];
  rules?: string[];
  examples?: GrammarExample[];
  comparison?: {
    ser: GrammarExample[];
    estar: GrammarExample[];
  };
  related?: Array<{ label: string; slug: string }>;
};

export async function fetchGrammarTopics(): Promise<GrammarListResult> {
  const res = await apiFetch<GrammarListResult>("/api/mobile/grammar");
  return {
    groups: Array.isArray(res?.groups) ? res.groups : [],
    topics: Array.isArray(res?.topics) ? res.topics : []
  };
}

export async function fetchGrammarTopic(slug: string): Promise<GrammarTopic> {
  const res = await apiFetch<{ topic: GrammarTopic }>(
    `/api/mobile/grammar/${encodeURIComponent(slug)}`
  );
  if (!res?.topic) throw new Error("语法内容加载失败");
  return res.topic;
}
