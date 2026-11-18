// Timestamp: 2026-11-17 23:14
import { apiFetch } from "@/api/client";
import type { LearningLanguage } from "@/lib/preferences";

export type VideoLevel = "A1" | "A2" | "B1";

export type VideoItem = {
  id: string;
  title: string;
  thumbnail: string;
  duration: string;
  channelId?: string;
  channelTitle: string;
  publishedAt: string;
  language?: LearningLanguage;
  level?: VideoLevel | null;
  levelSource?: "curated" | "inferred";
  topic?: string | null;
};

export type VideoChannelSource = {
  id: string;
  title: string;
  language: LearningLanguage;
  tag: string;
  description: string;
};

export type VideoFeedResponse = {
  language: LearningLanguage;
  seed: number;
  level: string;
  channelId: string | null;
  channels: VideoChannelSource[];
  availableLevels: VideoLevel[];
  countsByLevel: Record<VideoLevel, number>;
  totalCount: number;
  videos: VideoItem[];
  isSparse: boolean;
  nearbyLevel: VideoLevel | null;
  nearbyVideos: VideoItem[];
};

export type Cue = {
  start: number;
  dur: number;
  text: string;
};

export type CuratedChannelItem = {
  id: string;
  title: string;
  hint: string;
  level: string;
};

/** 精选频道 —— 与 Web 端 src/lib/channels.ts 保持一致 */
export const curatedChannels: readonly CuratedChannelItem[] = [
  { id: "UCouyFdE9-Lrjo3M_2idKq1A", title: "Dreaming Spanish", hint: "推荐入门,语速慢", level: "A1 入门" },
  { id: "UCW1FQuVy10_biDAxAj1iTEQ", title: "Spanish Okay", hint: "日常对话", level: "A1–A2" },
  { id: "UCAL4AMMMXKxHDu3FqZV6CbQ", title: "Easy Spanish", hint: "街头采访", level: "A2–B1" }
];

export const germanCuratedChannels: readonly CuratedChannelItem[] = [
  { id: "UCxUWIEL-USsiPak0Qy6_vVg", title: "DW Deutsch lernen", hint: "清晰德语原声", level: "A1–A2" },
  { id: "UCaeT58uDMlPpBlwAYaxN0LA", title: "Learn German Original", hint: "情景对话入门", level: "A1 入门" },
  { id: "UCbxb2fqe9oNgglAoYqsYOtQ", title: "Easy German", hint: "街头真实德语", level: "A2–B1" }
];

export const englishCuratedChannels: readonly CuratedChannelItem[] = [
  { id: "UCHaHD477h-FeBbVh9Sh7syA", title: "BBC Learning English", hint: "英音 6 分钟精讲", level: "A2–B1" },
  { id: "UCKyTokYo0nK2OA-az-sDijA", title: "VOA Learning English", hint: "慢速清晰新闻", level: "A1–A2" },
  { id: "UCxJGMJbjokfnr2-s4_RXPxQ", title: "Speak English With Vanessa", hint: "自然美式日常", level: "A2–B1" }
];

export const frenchCuratedChannels: readonly CuratedChannelItem[] = [
  { id: "UCoUWq2QawqdC3-nRXKk-JUw", title: "Easy French", hint: "街头真实法语", level: "A1–B1" },
  { id: "UCQpM25U6iqaRSO-SZxd5oDw", title: "Français Authentique", hint: "自然法语播客", level: "A2–B1" },
  { id: "UCI4xp8qHD1MDErkqxb1dPbA", title: "innerFrench", hint: "中速可理解法语", level: "A2–B1" }
];

export const japaneseCuratedChannels: readonly CuratedChannelItem[] = [
  { id: "UCu6sZrHyl4hSS2PvlUo2XZA", title: "Japanese with Shun", hint: "N5–N4 初级精讲", level: "N5–N4 (A1–A2)" },
  { id: "UCSbH_BPR_AoARW6RDYLlLog", title: "Speak Japanese Naturally", hint: "自然日语 vlog", level: "N4–N3 (A2–B1)" },
  { id: "UCsQCbl3a9FtYvA55BxdzYiQ", title: "Miku Real Japanese", hint: "地道对谈听力", level: "N4–N2 (A2–B1)" }
];

export function getCuratedChannels(lang: LearningLanguage): readonly CuratedChannelItem[] {
  if (lang === "de") return germanCuratedChannels;
  if (lang === "en") return englishCuratedChannels;
  if (lang === "fr") return frenchCuratedChannels;
  if (lang === "ja") return japaneseCuratedChannels;
  return curatedChannels;
}

export async function fetchChannelVideos(channelId: string, maxResults = 12) {
  return apiFetch<VideoItem[]>(
    `/api/youtube/channel?id=${encodeURIComponent(channelId)}&maxResults=${maxResults}`
  );
}

export async function fetchVideoFeed(options: {
  lang?: LearningLanguage;
  level?: string;
  channelId?: string | null;
  seed?: number;
} = {}) {
  const params = new URLSearchParams();
  if (options.lang) params.set("lang", options.lang);
  if (options.level && options.level !== "all") params.set("level", options.level);
  if (options.channelId) params.set("channelId", options.channelId);
  if (typeof options.seed === "number" && Number.isFinite(options.seed)) {
    params.set("seed", String(Math.floor(options.seed)));
  }
  const qs = params.toString();
  return apiFetch<VideoFeedResponse>(`/api/videos/feed${qs ? `?${qs}` : ""}`);
}

