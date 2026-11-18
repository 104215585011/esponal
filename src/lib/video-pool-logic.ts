// Timestamp: 2026-11-18 10:12
import type { SupportedVideoLanguage, VideoLevel, YouTubeVideoPayload } from "./youtube-shared";

export type PoolLanguage = SupportedVideoLanguage;

export type ChannelSourceInfo = {
  id: string;
  title: string;
  language: PoolLanguage;
  tag: string;
  description: string;
};

export type TaggedVideoItem = YouTubeVideoPayload & {
  channelId: string;
  language: PoolLanguage;
  level: VideoLevel | null;
  levelSource?: "curated" | "inferred";
  topic: string;
  sourceType?: "channel" | "playlist" | "curated";
  sourceLabel?: string | null;
  subtitleStatus?: "ready";
  subtitleSource?: string | null;
  subtitleCueCount?: number | null;
  isViewed?: boolean;
};

export type CatalogRawVideoInput = YouTubeVideoPayload & {
  sourceType?: "channel" | "playlist" | "curated";
  sourceLabel?: string | null;
  subtitleStatus?: "ready";
  subtitleSource?: string | null;
  subtitleCueCount?: number | null;
};

export type VideoFeedResponsePayload = {
  language: PoolLanguage;
  seed: number;
  level: string;
  channelId: string | null;
  channels: ChannelSourceInfo[];
  availableLevels: VideoLevel[];
  countsByLevel: Record<VideoLevel, number>;
  totalCount: number;
  videos: TaggedVideoItem[];
  isSparse: boolean;
  nearbyLevel: VideoLevel | null;
  nearbyVideos: TaggedVideoItem[];
};

type CuratedVideoMeta = {
  language: PoolLanguage;
  level: VideoLevel;
  topic: string;
  channelId?: string;
  channelTitle?: string;
  title?: string;
  duration?: string;
  publishedAt?: string;
};

/**
 * 单条视频人工难度与主题标注表。
 * 频道仅代表内容来源；难度挂在单条视频上，Android 与 Web 共用同一规则。
 */
