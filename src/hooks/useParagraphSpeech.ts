// Timestamp: 2026-11-17 16:12
import { useCallback, useEffect, useRef, useState } from "react";
import { useAudioPlayer, useAudioPlayerStatus } from "expo-audio";
import * as Speech from "expo-speech";

import { API_BASE } from "@/api/client";
import { usePreferences } from "@/hooks/usePreferences";
import {
  LEARNING_LANGUAGE_OPTIONS,
  updatePreferences,
  type LearningLanguage
} from "@/lib/preferences";

const TTS_CHUNK_MAX_LEN = 175;

function paragraphAudioUrl(slug: string, index: number) {
  return `${API_BASE}/audio/lectura/${encodeURIComponent(slug)}/p${index}.mp3`;
}

function serverTtsUrl(text: string, lang: LearningLanguage) {
  return `${API_BASE}/api/tts?text=${encodeURIComponent(text)}&lang=${encodeURIComponent(lang)}`;
}

/** 把长段拆成适合 /api/tts（上限 200 字符）的分句块 */
function splitTtsChunks(raw: string, maxLen = TTS_CHUNK_MAX_LEN): string[] {
  const clean = raw.replace(/\s+/g, " ").trim();
  if (!clean) return [];
  if (clean.length <= maxLen) return [clean];

  const sentences = clean.split(/(?<=[.!?。！？；;])\s+/).filter(Boolean);
  const chunks: string[] = [];
  let buf = "";

  const pushOversized = (piece: string) => {
    const words = piece.split(/\s+/).filter(Boolean);
    let sub = "";
    for (const w of words) {
      if (w.length > maxLen) {
        if (sub) {
          chunks.push(sub);
          sub = "";
        }
        for (let i = 0; i < w.length; i += maxLen) {
          chunks.push(w.slice(i, i + maxLen));
        }
        continue;
      }
      if (sub && sub.length + 1 + w.length > maxLen) {
        chunks.push(sub);
        sub = w;
      } else {
        sub = sub ? `${sub} ${w}` : w;
      }
    }
    if (sub) chunks.push(sub);
  };

  for (const s of sentences) {
    if (s.length > maxLen) {
      if (buf) {
        chunks.push(buf);
        buf = "";
      }
      pushOversized(s);
      continue;
    }
    if (buf && buf.length + 1 + s.length > maxLen) {
      chunks.push(buf);
      buf = s;
    } else {
      buf = buf ? `${buf} ${s}` : s;
    }
  }
  if (buf) chunks.push(buf);
  return chunks;
}

/**
 * 阅读器段落朗读。
 *
 * 1) 对已知有预生成静态音频的内置西语短文，先检查 static mp3 是否存在；
 * 2) 对德语短文、RSS 外刊或未生成静态 mp3 的段落，自动走 /api/tts 分段语音合成连续朗读，
 *    不再静默无声。
 */