export async function fetchSubtitles(videoId: string, lang: LearningLanguage = "es") {
  const res = await apiFetch<{ cues?: Cue[] }>(
    `/api/subtitle?v=${encodeURIComponent(videoId)}&lang=${encodeURIComponent(lang)}`
  );
  return res.cues ?? [];
}

export type VerbConjugationPersons = {
  yo: string;
  tu: string;
  el: string;
  nosotros: string;
  vosotros: string;
  ellos: string;
};

export type VerbConjugationsPayload = {
  infinitive: string;
  presente: VerbConjugationPersons;
  preteritoIndefinido?: VerbConjugationPersons;
  preteritoImperfecto?: VerbConjugationPersons;
  preteritoPerfectoCompuesto?: VerbConjugationPersons;
  futuro?: VerbConjugationPersons;
  presenteSubjuntivo?: VerbConjugationPersons;
  condicional?: VerbConjugationPersons;
  participio?: string;
  gerundio?: string;
};

export type CognateHint = {
  isCognate: boolean;
  isFalseFriend?: boolean;
  englishWord: string;
  patternLabel: string;
  tipZh: string;
};

export type NounArticleCue = {
  article: string;
  pluralArticle: string;
  singularWithArticle: string;
  pluralWithArticle: string | null;
  maskedWithArticle: string;
  gender: "m" | "f" | "mf" | "n";
  genderLabel: string;
};

export type LookupResult = {
  word: string;
  lemma: string;
  language?: LearningLanguage | string;
  detectedLanguage?: string | null;
  partOfSpeech?: string | null;
  meanings?: string[];
  examples?: Array<{ es: string; zh: string }>;
  phonetic?: string | null;
  /** 词法讲解(词库条目的 explanationZh),meanings 为空时的兜底内容 */
  morphInfo?: string | null;
  /** 用法说明(固定搭配/构词) */
  usageNote?: string | null;
  relatedPhrases?: Array<{ lemma: string; translationZh: string | null; kind: string }>;
  nounForms?: { singular: string; plural: string; gender: string };
  adjectiveForms?: { ms: string; fs: string; mp: string; fp: string };
  conjugations?: VerbConjugationsPayload;
  isSaved?: boolean;
  wordId?: string | null;
  wordStatus?: string | null;
  cognateHint?: CognateHint | null;
  articleCue?: NounArticleCue | null;
};

export async function lookupWord(
  word: string,
  language?: LearningLanguage,
  context?: string
) {
  const qs = new URLSearchParams({ word });
  if (language) qs.set("lang", language);
  if (context?.trim()) qs.set("context", context.trim().slice(0, 260));
  return apiFetch<LookupResult>(`/api/vocab/lookup?${qs.toString()}`);
}

export async function saveWord(body: {
  word: string;
  lemma?: string;
  status?: "NEW" | "LEARNING" | "KNOWN";
  translation?: string;
  context?: string;
  language?: LearningLanguage;
  form?: string;
  sourceType?: "video" | "course" | "lectura" | "dissect" | "grammar" | "import" | "talk";
  sourceUrl?: string;
  originalSentence?: string;
  translatedSentence?: string;
  timestampSec?: number;
}) {
  const word = body.word.trim();
  const lemma = (body.lemma ?? word).trim() || word;
  const translation = body.translation?.trim() || lemma;
  const originalSentence = body.originalSentence?.trim() || body.context?.trim() || word || lemma;
  const payload = {
    ...body,
    word,
    lemma,
    translation,
    form: body.form?.trim() || word || lemma,
    sourceType: body.sourceType ?? "lectura",
    sourceUrl: body.sourceUrl?.trim() || "app://mobile/lookup",
    originalSentence,
    translatedSentence: body.translatedSentence?.trim() || translation,
    timestampSec: typeof body.timestampSec === "number" ? body.timestampSec : 0
  };
  return apiFetch<{ ok?: boolean }>("/api/vocab/add", {
    method: "POST",
    body: JSON.stringify(payload)
  });
}

/** 收藏搭配/短语/习语(与 Web 端 LookupCard 同一个接口) */
export async function savePhrase(body: {
  lemma: string;
  kind: "collocation" | "phrase" | "idiom";
  translationZh?: string | null;
  explanationZh?: string | null;
  data?: unknown;
  language?: LearningLanguage;
}) {
  return apiFetch<{ ok?: boolean }>("/api/vocab/phrase/add", {
    method: "POST",
    body: JSON.stringify(body)
  });
}

/** 句级翻译。服务端按源语种分片缓存,同一句不会重复花额度。 */
export async function translateText(
  text: string,
  sourceLang?: LearningLanguage
): Promise<string | null> {
  const trimmed = text.trim();
  if (!trimmed) return null;

  try {
    const res = await apiFetch<{ translation?: string }>("/api/translate", {
      method: "POST",
      body: JSON.stringify({
        text: trimmed,
        ...(sourceLang ? { sourceLang } : {})
      })
    });
    return res.translation?.trim() || null;
  } catch {
    // 翻译失败不能影响字幕显示 —— 静默降级为只显示原文
    return null;
  }
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