export const CURATED_VIDEO_META: Record<string, CuratedVideoMeta> = {
  // === 德语 (de) ===
  mRGBj128pX4: {
    language: "de",
    level: "A1",
    topic: "日常表达",
    channelId: "UCaeT58uDMlPpBlwAYaxN0LA",
    channelTitle: "Learn German Original",
    title: "„Ein bisschen\" – der höfliche Weichmacher I A1-A2 I Sonntags-Sprachtipp I Learn German",
    duration: "PT48S"
  },
  S9uBtVRUryA: {
    language: "de",
    level: "A1",
    topic: "日常表达",
    channelId: "UCxUWIEL-USsiPak0Qy6_vVg",
    channelTitle: "DW Deutsch lernen",
    title: "Was sagt euer Gesicht heute? Schreibt es in die Kommentare!",
    duration: "PT30S"
  },
  u0PomvsfffA: {
    language: "de",
    level: "A1",
    topic: "情景对话",
    channelId: "UCaeT58uDMlPpBlwAYaxN0LA",
    channelTitle: "Learn German Original",
    title: "Hör zu & sprich mit: Deutsch im Büro | Dialog 3 | Learn German",
    duration: "PT1M24S"
  },
  PcpIYSMSFPc: {
    language: "de",
    level: "A2",
    topic: "慢速新闻",
    channelId: "UCxUWIEL-USsiPak0Qy6_vVg",
    channelTitle: "DW Deutsch lernen",
    title: "Deutsch lernen mit Videos | Kurz und leicht vom 16.11.2026 | mit deutschen Untertiteln",
    duration: "PT1M29S"
  },
  N6fhx78UgdQ: {
    language: "de",
    level: "A2",
    topic: "慢速新闻",
    channelId: "UCxUWIEL-USsiPak0Qy6_vVg",
    channelTitle: "DW Deutsch lernen",
    title: "Deutsch lernen mit Videos | Kurz und leicht vom 13.11.2026 | mit deutschen Untertiteln",
    duration: "PT1M33S"
  },
  kkrPQmYMsBw: {
    language: "de",
    level: "A2",
    topic: "慢速新闻",
    channelId: "UCxUWIEL-USsiPak0Qy6_vVg",
    channelTitle: "DW Deutsch lernen",
    title: "Deutsch lernen mit Videos | Kurz und leicht vom 12.11.2026 | mit deutschen Untertiteln",
    duration: "PT1M35S"
  },
  "reg-jjIDU-o": {
    language: "de",
    level: "A2",
    topic: "慢速新闻",
    channelId: "UCxUWIEL-USsiPak0Qy6_vVg",
    channelTitle: "DW Deutsch lernen",
    title: "Deutsch lernen mit Videos | Kurz und leicht vom 11.11.2026 | mit deutschen Untertiteln",
    duration: "PT1M27S"
  },
  CXtNmZXyRM4: {
    language: "de",
    level: "A2",
    topic: "常用辨析",
    channelId: "UCaeT58uDMlPpBlwAYaxN0LA",
    channelTitle: "Learn German Original",
    title: "\"etwas\" oder \"nichts\" | Teil 3 : Deutsch richtig sprechen | Häufige Fehler vermeiden | Learn German",
    duration: "PT1M20S"
  },
  zd9mxQOEzL4: {
    language: "de",
    level: "A2",
    topic: "常用辨析",
    channelId: "UCaeT58uDMlPpBlwAYaxN0LA",
    channelTitle: "Learn German Original",
    title: "\"mich\" oder \"mir\" | Teil 2: Kennst du diese deutschen Grammatikfehler? | Learn German",
    duration: "PT1M19S"
  },
  pfo_H3Y43cM: {
    language: "de",
    level: "A2",
    topic: "常用辨析",
    channelId: "UCaeT58uDMlPpBlwAYaxN0LA",
    channelTitle: "Learn German Original",
    title: "machen oder tun | Teil 1 : Sagst du das richtig? | Häufige Fehler im Deutschen | Learn German",
    duration: "PT1M26S"
  },
  MjkI0G_qbz0: {
    language: "de",
    level: "A2",
    topic: "街头短片",
    channelId: "UCbxb2fqe9oNgglAoYqsYOtQ",
    channelTitle: "Easy German",
    title: "Schwer zu verstehen 🤔",
    duration: "PT1M8S"
  },
  "-Uzw6fSTUGg": {
    language: "de",
    level: "B1",
    topic: "德国文化",
    channelId: "UCxUWIEL-USsiPak0Qy6_vVg",
    channelTitle: "DW Deutsch lernen",
    title: "Deutsch lernen mit Videos | Tafelspitz – ein Klassiker der Wiener Küche | mit deutschen Untertiteln",
    duration: "PT4M44S"
  },
  MN5GQvHMA5Y: {
    language: "de",
    level: "B1",
    topic: "街头采访",
    channelId: "UCbxb2fqe9oNgglAoYqsYOtQ",
    channelTitle: "Easy German",
    title: "Bregenz: Lake Life, Austrian Dialect & Local Food",
    duration: "PT15M29S"
  },

  // === 西语 (es) ===
  "5GoCkgdVqdo": { language: "es", level: "A1", topic: "发音入门" },
  L4NhZKk1MPk: { language: "es", level: "A1", topic: "慢速故事" },
  ArNLvtcjf30: { language: "es", level: "A2", topic: "学习心态" },
  "12bbekXC7Zo": { language: "es", level: "A2", topic: "历史地理" },
  "sh-K-uiJV8s": { language: "es", level: "B1", topic: "长对话播客" },

  // === 英语 (en) ===
  q4PkX8_xUYk: {
    language: "en",
    level: "A1",
    topic: "日常语法",
    channelId: "UCKyTokYo0nK2OA-az-sDijA",
    channelTitle: "VOA Learning English",
    title: "Everyday Grammar Video: Ramen, A Popular Food in Japan",
    duration: "PT1M10S"
  },
  lbdsHwea9yk: {
    language: "en",
    level: "A2",
    topic: "词汇百科",
    channelId: "UCHaHD477h-FeBbVh9Sh7syA",
    channelTitle: "BBC Learning English",
    title: "What causes tropical storms? Weather words",
    duration: "PT2M25S"
  },
  Z6pHAPhiQqM: {
    language: "en",
    level: "A2",
    topic: "轻松对话",
    channelId: "UCHaHD477h-FeBbVh9Sh7syA",
    channelTitle: "BBC Learning English",
    title: "Do you like to relax in the countryside? | Improve your listening with Real Easy English",
    duration: "PT7M17S"
  },
  YF2RL3D8IB4: {
    language: "en",
    level: "B1",
    topic: "生活场景",
    channelId: "UCxJGMJbjokfnr2-s4_RXPxQ",
    channelTitle: "Speak English With Vanessa",
    title: "Daily Life English with PICTURES",
    duration: "PT22M0S"
  },

  // === 法语 (fr) ===
  GP7NNcgK8H4: {
    language: "fr",
    level: "A1",
    topic: "慢速对话",
    channelId: "UCoUWq2QawqdC3-nRXKk-JUw",
    channelTitle: "Easy French",
    title: "How to Talk About What You Like in French (Slow French Conversation)",
    duration: "PT6M30S"
  },
  _lu1rDsf3oc: {
    language: "fr",
    level: "B1",
    topic: "时事讨论",
    channelId: "UCQpM25U6iqaRSO-SZxd5oDw",
    channelTitle: "Français Authentique",
    title: "Et si la France quittait l'Union européenne ? (Café Avec Johan 23)",
    duration: "PT12M0S"
  },
  kTSnYNClAao: {
    language: "fr",
    level: "A2",
    topic: "深度播客",
    channelId: "UCI4xp8qHD1MDErkqxb1dPbA",
    channelTitle: "innerFrench",
    title: "E199 Et si on se rencontrait ?",
    duration: "PT29M27S"
  },

  // === 日语 (ja) ===
  wItsg1V4g0s: {
    language: "ja",
    level: "A1",
    topic: "N5–N4 入门",
    channelId: "UCu6sZrHyl4hSS2PvlUo2XZA",
    channelTitle: "Japanese with Shun",
    title: "Do you know N4 but can't use it yet?🇯🇵",
    duration: "PT1M36S"
  },
  bEbs3sCwdFo: {
    language: "ja",
    level: "A2",
    topic: "学习建议",
    channelId: "UCu6sZrHyl4hSS2PvlUo2XZA",
    channelTitle: "Japanese with Shun",
    title: "Is N4 Enough to Speak Japanese? The Honest Answer",
    duration: "PT15M53S"
  },
  S4xz1Nrxgzw: {
    language: "ja",
    level: "A2",
    topic: "日本文化",
    channelId: "UCSbH_BPR_AoARW6RDYLlLog",
    channelTitle: "Speak Japanese Naturally",
    title: "Nostalgic Japan | Japanese Listening Practice",
    duration: "PT10M30S"
  },
  "6xJfcoEaf3k": {
    language: "ja",
    level: "B1",
    topic: "深度听力",
    channelId: "UCsQCbl3a9FtYvA55BxdzYiQ",
    channelTitle: "Miku Real Japanese",
    title: "Why We See What We Believe | Japanese Listening Practice",
    duration: "PT23M10S"
  }
};

