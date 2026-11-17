// Timestamp: 2026-11-15 14:25
import * as Speech from "expo-speech";
import { createAudioPlayer, type AudioPlayer } from "expo-audio";

import { API_BASE } from "@/api/client";
import { getPreferences, type SpeechAccent } from "@/lib/preferences";
import { resolveLang } from "@/lib/langDetect";
import {
  describeVoiceCoverage,
  findVoiceFor,
  loadDeviceVoices,
  peekDeviceVoices,
  voiceBase
} from "@/lib/voice";

/**
 * 朗读统一入口。
 *
 * 这里做三件事，顺序不能换：
 *   1. **识别语言**：西语学习界面里也可能出现英语词（查词查到 the、角色对话里 Emma 说英文），
 *      靠文本判断比靠"当前在哪个页面"更准。识别不出来再退回调用方给的 fallback。
 *   2. **选具体音色**：只给 language 不够。设备没装西语音色时 Android 会静默退回默认音色，
 *      于是西语被英语发音念出来，而且完全不报错。能找到明确匹配的音色就把它传进去。
 *   3. **找不到就明说**：不再假装念对了。记一条警告给设置页展示，并在本次会话里提示一次。
 */

export type SpeakOptions = {
  /** 覆盖口音（西语专用：es-ES / es-MX / es-AR） */
  accent?: SpeechAccent;
  /** 覆盖语速 */
  rate?: number;
  /** 不改全局队列,直接把这段插到前面 */
  interrupt?: boolean;
  /** 强制指定语言,跳过识别 */
  lang?: string;
  /** 识别不出时的兜底语言（默认取偏好的口音） */
  fallbackLang?: string;
};

export type VoiceWarning = {
  /** 实际使用的语言标签 */
  lang: string;
  /** 语族，如 es */
  base: string;
  /** 设备上该语族的音色数量（0 表示没装） */
  installed: number;
};

let warning: VoiceWarning | null = null;
let alertedThisSession = false;
const warningListeners = new Set<(value: VoiceWarning | null) => void>();

export function getVoiceWarning(): VoiceWarning | null {
  return warning;
}

export function subscribeVoiceWarning(listener: (value: VoiceWarning | null) => void) {
  warningListeners.add(listener);
  listener(warning);
  return () => {
    warningListeners.delete(listener);
  };
}

function pushWarning(next: VoiceWarning | null) {
  warning = next;
  warningListeners.forEach((listener) => listener(next));
}

/**
 * 服务端兜底:设备没装西语音色时,改播服务端合成的西语音频。
 *
 * 为什么不干脆让系统用默认音色念:那样念出来是英语发音,而用户听到的只是"发音不对",
 * 完全不知道发生了什么。宁可多一次网络请求,也要让耳朵收到正确的音。
 * 服务端 `/api/tts` 限 200 字符,单词/短句够用;长句仍然走设备朗读。
 */
// Timestamp: 2026-11-17 15:18
const SERVER_TTS_MAX_LEN = 180;
const SERVER_TTS_LANGS = new Set(["es", "de", "en", "fr", "ja"]);
let remotePlayer: AudioPlayer | null = null;

function speakViaServer(text: string, rate: number, lang: string): boolean {
  if (text.length > SERVER_TTS_MAX_LEN) return false;
  const base = voiceBase(lang);
  if (!SERVER_TTS_LANGS.has(base)) return false;

  try {
    if (!remotePlayer) remotePlayer = createAudioPlayer();
    remotePlayer.replace({
      uri: `${API_BASE}/api/tts?text=${encodeURIComponent(text)}&lang=${encodeURIComponent(base)}`
    });
    remotePlayer.setPlaybackRate(rate, "medium");
    remotePlayer.play();
    return true;
  } catch {
    return false;
  }
}

/** 仅更新状态栏提示：联网时直接无缝走服务端高清音频，不再弹打扰用户的系统语音包下载弹窗 */
function warnMissingVoice(lang: string, usingServerAudio: boolean) {
  const base = voiceBase(lang);
  const installed = describeVoiceCoverage(lang).installed.length;
  pushWarning({ lang, base, installed });
  void usingServerAudio;
  void alertedThisSession;
  alertedThisSession = true;
}

/**
 * 按文本自动选语言朗读。所有朗读最终都走这里。
 */
export function speakAuto(text: string, options: SpeakOptions = {}) {
  const content = text?.trim();
  if (!content) return;

  const prefs = getPreferences();
  const detected = options.lang ?? resolveLang(content, options.fallbackLang ?? prefs.accent);

  // 识别只决定"哪门语言";西语的地区口音始终跟设置走
  const targetLang = voiceBase(detected) === "es" ? (options.accent ?? prefs.accent) : detected;

  const voicesKnown = peekDeviceVoices().length > 0;
  const voice = findVoiceFor(targetLang);

  // 单句朗读场景几乎都是"点了就想马上听",默认打断上一条
  if (options.interrupt !== false) {
    Speech.stop();
    try {
      remotePlayer?.pause();
    } catch {
      // 播放器还没创建或已释放
    }
  }

  if (!voice) {
    // 手机本机缺该语言离线音色时，直接走服务端高清音频（支持 es/en/fr/ja），无需让用户下载语音包
    const usedServer = speakViaServer(content, options.rate ?? prefs.rate, targetLang);
    if (voicesKnown) {
      warnMissingVoice(targetLang, usedServer);
    }
    if (usedServer) return;
  } else if (warning?.base === voiceBase(targetLang)) {
    pushWarning(null);
  }

  try {
    Speech.speak(content, {
      language: targetLang,
      rate: options.rate ?? prefs.rate,
      // 明确指定音色,避免系统在 language 缺数据时静默换音
      ...(voice ? { voice: voice.id } : {})
    });
  } catch {
    // 某些引擎在语言缺失时会直接抛错,不应该让朗读把页面带崩
  }
}

/** 西语场景的语义化入口（识别不出时按西语处理） */
export function speakSpanish(text: string, options: SpeakOptions = {}) {
  speakAuto(text, { fallbackLang: "es", ...options });
}

export function stopSpeaking() {
  Speech.stop();
  try {
    remotePlayer?.pause();
  } catch {
    // ignore
  }
}

/** 提前加载音色表,让设置页和首次朗读都能立刻判断"有没有装西语音色" */
export async function preloadVoices() {
  await loadDeviceVoices();
  return peekDeviceVoices().length;
}

/** 设置页用的诊断信息 */
export function speechStatus(lang: string) {
  const coverage = describeVoiceCoverage(lang);
  const known = peekDeviceVoices().length > 0;
  return {
    known,
    lang,
    base: coverage.base,
    installedCount: coverage.installed.length,
    installedNames: coverage.installed.map((voice) => voice.name),
    matched: coverage.matched
  };
}

/** 当前生效的朗读配置,设置页用来展示"现在是什么口音" */
export function describeSpeech(prefs: { accent: SpeechAccent; rate: number }) {
  return `${prefs.accent} · ${prefs.rate.toFixed(2)}x`;
}
