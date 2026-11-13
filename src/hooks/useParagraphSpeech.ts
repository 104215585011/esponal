// Timestamp: 2026-11-14 02:15
import { useCallback, useEffect, useRef, useState } from "react";
import { useAudioPlayer, useAudioPlayerStatus } from "expo-audio";

import { API_BASE } from "@/api/client";

/**
 * 阅读器段落朗读。
 *
 * 用**预生成的静态 mp3**(public/audio/lectura/<slug>/p<n>.mp3),不走实时 TTS:
 * - 零合成延迟(点了就播)
 * - 零额度消耗、不受 60 次/分钟限流
 * - 音频与段落 1:1 对齐(已实测 el-asado / tortuga / ceviche 全对上)
 *
 * 注:服务端 /api/tts 当前在生产返回 500(msedge-tts 合成失败,存量问题),
 * 更说明静态音频是这里的正确选择。若某篇新文章还没生成音频,该段会播不出声。
 */
function paragraphAudioUrl(slug: string, index: number) {
  return `${API_BASE}/audio/lectura/${encodeURIComponent(slug)}/p${index}.mp3`;
}

export function useParagraphSpeech(slug: string | undefined, paragraphCount: number) {
  const player = useAudioPlayer();
  const status = useAudioPlayerStatus(player);

  const [playingIndex, setPlayingIndex] = useState<number | null>(null);
  const [autoNext, setAutoNext] = useState(true);

  const playingIndexRef = useRef<number | null>(null);
  const autoNextRef = useRef(true);
  const slugRef = useRef(slug);
  const countRef = useRef(paragraphCount);

  useEffect(() => {
    slugRef.current = slug;
  }, [slug]);

  useEffect(() => {
    countRef.current = paragraphCount;
  }, [paragraphCount]);

  useEffect(() => {
    autoNextRef.current = autoNext;
  }, [autoNext]);

  const clearState = useCallback(() => {
    playingIndexRef.current = null;
    setPlayingIndex(null);
  }, []);

  const stop = useCallback(() => {
    try {
      player.pause();
    } catch {
      // 播放器已释放时忽略
    }
    clearState();
  }, [clearState, player]);

  const playParagraph = useCallback(
    (index: number) => {
      const currentSlug = slugRef.current;
      if (!currentSlug) return;
      if (index < 0 || index >= countRef.current) return;

      playingIndexRef.current = index;
      setPlayingIndex(index);

      try {
        player.replace({ uri: paragraphAudioUrl(currentSlug, index) });
        player.play();
      } catch {
        clearState();
      }
    },
    [clearState, player]
  );

  const playAll = useCallback(() => {
    if (countRef.current === 0) return;
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

  /** 一段播完 → 自动下一段 */
  useEffect(() => {
    if (!status.didJustFinish) return;

    const index = playingIndexRef.current;
    if (index === null) return;

    const nextIndex = index + 1;
    if (autoNextRef.current && nextIndex < countRef.current) {
      playParagraph(nextIndex);
      return;
    }

    clearState();
  }, [status.didJustFinish, clearState, playParagraph]);

  // 页面离开时停止
  useEffect(() => {
    return () => {
      try {
        player.pause();
      } catch {
        // ignore
      }
    };
  }, [player]);

  return {
    playingIndex,
    isPlaying: status.playing,
    autoNext,
    setAutoNext,
    playParagraph,
    playAll,
    stop,
    togglePlayAll
  };
}