export function parseIsoDurationSeconds(duration: string): number {
  const m = /^PT(?:(\d+)H)?(?:(\d+)M)?(?:(\d+)S)?$/.exec(duration ?? "");
  if (!m) return 0;
  return Number(m[1] ?? 0) * 3600 + Number(m[2] ?? 0) * 60 + Number(m[3] ?? 0);
}

function inferTopic(title: string, channelTag: string): string {
  const lower = title.toLowerCase();
  if (/podcast|播客/.test(lower)) return "长对话播客";
  if (/news|kurz und leicht|noticias|voa|report/.test(lower)) return "新闻听力";
  if (/food|küche|comida|drink|cook|ramen|tafelspitz/.test(lower)) return "饮食文化";
  if (/dialog|conversation|bistro|büro|talk|slow french|easy english/.test(lower)) return "情景对话";
  if (/beginner|anfänger|pronunciation|grammar|grammatik|n5|n4|a1/.test(lower)) return "入门讲解";
  return channelTag || "精选输入";
}

export function inferSingleVideoLevel(
  video: YouTubeVideoPayload,
  channelId: string,
  language: PoolLanguage
): { level: VideoLevel | null; levelSource?: "curated" | "inferred" } {
  const curated = CURATED_VIDEO_META[video.id];
  if (curated && curated.language === language) {
    return { level: curated.level, levelSource: "curated" };
  }

  const title = video.title ?? "";
  const durSec = parseIsoDurationSeconds(video.duration);

  if (/\bA1\b|\bN5\b|superbeginner|for beginners|principiante|anfänger|slow french|real easy/i.test(title)) {
    return { level: "A1", levelSource: "inferred" };
  }
  if (/\bA2\b|\bN4\b|kurz und leicht|a1-a2|everyday grammar/i.test(title)) {
    return { level: "A2", levelSource: "inferred" };
  }
  if (/\bB1\b|\bB2\b|\bC1\b|\bN3\b|\bN2\b|\bN1\b|advanced|avanzado/i.test(title)) {
    return { level: "B1", levelSource: "inferred" };
  }
  if (/intermediate|intermedio/i.test(title)) {
    return { level: durSec >= 1200 ? "B1" : "A2", levelSource: "inferred" };
  }

  if (language === "de") {
    if (durSec > 0 && durSec <= 55 && /learn german|sprachtipp/i.test(title)) {
      return { level: "A1", levelSource: "inferred" };
    }
    if (durSec >= 600) {
      return { level: "B1", levelSource: "inferred" };
    }
    return { level: null };
  }

  if (language === "en") {
    if (channelId === "UCKyTokYo0nK2OA-az-sDijA") {
      return { level: durSec >= 240 ? "A2" : "A1", levelSource: "inferred" };
    }
    if (channelId === "UCHaHD477h-FeBbVh9Sh7syA") {
      return { level: durSec >= 480 ? "B1" : durSec > 0 && durSec <= 120 ? "A1" : "A2", levelSource: "inferred" };
    }
    if (channelId === "UCxJGMJbjokfnr2-s4_RXPxQ") {
      return { level: durSec >= 720 ? "B1" : "A2", levelSource: "inferred" };
    }
    return { level: "A2", levelSource: "inferred" };
  }

  if (language === "fr") {
    if (channelId === "UCoUWq2QawqdC3-nRXKk-JUw") {
      return { level: /slow french/i.test(title) || (durSec > 0 && durSec <= 180) ? "A1" : "A2", levelSource: "inferred" };
    }
    if (channelId === "UCQpM25U6iqaRSO-SZxd5oDw") {
      return { level: durSec >= 600 ? "B1" : "A2", levelSource: "inferred" };
    }
    if (channelId === "UCI4xp8qHD1MDErkqxb1dPbA") {
      return { level: durSec >= 1800 ? "B1" : "A2", levelSource: "inferred" };
    }
    return { level: "A2", levelSource: "inferred" };
  }

  if (language === "ja") {
    if (channelId === "UCu6sZrHyl4hSS2PvlUo2XZA") {
      return { level: durSec > 0 && durSec <= 180 ? "A1" : "A2", levelSource: "inferred" };
    }
    if (channelId === "UCSbH_BPR_AoARW6RDYLlLog") {
      return { level: durSec >= 900 ? "B1" : "A2", levelSource: "inferred" };
    }
    if (channelId === "UCsQCbl3a9FtYvA55BxdzYiQ") {
      return { level: durSec >= 1200 ? "B1" : "A2", levelSource: "inferred" };
    }
    return { level: "A2", levelSource: "inferred" };
  }

  // 西语频道若仅有频道信息但缺乏单条标题或字幕依据，先不硬标难度（level = null）
  if (channelId === "UCouyFdE9-Lrjo3M_2idKq1A") {
    if (durSec >= 1200 || /podcast/i.test(title)) return { level: "B1", levelSource: "inferred" };
    return { level: null };
  }
  if (channelId === "UCAL4AMMMXKxHDu3FqZV6CbQ") {
    if (durSec > 0 && durSec <= 480 && /guide|beginner|phrase|slow/i.test(title)) {
      return { level: "A1", levelSource: "inferred" };
    }
    return { level: null };
  }

  return { level: null };
}

