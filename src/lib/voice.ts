// Timestamp: 2026-11-14 22:35
import * as Speech from "expo-speech";

/**
 * 设备语音（TTS 音色）探测。
 *
 * 关键事实：`Speech.speak(text, { language: "es-ES" })` 在**没装西语音色**的设备上不会报错，
 * Android 会退回默认音色（多为 en-US）继续念——结果就是西语单词被用英语发音读出来。
 * 这个静默降级是「单词音频全是英语」这类问题最隐蔽的来源，所以这里做三件事：
 *   1. 枚举设备上真实存在的音色
 *   2. 按语言挑一个明确匹配的（能精确匹配就精确匹配，其次同语族）
 *   3. 匹配不到时让调用方能拿到这个事实，去给用户一句人话提示
 */

export type DeviceVoice = {
  /** 传给 Speech.speak 的 voice 参数 */
  id: string;
  name: string;
  /** 归一成 BCP-47，Android 常给出 es_ES 这种下划线形式 */
  lang: string;
  quality: string;
};

let cache: DeviceVoice[] | null = null;
let inflight: Promise<DeviceVoice[]> | null = null;

function normalizeTag(tag: string) {
  return (tag ?? "").replace(/_/g, "-");
}

/**
 * 三字母(ISO 639-2) → 两字母(639-1)。
 * Android 上不少 TTS 引擎把语言报成 spa-ESP / eng-GBR 这种形式，
 * 不归一的话会被当成"设备没装西语音色"，然后误报一个假警告。
 */
const ISO3_TO_ISO1: Record<string, string> = {
  spa: "es",
  eng: "en",
  fra: "fr",
  fre: "fr",
  jpn: "ja",
  zho: "zh",
  chi: "zh",
  cmn: "zh",
  deu: "de",
  ger: "de",
  por: "pt",
  ita: "it",
  rus: "ru",
  kor: "ko",
  ara: "ar"
};

export function voiceBase(lang: string) {
  const raw = normalizeTag(lang).split("-")[0].toLowerCase();
  return ISO3_TO_ISO1[raw] ?? raw;
}

export async function loadDeviceVoices(force = false): Promise<DeviceVoice[]> {
  if (cache && !force) return cache;
  if (inflight && !force) return inflight;

  inflight = Speech.getAvailableVoicesAsync()
    .then((voices) => {
      cache = (voices ?? []).map((voice) => ({
        id: voice.identifier,
        name: voice.name,
        lang: normalizeTag(voice.language),
        quality: String(voice.quality ?? "Default")
      }));
      return cache;
    })
    .catch(() => {
      // 拿不到不等于没有，但只能当作"未知"处理
      cache = [];
      return cache;
    })
    .finally(() => {
      inflight = null;
    });

  return inflight;
}

export function peekDeviceVoices(): DeviceVoice[] {
  return cache ?? [];
}

export function voicesFor(lang: string): DeviceVoice[] {
  const base = voiceBase(lang);
  return peekDeviceVoices().filter((voice) => voiceBase(voice.lang) === base);
}

/** 精确匹配 → 同语族（优先与想要的地区同区）→ 该语言任意音色 → null */
export function findVoiceFor(lang: string): DeviceVoice | null {
  const target = normalizeTag(lang);
  const all = peekDeviceVoices();
  if (all.length === 0) return null;

  const exact = all.find((voice) => voice.lang.toLowerCase() === target.toLowerCase());
  if (exact) return exact;

  const sameBase = all.filter((voice) => voiceBase(voice.lang) === voiceBase(target));
  if (sameBase.length === 0) return null;

  // 语音质量 Enhanced 优先（iOS 上 Enhanced 明显更自然）
  const enhanced = sameBase.find((voice) => voice.quality.toLowerCase().includes("enhanced"));
  return enhanced ?? sameBase[0];
}

export type VoiceCoverage = {
  /** 想要的语族，如 es */
  base: string;
  /** 实际匹配到的音色，null 表示设备上没有这门语言 */
  matched: DeviceVoice | null;
  /** 该语族下所有可用音色 */
  installed: DeviceVoice[];
};

export function describeVoiceCoverage(lang: string): VoiceCoverage {
  const base = voiceBase(lang);
  const installed = voicesFor(lang);
  return { base, matched: findVoiceFor(lang), installed };
}
