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
        className="cursor-pointer rounded-full border border-gray-200 bg-white px-2 py-1 text-xs text-gray-700 outline-none transition hover:border-brand-400 focus:border-brand-500 focus:ring-2 focus:ring-brand-100"
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