function rotateArray<T>(list: T[], offset: number): T[] {
  if (list.length <= 1) return [...list];
  const shift = ((offset % list.length) + list.length) % list.length;
  if (shift === 0) return [...list];
  return [...list.slice(shift), ...list.slice(0, shift)];
}

/**
 * 跨频道混排：先按频道分别做稳定偏移，再交替抽取（兼顾不同频道来源与题材穿插）。
 */
export function mixVideosCrossChannel(
  videosByChannel: Array<{ channel: ChannelSourceInfo; videos: TaggedVideoItem[] }>,
  seed: number
): TaggedVideoItem[] {
  const nonEmpty = videosByChannel.filter((entry) => entry.videos.length > 0);
  if (nonEmpty.length === 0) return [];

  const rotatedChannels = rotateArray(nonEmpty, seed);
  const queues = rotatedChannels.map((entry, idx) =>
    rotateArray(entry.videos, Math.floor(seed / Math.max(1, rotatedChannels.length)) + idx)
  );

  const mixed: TaggedVideoItem[] = [];
  const seen = new Set<string>();
  const cursors = queues.map(() => 0);

  let remaining = true;
  while (remaining) {
    remaining = false;
    for (let c = 0; c < queues.length; c += 1) {
      const q = queues[c];
      while (cursors[c] < q.length && seen.has(q[cursors[c]].id)) {
        cursors[c] += 1;
      }
      if (cursors[c] < q.length) {
        const picked = q[cursors[c]];
        cursors[c] += 1;
        seen.add(picked.id);
        mixed.push(picked);
        remaining = true;
      }
    }
  }

  return mixed;
}

