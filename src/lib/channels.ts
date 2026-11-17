// Timestamp: 2026-11-17 14:55
import { normalizeLanguage, type LearningLanguage } from "@/lib/languages";

export type CuratedChannel = {
  id: string;
  title: string;
  language: LearningLanguage;
  level: string;
  tag: string;
  description: string;
};

export const germanCuratedChannels: CuratedChannel[] = [
  {
    title: "DW Deutsch lernen",
    id: "UCxUWIEL-USsiPak0Qy6_vVg",
    language: "de",
    level: "A1–A2",
    tag: "清晰德语原声",
    description: "德国之声官方德语学习频道，发音清晰、带德语原文字幕，适合入门与精听。"
  },
  {
    title: "Learn German Original",
    id: "UCaeT58uDMlPpBlwAYaxN0LA",
    language: "de",
    level: "A1 入门",
    tag: "情景对话入门",
    description: "节奏柔和的日常德语情景短片与对话，含德语原文字幕，适合 A1 起步。"
  },
  {
    title: "Easy German",
    id: "UCbxb2fqe9oNgglAoYqsYOtQ",
    language: "de",
    level: "A2–B1",
    tag: "街头真实德语",
    description: "柏林及德国街头真实采访与地道生活表达，带完整德语原文字幕。"
  }
];

export const spanishCuratedChannels: CuratedChannel[] = [
  {
    title: "Dreaming Spanish",
    id: "UCouyFdE9-Lrjo3M_2idKq1A",
    language: "es",
    level: "A1 入门",
    tag: "慢速可理解输入",
    description: "推荐入门，语速慢、配合画面手势，适合建立最初的可理解输入。"
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
    level: "A2–B1",
    tag: "街头真实对话",
    description: "街头真实采访与地道口语，适合进阶适应自然语速与不同口音。"
  }
];

// Keep curatedChannels Spanish-only for legacy PC callers until multi-lang Web UI ships.
export const curatedChannels: CuratedChannel[] = spanishCuratedChannels;

export function getCuratedChannelsByLanguage(language?: string | null): CuratedChannel[] {
  const lang = normalizeLanguage(language);
  if (lang === "de") return germanCuratedChannels;
  return spanishCuratedChannels;
}
