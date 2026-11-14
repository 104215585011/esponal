// Timestamp: 2026-11-14 20:28
import * as Speech from "expo-speech";

import { getPreferences, type SpeechAccent } from "@/lib/preferences";

/**
 * 西语朗读入口。
 *
 * 之前 5 个页面各自写 `Speech.speak(text, { language: "es-ES", rate: 0.85 })`,
 * 用户在设置里换口音/语速就完全不生效。统一收在这里:
 *   - 语言和语速从偏好读
 *   - 统一先 stop(),避免连点两个词时两个音轨叠着念
 */

export type SpeakOptions = {
  /** 覆盖口音(比如角色对话固定用某个地区口音) */
  accent?: SpeechAccent;
  /** 覆盖语速 */
  rate?: number;
  /** 不改全局队列,直接把这段插到前面 */
  interrupt?: boolean;
};

export function speakSpanish(text: string, options: SpeakOptions = {}) {
  const content = text?.trim();
  if (!content) return;

  const prefs = getPreferences();

  // 单句朗读场景几乎都是"点了就想马上听",默认打断上一条
  if (options.interrupt !== false) {
    Speech.stop();
  }

  Speech.speak(content, {
    language: options.accent ?? prefs.accent,
    rate: options.rate ?? prefs.rate
  });
}

export function stopSpeaking() {
  Speech.stop();
}

/** 当前生效的朗读文案,设置页用来展示"现在是什么口音" */
export function describeSpeech(prefs: { accent: SpeechAccent; rate: number }) {
  return `${prefs.accent} · ${prefs.rate.toFixed(2)}x`;
}
