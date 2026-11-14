// Timestamp: 2026-11-14 21:45
import AsyncStorage from "@react-native-async-storage/async-storage";

/**
 * 听力精听的本地进度。
 *
 * 记录粒度是「某一篇的某一段」——因为精听的最小单位就是一段 30 秒素材，
 * 记录整篇意义不大（一篇里可能第三段听懂了、第五段全崩）。
 *
 * 自评不是分数，而是**听懂率区间**：按 70–90% 是最佳训练区的经验标尺，
 * 落在区间里的材料才值得反复精听，太高说明太简单、太低说明该换材料。
 *
 * 错因分三类，是照着「听力慢半步」的具体成因分的：
 *   sound  没听出音（连读、吞音、语速）→ 要练影子跟读
 *   vocab  词不认识 → 要去补词库
 *   speed  认识但没反应过来 → 要练听辨速度，不是背新词
 * 三类混在一起统计是没用的，所以宁可选三个 chip 也不给一个「难」字打发了。
 */

const KEY = "esponal.listening.v1";

export type ListenRatio = "full" | "high" | "half" | "low";
export type ListenCause = "sound" | "vocab" | "speed";

export type ParagraphLog = {
  ratio: ListenRatio;
  causes: ListenCause[];
  /** 揭晓前听了几遍（精听时"听了 1 遍就懂"和"听了 5 遍"差别很大） */
  plays: number;
  at: string;
};

export type StoryLog = {
  slug: string;
  paragraphs: Record<string, ParagraphLog>;
  updatedAt: string;
};

export type StorySummary = {
  /** 已练过的段数 */
  trained: number;
  /** 平均听懂率 0-100，未练过为 null */
  average: number | null;
  /** 出现次数最多的错因，未标记为 null */
  topCause: ListenCause | null;
};

type Store = Record<string, StoryLog>;

export const RATIO_OPTIONS: Array<{
  value: ListenRatio;
  label: string;
  hint: string;
  /** 折算成 0-1，只用于算平均，不作为"成绩"展示 */
  score: number;
}> = [
  { value: "full", label: "全听懂了", hint: "材料偏简单,可以换难一档", score: 1 },
  { value: "high", label: "七到九成", hint: "最佳训练区,保持", score: 0.85 },
  { value: "half", label: "一半左右", hint: "偏难,先降速再听", score: 0.5 },
  { value: "low", label: "基本没听出", hint: "换更简单的材料", score: 0.2 }
];

export const CAUSE_OPTIONS: Array<{
  value: ListenCause;
  label: string;
  hint: string;
  advice: string;
}> = [
  {
    value: "sound",
    label: "没听出音",
    hint: "连读 / 吞音 / 语速",
    advice: "影子跟读:对着原文跟读 3 遍,专门咬连读处"
  },
  {
    value: "vocab",
    label: "词不认识",
    hint: "词库缺口",
    advice: "去词库补词,新词存音频版,按「听音→辨义」记"
  },
  {
    value: "speed",
    label: "认识但没反应",
    hint: "听辨速度不够",
    advice: "别背新词,用 0.75x 重听同一段,再回原速"
  }
];

let cache: Store = {};
let loaded = false;

function summarizeLog(log: StoryLog | undefined, paragraphCount: number): StorySummary {
  if (!log) return { trained: 0, average: null, topCause: null };

  const logs = Object.entries(log.paragraphs)
    .filter(([index]) => Number(index) < paragraphCount)
    .map(([, entry]) => entry);

  if (logs.length === 0) return { trained: 0, average: null, topCause: null };

  const total = logs.reduce((sum, entry) => {
    const option = RATIO_OPTIONS.find((item) => item.value === entry.ratio);
    return sum + (option?.score ?? 0);
  }, 0);

  const causeCount: Record<string, number> = {};
  logs.forEach((entry) => {
    entry.causes.forEach((cause) => {
      causeCount[cause] = (causeCount[cause] ?? 0) + 1;
    });
  });
  const topCause =
    (Object.entries(causeCount).sort((a, b) => b[1] - a[1])[0]?.[0] as ListenCause | undefined) ??
    null;

  return {
    trained: logs.length,
    average: Math.round((total / logs.length) * 100),
    topCause
  };
}

export async function loadListeningLog(): Promise<Store> {
  if (loaded) return cache;
  try {
    const raw = await AsyncStorage.getItem(KEY);
    cache = raw ? (JSON.parse(raw) as Store) : {};
  } catch {
    cache = {};
  }
  loaded = true;
  return cache;
}

/** 同步读（页面首帧用，读到的是已加载的缓存，没加载完就是空） */
export function getListeningLog(): Store {
  return cache;
}

export function getStoryLog(slug: string): StoryLog | undefined {
  return cache[slug];
}

export function getStorySummary(slug: string, paragraphCount: number): StorySummary {
  return summarizeLog(cache[slug], paragraphCount);
}

export function getParagraphLog(slug: string, index: number): ParagraphLog | undefined {
  return cache[slug]?.paragraphs[String(index)];
}

export async function saveParagraphLog(
  slug: string,
  index: number,
  log: ParagraphLog
): Promise<Store> {
  const previous = cache[slug];
  const next: StoryLog = {
    slug,
    paragraphs: {
      ...(previous?.paragraphs ?? {}),
      [String(index)]: log
    },
    updatedAt: new Date().toISOString()
  };

  cache = { ...cache, [slug]: next };

  try {
    await AsyncStorage.setItem(KEY, JSON.stringify(cache));
  } catch {
    // 存不下不影响本次练习
  }

  return cache;
}

export async function clearStoryLog(slug: string): Promise<void> {
  const { [slug]: _removed, ...rest } = cache;
  cache = rest;
  try {
    await AsyncStorage.setItem(KEY, JSON.stringify(cache));
  } catch {
    // ignore
  }
}
