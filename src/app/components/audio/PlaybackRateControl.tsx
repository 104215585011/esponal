"use client";

import { PLAYBACK_RATES, usePlaybackRate } from "@/lib/playback-rate";

type PlaybackRateControlProps = {
  className?: string;
};

export function PlaybackRateControl({ className = "" }: PlaybackRateControlProps) {
  const [rate, setRate] = usePlaybackRate();

  return (
    <label
      className={`flex items-center gap-1.5 text-[11px] font-medium text-gray-500 ${className}`}
      title="所有 TTS 朗读的倍速（短文、单词、课程句子）"
    >
      <span aria-hidden className="hidden sm:inline">
        语速
      </span>
      <select
        aria-label="TTS 朗读倍速"
        className="cursor-pointer rounded-full border border-zinc-200 dark:border-zinc-800 bg-white/80 dark:bg-zinc-900/80 px-2.5 py-0.5 text-xs text-zinc-700 dark:text-zinc-300 outline-none transition-all hover:border-zinc-350 dark:hover:border-zinc-700 focus:border-brand-500 focus:ring-2 focus:ring-brand-100/30"
        onChange={(event) => setRate(Number(event.target.value))}
        value={rate}
      >
        {PLAYBACK_RATES.map((r) => (
          <option key={r} value={r}>
            {r}x
          </option>
        ))}
      </select>
    </label>
  );
}