export function useParagraphSpeech(
  slug: string | undefined,
  paragraphs: string[],
  language: LearningLanguage = "es"
) {
  const player = useAudioPlayer();
  const status = useAudioPlayerStatus(player);
  const prefs = usePreferences();

  const [playingIndex, setPlayingIndex] = useState<number | null>(null);
  const autoNext = prefs.autoNextParagraph;
  const setAutoNext = useCallback((value: boolean) => {
    void updatePreferences({ autoNextParagraph: value });
  }, []);

  const playingIndexRef = useRef<number | null>(null);
  const autoNextRef = useRef(true);
  const slugRef = useRef(slug);
  const paragraphsRef = useRef<string[]>(paragraphs);
  const languageRef = useRef<LearningLanguage>(language);
  const chunkQueueRef = useRef<string[]>([]);
  const chunkPosRef = useRef(0);
  const runTokenRef = useRef(0);

  slugRef.current = slug;
  paragraphsRef.current = paragraphs;
  languageRef.current = language;
  autoNextRef.current = autoNext;

  const clearState = useCallback(() => {
    playingIndexRef.current = null;
    chunkQueueRef.current = [];
    chunkPosRef.current = 0;
    setPlayingIndex(null);
  }, []);

  const stop = useCallback(() => {
    runTokenRef.current += 1;
    Speech.stop();
    try {
      player.pause();
    } catch {
      // 播放器已释放时忽略
    }
    clearState();
  }, [clearState, player]);

  const speakFallbackChunk = useCallback(
    (text: string, token: number, onFinishParagraph: () => void) => {
      if (runTokenRef.current !== token) return;
      const opt = LEARNING_LANGUAGE_OPTIONS.find((item) => item.value === languageRef.current);
      const voiceLang =
        languageRef.current === "es" ? prefs.accent : (opt?.ttsLang ?? languageRef.current);

      try {
        Speech.speak(text, {
          language: voiceLang,
          rate: prefs.rate,
          onDone: () => {
            if (runTokenRef.current !== token) return;
            onFinishParagraph();
          },
          onError: () => {
            if (runTokenRef.current === token) clearState();
          }
        });
      } catch {
        clearState();
      }
    },
    [clearState, prefs.accent, prefs.rate]
  );

  const playUrlChunk = useCallback(
    (uri: string) => {
      player.replace({ uri });
      try {
        player.setPlaybackRate(prefs.rate, "medium");
      } catch {
        // 部分设备不支持倍速时保留默认语速
      }
      player.play();
    },
    [player, prefs.rate]
  );

  const playParagraph = useCallback(
    (index: number) => {
      const currentSlug = slugRef.current;
      const list = paragraphsRef.current;
      if (!currentSlug || index < 0 || index >= list.length) return;

      const text = list[index]?.trim() ?? "";
      if (!text) return;

      Speech.stop();
      try {
        player.pause();
      } catch {
        // ignore
      }

      const token = ++runTokenRef.current;
      playingIndexRef.current = index;
      chunkQueueRef.current = [];
      chunkPosRef.current = 0;
      setPlayingIndex(index);

      const startTtsFallback = () => {
        if (runTokenRef.current !== token) return;
        const chunks = splitTtsChunks(text);
        if (chunks.length === 0) {
          clearState();
          return;
        }
        chunkQueueRef.current = chunks.map((chunk) => serverTtsUrl(chunk, languageRef.current));
        chunkPosRef.current = 0;
        try {
          playUrlChunk(chunkQueueRef.current[0]);
        } catch {
          speakFallbackChunk(text, token, () => {
            const nextIdx = index + 1;
            if (autoNextRef.current && nextIdx < paragraphsRef.current.length) {
              playParagraph(nextIdx);
            } else {
              clearState();
            }
          });
        }
      };

      const maybeStaticMp3 =
        languageRef.current === "es" &&
        !currentSlug.startsWith("rss-") &&
        !currentSlug.startsWith("de-");

      if (!maybeStaticMp3) {
        startTtsFallback();
        return;
      }

      const staticUri = paragraphAudioUrl(currentSlug, index);
      void fetch(staticUri, { method: "HEAD" })
        .then((res) => {
          if (runTokenRef.current !== token) return;
          if (res.ok) {
            chunkQueueRef.current = [staticUri];
            chunkPosRef.current = 0;
            playUrlChunk(staticUri);
            return;
          }
          startTtsFallback();
        })
        .catch(() => {
          startTtsFallback();
        });
    },
    [clearState, playUrlChunk, player, speakFallbackChunk]
  );

  const playAll = useCallback(() => {
    if (paragraphsRef.current.length === 0) return;
    playParagraph(0);
  }, [playParagraph]);

  /** 顶部按钮:未播放则从头朗读,播放中则停止 */
  const togglePlayAll = useCallback(() => {
    if (playingIndexRef.current !== null) {
      stop();
      return;
    }
    playAll();
  }, [playAll, stop]);

  /** 一段/分片播完 → 优先播本段下一分片，再自动下一段 */
  useEffect(() => {
    if (!status.didJustFinish) return;

    const index = playingIndexRef.current;
    if (index === null) return;

    const nextChunk = chunkPosRef.current + 1;
    if (nextChunk < chunkQueueRef.current.length) {
      chunkPosRef.current = nextChunk;
      try {
        playUrlChunk(chunkQueueRef.current[nextChunk]);
      } catch {
        clearState();
      }
      return;
    }

    const nextIndex = index + 1;
    if (autoNextRef.current && nextIndex < paragraphsRef.current.length) {
      playParagraph(nextIndex);
      return;
    }

    clearState();
  }, [status.didJustFinish, clearState, playParagraph, playUrlChunk]);

  // 页面离开或切换文章时停止
  useEffect(() => {
    return () => {
      runTokenRef.current += 1;
      Speech.stop();
      try {
        player.pause();
      } catch {
        // ignore
      }
    };
  }, [player]);

  return {
    playingIndex,
    isPlaying: playingIndex !== null || status.playing,
    autoNext,
    setAutoNext,
    playParagraph,
    playAll,
    stop,
    togglePlayAll
  };
}
