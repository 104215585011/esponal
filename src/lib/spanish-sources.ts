// Timestamp: 2026-11-18 11:02
import type { VideoLevel } from "./youtube-shared.ts";

export type VideoSourceSpec = {
  language: "es" | "de" | "en" | "fr" | "ja";
  sourceType: "playlist" | "channel" | "curated";
  sourceId: string;
  playlistId?: string;
  label: string;
  channelId: string;
  channelTitle: string;
  hintTopic: string;
  hintLevel: VideoLevel | null;
  take: number;
};

/**
 * 西语视频入库来源表（频道最新 + 精选历史播放列表，覆盖慢速对话、日常、旅行、美食文化）。
 * 本文件不依赖 `@/` 路径别名，供服务端与入库脚本直接共用。
 */
export const SPANISH_CURATED_SOURCES: VideoSourceSpec[] = [
  {
    language: "es",
    sourceType: "playlist",
    sourceId: "PLlpPf-YgbU7GbOHc3siOGQ5KmVSngZucl",
    label: "Dreaming Spanish · Superbeginner",
    channelId: "UCouyFdE9-Lrjo3M_2idKq1A",
    channelTitle: "Dreaming Spanish",
    hintTopic: "慢速对话",
    hintLevel: "A1",
    take: 15
  },
  {
    language: "es",
    sourceType: "playlist",
    sourceId: "PLlpPf-YgbU7HWrrenMs3-nuhxgzyAiA-C",
    label: "Dreaming Spanish · Beginner",
    channelId: "UCouyFdE9-Lrjo3M_2idKq1A",
    channelTitle: "Dreaming Spanish",
    hintTopic: "日常生活",
    hintLevel: "A2",
    take: 15
  },
  {
    language: "es",
    sourceType: "channel",
    sourceId: "UCouyFdE9-Lrjo3M_2idKq1A",
    playlistId: "UUouyFdE9-Lrjo3M_2idKq1A",
    label: "Dreaming Spanish · Uploads",
    channelId: "UCouyFdE9-Lrjo3M_2idKq1A",
    channelTitle: "Dreaming Spanish",
    hintTopic: "文化故事",
    hintLevel: null,
    take: 20
  },
  {
    language: "es",
    sourceType: "playlist",
    sourceId: "PLQGxDRfENoxI8G98kBR5ky1UQcst3g33M",
    label: "Easy Spanish · A1 Beginners",
    channelId: "UCAL4AMMMXKxHDu3FqZV6CbQ",
    channelTitle: "Easy Spanish",
    hintTopic: "慢速对话",
    hintLevel: "A1",
    take: 15
  },
  {
    language: "es",
    sourceType: "playlist",
    sourceId: "PLQGxDRfENoxKq86RU0IYqFIsMFgMRpVf-",
    label: "Easy Spanish · Slow Spanish",
    channelId: "UCAL4AMMMXKxHDu3FqZV6CbQ",
    channelTitle: "Easy Spanish",
    hintTopic: "慢速对话",
    hintLevel: "A2",
    take: 15
  },
  {
    language: "es",
    sourceType: "playlist",
    sourceId: "PLQGxDRfENoxJ7iehMYPaVaDyPOquC0fIB",
    label: "Easy Spanish · A2",
    channelId: "UCAL4AMMMXKxHDu3FqZV6CbQ",
    channelTitle: "Easy Spanish",
    hintTopic: "日常生活",
    hintLevel: "A2",
    take: 12
  },
  {
    language: "es",
    sourceType: "playlist",
    sourceId: "PLQGxDRfENoxJ_cdraefXK67ozp8LxI_Ar",
    label: "Easy Spanish · B1",
    channelId: "UCAL4AMMMXKxHDu3FqZV6CbQ",
    channelTitle: "Easy Spanish",
    hintTopic: "街头采访",
    hintLevel: "B1",
    take: 12
  },
  {
    language: "es",
    sourceType: "channel",
    sourceId: "UCW1FQuVy10_biDAxAj1iTEQ",
    playlistId: "UUW1FQuVy10_biDAxAj1iTEQ",
    label: "Spanish Okay",
    channelId: "UCW1FQuVy10_biDAxAj1iTEQ",
    channelTitle: "Spanish Okay",
    hintTopic: "日常表达",
    hintLevel: null,
    take: 20
  },
  {
    language: "es",
    sourceType: "playlist",
    sourceId: "PLnNH-ry7VPzG9PKwVk9Us4546jQf4B9Jv",
    label: "Español con Juan · Viajando por España",
    channelId: "UCoHJ7PkM6T92LwgJgrnDhWA",
    channelTitle: "Español con Juan",
    hintTopic: "旅行探索",
    hintLevel: "A2",
    take: 12
  },
  {
    language: "es",
    sourceType: "playlist",
    sourceId: "PLnNH-ry7VPzFfKoTnLxM-nXKYHOy4KVIK",
    label: "Español con Juan · Desayunos con Juan",
    channelId: "UCoHJ7PkM6T92LwgJgrnDhWA",
    channelTitle: "Español con Juan",
    hintTopic: "美食文化",
    hintLevel: "A2",
    take: 12
  },
  {
    language: "es",
    sourceType: "playlist",
    sourceId: "PLnNH-ry7VPzFx7TOxXPbv2F2Tu4Y3TQu-",
    label: "Español con Juan · Nivel 1 (A2)",
    channelId: "UCoHJ7PkM6T92LwgJgrnDhWA",
    channelTitle: "Español con Juan",
    hintTopic: "日常生活",
    hintLevel: "A2",
    take: 12
  },
  {
    language: "es",
    sourceType: "playlist",
    sourceId: "PLuxkQNK6eN38cnyo8-_0b5va_tXeCtVxF",
    label: "Why Not Spanish? · Beginners",
    channelId: "UCIdFcLCIJQ_YMrormG_nU8w",
    channelTitle: "Why Not Spanish?",
    hintTopic: "慢速对话",
    hintLevel: "A1",
    take: 12
  },
  {
    language: "es",
    sourceType: "playlist",
    sourceId: "PLuxkQNK6eN3-C6lrz5au-qr57EHd-auwj",
    label: "Why Not Spanish? · Colombia Vlogs",
    channelId: "UCIdFcLCIJQ_YMrormG_nU8w",
    channelTitle: "Why Not Spanish?",
    hintTopic: "旅行探索",
    hintLevel: null,
    take: 12
  },
  {
    language: "es",
    sourceType: "playlist",
    sourceId: "PLmjtTRcSsKI6_rvHhq_matzJBJM40kSuH",
    label: "Hola Spanish · A1 Beginners",
    channelId: "UC67BDv__7er_ZaYKqhOSOFQ",
    channelTitle: "Hola Spanish",
    hintTopic: "日常生活",
    hintLevel: "A1",
    take: 12
  },
  {
    language: "es",
    sourceType: "playlist",
    sourceId: "PLmjtTRcSsKI5nA3xQTOH4h8o_baA1Osh6",
    label: "Hola Spanish · Vlogs",
    channelId: "UC67BDv__7er_ZaYKqhOSOFQ",
    channelTitle: "Hola Spanish",
    hintTopic: "日常生活",
    hintLevel: null,
    take: 12
  }
];