const NEARBY_ORDER: Record<VideoLevel, VideoLevel[]> = {
  A1: ["A2", "B1"],
  A2: ["A1", "B1"],
  B1: ["A2", "A1"]
};

const ALL_LEVELS: VideoLevel[] = ["A1", "A2", "B1"];

export function defaultSessionSeed(nowMs = Date.now()): number {
  return Math.floor(nowMs / (1000 * 60 * 60));
}

/**
 * 控制首页前段推荐批（默认前 24 条）中单一频道的最大占比，防止某一高产频道刷屏。
 */
export function enforceChannelWindowCap(
  items: TaggedVideoItem[],
  windowSize = 24,
  maxShareRatio = 0.3
): TaggedVideoItem[] {
  if (items.length <= 4) return items;
  const distinctChannels = new Set(items.map((item) => item.channelId)).size;
  if (distinctChannels < 3) return items;

  const capPerChannel = Math.max(4, Math.ceil(windowSize * maxShareRatio));
  const top: TaggedVideoItem[] = [];
  const deferred: TaggedVideoItem[] = [];
  const counts = new Map<string, number>();

  for (const item of items) {
    if (top.length >= windowSize) {
      deferred.push(item);
      continue;
    }
    const used = counts.get(item.channelId) ?? 0;
    if (used < capPerChannel) {
      top.push(item);
      counts.set(item.channelId, used + 1);
    } else {
      deferred.push(item);
    }
  }

  return [...top, ...deferred];
}

