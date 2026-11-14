// Timestamp: 2026-11-14 21:48
import { useCallback, useEffect, useRef, useState } from "react";
import { useAudioPlayer, useAudioPlayerStatus } from "expo-audio";

import { API_BASE } from "@/api/client";

/**
 * 精听播放器。
 *
 * 与阅读页那套（useParagraphSpeech）的区别：
 *   - 精听要能**降速**（0.75x）而不只是原速，所以走 setPlaybackRate
 *   - 精听要数"这一段听了几遍"，因为"1 遍就懂"和"5 遍才懂"是两种能力
 *   - 精听一次只播一段，不自动连播（盲听时连播等于放弃逐段核对）
 */

export type ListenRate = 0.75 | 1;

export const LISTEN_RATES: Array<{ value: ListenRate; label: string; hint: string }> = [
  { value: 0.75, label: "慢速", hint: "0.75x,先立住音" },
  { value: 1, label: "原速", hint: "1.0x,真实语速" }
];

function paragraphAudioUrl(slug: string, index: number) {
  return `${API_BASE}/audio/lectura/${encodeURIComponent(slug)}/p${index}.mp3`;
}

export function useListeningPlayer(slug: string | undefined) {
  const player = useAudioPlayer();
  const status = useAudioPlayerStatus(player);

  const [activeIndex, setActiveIndex] = useState<number | null>(null);
  const [plays, setPlays] = useState(0);
  const [rate, setRateState] = useState<ListenRate>(1);

  const playsRef = useRef<{ index: number | null; count: number }>({ index: null, count: 0 });
  const rateRef = useRef<ListenRate>(1);
  const slugRef = useRef(slug);

  useEffect(() => {
    slugRef.current = slug;
  }, [slug]);

  const applyRate = useCallback(
    (value: ListenRate) => {
      try {
        // 语音类素材变速必须做音高校正，否则 0.75x 会变成低音怪物
        player.setPlaybackRate(value, "medium");
      } catch {
        // 还没加载完时设置失败，等 isLoaded 的回调里再补一次
      }
    },
    [player]
  );

  // 换源后播放速率会被重置，加载完成时补一次
  useEffect(() => {
    if (status.isLoaded) applyRate(rateRef.current);
  }, [status.isLoaded, applyRate]);

  const play = useCallback(
    (index: number) => {
      const currentSlug = slugRef.current;
      if (!currentSlug) return;

      const same = playsRef.current.index === index;
      playsRef.current = { index, count: same ? playsRef.current.count + 1 : 1 };
      setPlays(playsRef.current.count);
      setActiveIndex(index);

      try {
        player.replace({ uri: paragraphAudioUrl(currentSlug, index) });
        applyRate(rateRef.current);
        player.play();
      } catch {
        setActiveIndex(null);
      }
    },
    [applyRate, player]
  );

  const stop = useCallback(() => {
    try {
      player.pause();
    } catch {
      // 播放器已释放时忽略
    }
  }, [player]);

  const toggle = useCallback(
    (index: number) => {
      if (activeIndex === index && status.playing) stop();
      else play(index);
    },
    [activeIndex, play, status.playing, stop]
  );

  const setRate = useCallback(
    (value: ListenRate) => {
      rateRef.current = value;
      setRateState(value);
      applyRate(value);
    },
    [applyRate]
  );

  /** 换段/离开时把播放次数清掉，避免把上一段的遍数算到这一段 */
  const resetPlays = useCallback(() => {
    playsRef.current = { index: null, count: 0 };
    setPlays(0);
    setActiveIndex(null);
  }, []);

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
    activeIndex,
    isPlaying: status.playing,
    plays,
    rate,
    error: status.error,
    play,
    stop,
    toggle,
    setRate,
    resetPlays
  };
}
