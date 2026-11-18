// Timestamp: 2026-11-18 11:04
import { normalizeLanguage, type LearningLanguage } from "@/lib/languages";
export { SPANISH_CURATED_SOURCES, type VideoSourceSpec } from "@/lib/spanish-sources";

export type CuratedChannel = {
  id: string;
  title: string;
  language: LearningLanguage;
  level: string;
  tag: string;
  description: string;
};

export const spanishCuratedChannels: CuratedChannel[] = [
  {
    title: "Dreaming Spanish",
    id: "UCouyFdE9-Lrjo3M_2idKq1A",
    language: "es",
    level: "A1–B1",
    tag: "可理解输入",
    description: "语速分级清晰、配合画面与故事讲解，适合系统建立西语听力输入。"
  },
  {
    title: "Spanish Okay",
    id: "UCW1FQuVy10_biDAxAj1iTEQ",
    language: "es",
    level: "A1–A2",
    tag: "日常表达",
    description: "贴近日常生活的短主题与高频表达，适合碎片时间反复磨耳朵。"
  },
  {
    title: "Easy Spanish",
    id: "UCAL4AMMMXKxHDu3FqZV6CbQ",
    language: "es",
    level: "A1–B1",
    tag: "街头真实对话",
    description: "既有初学者慢速对话，也有街头真实采访与文化特辑，适合适应自然语速。"
  },
  {
    title: "Español con Juan",
    id: "UCoHJ7PkM6T92LwgJgrnDhWA",
    language: "es",
    level: "A2–B1",
    tag: "故事与旅行",
    description: "以自然故事串联西班牙日常生活、早餐闲聊与旅行见闻，代入感强。"
  },
  {
    title: "Why Not Spanish?",
    id: "UCIdFcLCIJQ_YMrormG_nU8w",
    language: "es",
    level: "A1–A2",
    tag: "拉美日常",
    description: "哥伦比亚西语母语者慢速讲解高频表达、生活日常与旅行 Vlog。"
  },
  {
    title: "Hola Spanish",
    id: "UC67BDv__7er_ZaYKqhOSOFQ",
    language: "es",
    level: "A1–B1",
    tag: "实用情景",
    description: "覆盖初学者入门对话、生活 Vlog 与拉美文化听力素材。"
  }
];

export const germanCuratedChannels: CuratedChannel[] = [
  {
    title: "DW Deutsch lernen",
    id: "UCxUWIEL-USsiPak0Qy6_vVg",
    language: "de",
    level: "A1–B1",
    tag: "清晰德语原声",
    description: "德国之声官方德语学习频道，含慢速新闻 Kurz und leicht 与文化短片。"
  },
  {
    title: "Learn German Original",
    id: "UCaeT58uDMlPpBlwAYaxN0LA",
    language: "de",
    level: "A1–A2",
    tag: "情景与辨析",
    description: "情景对话、常用语法辨析与生活表达，附带完整德语原文字幕。"
  },
  {
    title: "Easy German",
    id: "UCbxb2fqe9oNgglAoYqsYOtQ",
    language: "de",
    level: "A2–B1",
    tag: "街头真实德语",
    description: "柏林及德语区街头真实采访，体验自然语速与地道口语表达。"
  }
];

export const englishCuratedChannels: CuratedChannel[] = [
  {
    title: "BBC Learning English",
    id: "UCHaHD477h-FeBbVh9Sh7syA",
    language: "en",
    level: "A1–B1",
    tag: "英音精听百科",
    description: "BBC 官方英语学习频道，覆盖自然词汇、Real Easy English 与地道发音。"
  },
  {
    title: "VOA Learning English",
    id: "UCKyTokYo0nK2OA-az-sDijA",
    language: "en",
    level: "A1–A2",
    tag: "慢速标准美音",
    description: "语速放缓、用词精炼的 Everyday Grammar 与新闻短片，非常适合入门精听。"
  },
  {
    title: "Speak English With Vanessa",
    id: "UCxJGMJbjokfnr2-s4_RXPxQ",
    language: "en",
    level: "A2–B1",
    tag: "生活英语对话",
    description: "轻松自然的美式日常会话与生活场景表达，搭配清晰英文字幕。"
  }
];

export const frenchCuratedChannels: CuratedChannel[] = [
  {
    title: "Easy French",
    id: "UCoUWq2QawqdC3-nRXKk-JUw",
    language: "fr",
    level: "A1–B1",
    tag: "慢速法语与街头",
    description: "既有 Slow French 初学对话，也有巴黎与法语区真实街头采访。"
  },
  {
    title: "Français Authentique",
    id: "UCQpM25U6iqaRSO-SZxd5oDw",
    language: "fr",
    level: "A2–B1",
    tag: "自然口语输入",
    description: "Johan 清晰自然的法语讲解与 Café Avec Johan 话题对谈，带完整法语字幕。"
  },
  {
    title: "innerFrench",
    id: "UCI4xp8qHD1MDErkqxb1dPbA",
    language: "fr",
    level: "A2–B1",
    tag: "深度中慢速播客",
    description: "语速适中、文化与思考主题丰富的中级法语可理解输入精选。"
  }
];

export const japaneseCuratedChannels: CuratedChannel[] = [
  {
    title: "Japanese with Shun",
    id: "UCu6sZrHyl4hSS2PvlUo2XZA",
    language: "ja",
    level: "N5–N4 (A1–A2)",
    tag: "初级可理解日语",
    description: "围绕 N5–N4 日常语法与生活话题展开，慢速清晰并附日文字幕。"
  },
  {
    title: "Speak Japanese Naturally",
    id: "UCSbH_BPR_AoARW6RDYLlLog",
    language: "ja",
    level: "N4–N3 (A2–B1)",
    tag: "自然日语vlog",
    description: "柔和自然的日语生活文化分享，适合锻炼真实听力节奏与语感。"
  },
  {
    title: "Miku Real Japanese",
    id: "UCsQCbl3a9FtYvA55BxdzYiQ",
    language: "ja",
    level: "N4–N2 (A2–B1)",
    tag: "地道对谈听力",
    description: "真实日语会话与深度访谈节目，适合进一步适应自然语速。"
  }
];

// Keep curatedChannels Spanish-only for legacy callers; use getCuratedChannelsByLanguage(lang) for multi-lang.
export const curatedChannels: CuratedChannel[] = spanishCuratedChannels;

export function getCuratedChannelsByLanguage(language?: string | null): CuratedChannel[] {
  const lang = normalizeLanguage(language);
  if (lang === "de") return germanCuratedChannels;
  if (lang === "en") return englishCuratedChannels;
  if (lang === "fr") return frenchCuratedChannels;
  if (lang === "ja") return japaneseCuratedChannels;
  return spanishCuratedChannels;
}