export function buildVideoFeedPayload(input: {
  language: PoolLanguage;
  channels: ChannelSourceInfo[];
  rawByChannel: Array<{ channelId: string; videos: CatalogRawVideoInput[] }>;
  level?: string | null;
  channelId?: string | null;
  seed?: number | null;
  viewedVideoIds?: Set<string> | string[];
  skipCuratedFallback?: boolean;
}): VideoFeedResponsePayload {
  const { language, channels } = input;
  const seed =
    typeof input.seed === "number" && Number.isFinite(input.seed)
      ? Math.max(0, Math.floor(input.seed))
      : defaultSessionSeed();
  const viewedSet =
    input.viewedVideoIds instanceof Set
      ? input.viewedVideoIds
      : new Set(input.viewedVideoIds ?? []);

  const channelMap = new Map(channels.map((ch) => [ch.id, ch]));
  const taggedByChannel = channels.map((ch) => {
    const rawList = input.rawByChannel.find((r) => r.channelId === ch.id)?.videos ?? [];
    const seenIds = new Set<string>();
    const mergedRaw: CatalogRawVideoInput[] = [...rawList];

    // 补充各语种手选带字幕示范视频（若未包含在最新拉取中；开启共享库精准池时可跳过以免混入未核验条目）
    if (!input.skipCuratedFallback) {
      for (const [vid, meta] of Object.entries(CURATED_VIDEO_META)) {
        if (meta.language === language && meta.channelId === ch.id && meta.title) {
          if (!mergedRaw.some((v) => v.id === vid)) {
            mergedRaw.push({
              id: vid,
              title: meta.title,
              thumbnail: `https://i.ytimg.com/vi/${vid}/hqdefault.jpg`,
              duration: meta.duration ?? "",
              channelId: ch.id,
              channelTitle: meta.channelTitle ?? ch.title,
              publishedAt: meta.publishedAt ?? ""
            });
          }
        }
      }
    }

    const tagged: TaggedVideoItem[] = [];
    for (const raw of mergedRaw) {
      if (!raw.id || seenIds.has(raw.id)) continue;
      seenIds.add(raw.id);
      const curatedMeta = CURATED_VIDEO_META[raw.id];
      const hasExplicitCatalogLevel = Object.prototype.hasOwnProperty.call(raw, "level");
      const resolvedLevel = hasExplicitCatalogLevel
        ? { level: raw.level ?? null, levelSource: raw.levelSource }
        : inferSingleVideoLevel(raw, ch.id, language);
      const topic = raw.topic ?? curatedMeta?.topic ?? inferTopic(raw.title, ch.tag);
      tagged.push({
        ...raw,
        channelId: ch.id,
        channelTitle: raw.channelTitle || ch.title,
        language,
        level: resolvedLevel.level,
        levelSource: resolvedLevel.levelSource,
        topic,
        isViewed: viewedSet.has(raw.id)
      });
    }

    return { channel: ch, videos: tagged };
  });

  const normalizedChannelId =
    input.channelId && channelMap.has(input.channelId) ? input.channelId : null;

  const mixWithUnseenPriority = (
    groups: Array<{ channel: ChannelSourceInfo; videos: TaggedVideoItem[] }>
  ) => {
    const unseenGroups = groups.map((g) => ({
      channel: g.channel,
      videos: g.videos.filter((v) => !v.isViewed)
    }));
    const seenGroups = groups.map((g) => ({
      channel: g.channel,
      videos: g.videos.filter((v) => Boolean(v.isViewed))
    }));
    const mixedUnseen = enforceChannelWindowCap(mixVideosCrossChannel(unseenGroups, seed));
    const mixedSeen = enforceChannelWindowCap(mixVideosCrossChannel(seenGroups, seed));
    return [...mixedUnseen, ...mixedSeen];
  };

  const poolAll = normalizedChannelId
    ? (() => {
        const list =
          taggedByChannel.find((entry) => entry.channel.id === normalizedChannelId)?.videos ?? [];
        const unseen = list.filter((v) => !v.isViewed);
        const seen = list.filter((v) => Boolean(v.isViewed));
        return [...unseen, ...seen];
      })()
    : mixWithUnseenPriority(taggedByChannel);

  const countsByLevel: Record<VideoLevel, number> = { A1: 0, A2: 0, B1: 0 };
  for (const item of poolAll) {
    if (item.level) countsByLevel[item.level] += 1;
  }

  const minLevelThreshold = language === "de" ? 3 : 1;
  const availableLevels = ALL_LEVELS.filter((lvl) => countsByLevel[lvl] >= minLevelThreshold);

  const rawLevel = (input.level ?? "all").trim().toUpperCase();
  const targetLevel: VideoLevel | null =
    rawLevel === "A1" || rawLevel === "A2" || rawLevel === "B1" ? rawLevel : null;

  const videos = targetLevel
    ? poolAll.filter((item) => item.level === targetLevel)
    : poolAll;

  let isSparse = false;
  let nearbyLevel: VideoLevel | null = null;
  let nearbyVideos: TaggedVideoItem[] = [];

  if (targetLevel && videos.length < 4) {
    isSparse = true;
    const shownIds = new Set(videos.map((v) => v.id));
    for (const candidateLevel of NEARBY_ORDER[targetLevel]) {
      const candidates = poolAll.filter(
        (item) => item.level === candidateLevel && !shownIds.has(item.id)
      );
      if (candidates.length > 0) {
        nearbyLevel = candidateLevel;
        nearbyVideos = candidates.slice(0, 6);
        break;
      }
    }
  }

  return {
    language,
    seed,
    level: targetLevel ?? "all",
    channelId: normalizedChannelId,
    channels,
    availableLevels,
    countsByLevel,
    totalCount: poolAll.length,
    videos,
    isSparse,
    nearbyLevel,
    nearbyVideos
  };
}
