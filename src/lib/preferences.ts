// Timestamp: 2026-11-14 20:26
import AsyncStorage from "@react-native-async-storage/async-storage";

/**
 * 本地偏好设置。
 *
 * 这些是"设备偏好"不是"账号数据",所以放在 AsyncStorage 而不是服务端:
 * 换手机重新选一次即可,也没必要为它加一张表。
 *
 * 读取策略:内存缓存 + 首次异步加载。界面先用默认值渲染,加载完成后
 * 触发一次重渲染,避免每个页面都要 await 才能显示。
 */

const KEY = "esponal.preferences.v1";

export type SpeechAccent = "es-ES" | "es-MX" | "es-AR";

export type Preferences = {
  /** 朗读用哪种口音(西语各地差异主要在 z/c 的咬舌音和语调) */
  accent: SpeechAccent;
  /** 朗读语速:0.7 慢 / 0.85 标准 / 1.0 快 */
  rate: number;
  /** 阅读页朗读完一段自动读下一段 */
  autoNextParagraph: boolean;
  /** 复习时换到新卡片自动念一遍单词 */
  autoSpeakReview: boolean;
};

export const DEFAULT_PREFERENCES: Preferences = {
  accent: "es-ES",
  rate: 0.85,
  // 点「朗读」本来就该一段接一段念下去,默认开;不想要连续的人自己去设置页关
  autoNextParagraph: true,
  // 复习卡自动发音比较打扰,默认关
  autoSpeakReview: false
};

export const ACCENT_OPTIONS: Array<{ value: SpeechAccent; label: string; hint: string }> = [
  { value: "es-ES", label: "西班牙", hint: " castellano,distinción:z/c 咬舌" },
  { value: "es-MX", label: "墨西哥", hint: "拉美主流,seseo:z/c 读 s" },
  { value: "es-AR", label: "阿根廷", hint: "rioplatense,ll/y 读 sh" }
];

export const RATE_OPTIONS: Array<{ value: number; label: string }> = [
  { value: 0.7, label: "慢" },
  { value: 0.85, label: "标准" },
  { value: 1, label: "快" }
];

let cache: Preferences = DEFAULT_PREFERENCES;
let loaded = false;
const listeners = new Set<(p: Preferences) => void>();

function normalize(raw: unknown): Preferences {
  const value = (raw ?? {}) as Partial<Preferences>;
  const accent = ACCENT_OPTIONS.some((o) => o.value === value.accent)
    ? (value.accent as SpeechAccent)
    : DEFAULT_PREFERENCES.accent;
  const rate =
    typeof value.rate === "number" && value.rate >= 0.5 && value.rate <= 1.2
      ? value.rate
      : DEFAULT_PREFERENCES.rate;

  return {
    accent,
    rate,
    // 只有明确存过 false 才关(老版本存档里没这个字段 → 保持"开")
    autoNextParagraph: value.autoNextParagraph !== false,
    autoSpeakReview: value.autoSpeakReview === true
  };
}

export async function loadPreferences(): Promise<Preferences> {
  if (loaded) return cache;
  try {
    const raw = await AsyncStorage.getItem(KEY);
    cache = raw ? normalize(JSON.parse(raw)) : DEFAULT_PREFERENCES;
  } catch {
    cache = DEFAULT_PREFERENCES;
  }
  loaded = true;
  return cache;
}

export function getPreferences(): Preferences {
  return cache;
}

/** 订阅偏好变化(设置页改完,阅读页/复习页立刻生效,不需要重启) */
export function subscribePreferences(listener: (p: Preferences) => void) {
  listeners.add(listener);
  return () => listeners.delete(listener);
}

export async function updatePreferences(patch: Partial<Preferences>): Promise<Preferences> {
  cache = normalize({ ...cache, ...patch });
  loaded = true;
  listeners.forEach((listener) => listener(cache));
  try {
    await AsyncStorage.setItem(KEY, JSON.stringify(cache));
  } catch {
    // 存不下不影响本次会话
  }
  return cache;
}

export async function resetPreferences(): Promise<Preferences> {
  return updatePreferences(DEFAULT_PREFERENCES);
}
