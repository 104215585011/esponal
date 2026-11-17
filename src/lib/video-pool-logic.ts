// Timestamp: 2026-11-17 16:16
import type { VideoLevel, YouTubeVideoPayload } from "./youtube-shared";

export type PoolLanguage = "es" | "de";

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
  // === 德语首批已验真有原文字幕的视频池（跨三个精选频道） ===
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

  // === 西语单条覆盖（说明同频道下存在跨难度单条视频） ===
  "5GoCkgdVqdo": {
    language: "es",
    level: "A1",
    topic: "发音入门"
  },
  L4NhZKk1MPk: {
    language: "es",
    level: "A1",
    topic: "慢速故事"
  },
  ArNLvtcjf30: {
    language: "es",
    level: "A2",
    topic: "学习心态"
  },
  "12bbekXC7Zo": {
    language: "es",
    level: "A2",
    topic: "历史地理"
  },
  "sh-K-uiJV8s": {
    language: "es",
    level: "B1",
    topic: "长对话播客"
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
  if (/news|kurz und leicht|noticias/.test(lower)) return "慢速新闻";
  if (/food|küche|comida|drink|cook|eat|tafelspitz/.test(lower)) return "饮食文化";
  if (/dialog|conversation|bistro|büro|talk/.test(lower)) return "情景对话";
  if (/beginner|anfänger|pronunciation|grammatik|fehler|richtig/.test(lower)) return "入门讲解";
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

  if (/\bA1\b|superbeginner|for beginners|principiante|anfänger/i.test(title)) {
    return { level: "A1", levelSource: "inferred" };
  }
  if (/\bA2\b|kurz und leicht|a1-a2/i.test(title)) {
    return { level: "A2", levelSource: "inferred" };
  }
  if (/\bB1\b|\bB2\b|\bC1\b|advanced|avanzado/i.test(title)) {
    return { level: "B1", levelSource: "inferred" };
  }
  if (/intermediate|intermedio/i.test(title)) {
    return { level: durSec >= 1200 ? "B1" : "A2", levelSource: "inferred" };
  }

  if (language === "de") {
    // 德语首版只给有把握的视频标难度；无法把握的留空归入「全部 / 德语精选」
    if (durSec > 0 && durSec <= 55 && /learn german|sprachtipp/i.test(title)) {
      return { level: "A1", levelSource: "inferred" };
    }
    if (durSec >= 600) {
      return { level: "B1", levelSource: "inferred" };
    }
    return { level: null };
  }

  // 西语频道（Dreaming Spanish / Spanish Okay / Easy Spanish）按片长与标题信号给单条视频打级
  if (channelId === "UCouyFdE9-Lrjo3M_2idKq1A") {
    if (durSec >= 1200 || /podcast/i.test(title)) return { level: "B1", levelSource: "inferred" };
    if (durSec >= 300) return { level: "A2", levelSource: "inferred" };
    return { level: "A1", levelSource: "inferred" };
  }
  if (channelId === "UCW1FQuVy10_biDAxAj1iTEQ") {
    return { level: durSec > 0 && durSec <= 60 ? "A1" : "A2", levelSource: "inferred" };
  }
  if (channelId === "UCAL4AMMMXKxHDu3FqZV6CbQ") {
    if (durSec > 0 && durSec <= 480 && /guide|beginner|phrase/i.test(title)) {
      return { level: "A1", levelSource: "inferred" };
    }
    return { level: durSec >= 480 ? "B1" : "A2", levelSource: "inferred" };
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
  // 默认按小时分桶：同一次浏览（60 分钟内）切进视频再回来保持同一批顺序，主动刷新传新 seed 才轮换
  return Math.floor(nowMs / (1000 * 60 * 60));
}

export function buildVideoFeedPayload(input: {
  language: PoolLanguage;
  channels: ChannelSourceInfo[];
  rawByChannel: Array<{ channelId: string; videos: YouTubeVideoPayload[] }>;
  level?: string | null;
  channelId?: string | null;
  seed?: number | null;
}): VideoFeedResponsePayload {
  const { language, channels } = input;
  const seed =
    typeof input.seed === "number" && Number.isFinite(input.seed)
      ? Math.max(0, Math.floor(input.seed))
      : defaultSessionSeed();

  const channelMap = new Map(channels.map((ch) => [ch.id, ch]));
  const taggedByChannel = channels.map((ch) => {
    const rawList = input.rawByChannel.find((r) => r.channelId === ch.id)?.videos ?? [];
    const seenIds = new Set<string>();
    const mergedRaw = [...rawList];

    // 把经过核验的核心单条精选（尤其德语跨级别示范视频）补入对应频道源，确保即使超出最新 12 条也能筛选到
    if (language === "de") {
      for (const [vid, meta] of Object.entries(CURATED_VIDEO_META)) {
        if (meta.language === "de" && meta.channelId === ch.id && meta.title) {
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
      const inferred = inferSingleVideoLevel(raw, ch.id, language);
      const topic = curatedMeta?.topic ?? inferTopic(raw.title, ch.tag);
      tagged.push({
        ...raw,
        channelId: ch.id,
        channelTitle: raw.channelTitle || ch.title,
        language,
        level: inferred.level,
        levelSource: inferred.levelSource,
        topic
      });
    }

    return { channel: ch, videos: tagged };
  });

  const normalizedChannelId =
    input.channelId && channelMap.has(input.channelId) ? input.channelId : null;

  const poolAll = normalizedChannelId
    ? taggedByChannel.find((entry) => entry.channel.id === normalizedChannelId)?.videos ?? []
    : mixVideosCrossChannel(taggedByChannel, seed);

  const countsByLevel: Record<VideoLevel, number> = { A1: 0, A2: 0, B1: 0 };
  for (const item of poolAll) {
    if (item.level) countsByLevel[item.level] += 1;
  }

  // 德语首版：仅当某个级别达到门槛 (>= 3 条) 时开放独立筛选入口，否则先看「德语精选 / 全部」
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
