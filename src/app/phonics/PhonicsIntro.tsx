// Timestamp: 2026-06-04 10:37
"use client";

import { useRef, useState } from "react";
import { Volume2 } from "lucide-react";
import {
  PHONICS_DIPHTHONGS,
  PHONICS_STRONG_VOWELS,
  PHONICS_VOWELS,
  PHONICS_WEAK_VOWELS
} from "@/../content/phonics/foundations";
import { getPlaybackRate } from "@/lib/playback-rate";

type AudioKey =
  | `vowel:${string}`
  | `example:${string}`
  | `diphthong:${string}`;

function AudioChip({
  label,
  playing,
  onClick,
  tone = "gray"
}: {
  label: string;
  playing: boolean;
  onClick: () => void;
  tone?: "gray" | "brand";
}) {
  const idleClass =
    tone === "brand"
      ? "bg-brand-50 text-brand-700 hover:bg-brand-100 dark:bg-brand-950/40 dark:text-brand-300 dark:hover:bg-brand-900/40"
      : "bg-zinc-50 text-zinc-700 hover:bg-zinc-100 dark:bg-zinc-800/40 dark:text-zinc-300 dark:hover:bg-zinc-700/50";
  const activeClass =
    tone === "brand"
      ? "bg-brand-100 text-brand-700 dark:bg-brand-900/60 dark:text-brand-300"
      : "bg-zinc-100 text-zinc-900 dark:bg-zinc-750 dark:text-zinc-100";

  return (
    <button
      className={`inline-flex min-h-[44px] items-center gap-1 rounded-full px-4 text-sm font-medium transition duration-300 md:h-9 md:min-h-0 ${
        playing ? activeClass : idleClass
      }`}
      onClick={onClick}
      type="button"
    >
      <Volume2 className="h-3.5 w-3.5 shrink-0" aria-hidden />
      <span className="truncate">{label}</span>
    </button>
  );
}

export function PhonicsIntro() {
  const audioRef = useRef<HTMLAudioElement | null>(null);
  const [playingKey, setPlayingKey] = useState<AudioKey | null>(null);

  function play(src: string, key: AudioKey) {
    if (audioRef.current) {
      audioRef.current.pause();
      audioRef.current.currentTime = 0;
    }

    if (playingKey === key) {
      setPlayingKey(null);
      return;
    }

    const audio = new Audio(src);
    audio.playbackRate = getPlaybackRate();
    audioRef.current = audio;
    setPlayingKey(key);
    audio.addEventListener("ended", () => setPlayingKey(null), { once: true });
    audio.addEventListener("error", () => setPlayingKey(null), { once: true });
    audio.play().catch(() => setPlayingKey(null));
  }

  return (
    <section className="space-y-6 md:space-y-8">
      <div>
        <h2 className="font-display text-xl font-semibold tracking-tight text-zinc-950 dark:text-zinc-50 md:text-2xl">发音基础</h2>
        <p className="mt-2 text-sm font-light leading-relaxed text-zinc-600 dark:text-zinc-400">
          先把元音听稳，再看后面的字母变音规则。西语的元音比英语更固定，听熟以后拼读会轻松很多。
        </p>
      </div>

      <div className="space-y-3 md:space-y-4">
        <div className="flex items-end justify-between gap-3">
          <div>
            <p className="font-display text-sm font-semibold text-zinc-900 dark:text-zinc-100">Vocales</p>
            <p className="mt-1 text-sm font-light text-zinc-500 dark:text-zinc-400">西语元音发音固定，每个字母基本只有一种核心读法。</p>
          </div>
          <p className="hidden text-xs font-light text-zinc-400 dark:text-zinc-500 sm:block">阿 / 诶 / 衣 / 哦 / 乌</p>
        </div>
        <div className="flex flex-wrap gap-2.5 md:gap-2">
          {PHONICS_VOWELS.map((vowel) => {
            const key: AudioKey = `vowel:${vowel.symbol}`;
            return (
              <AudioChip
                key={vowel.symbol}
                label={`${vowel.symbol} ${vowel.zh}`}
                onClick={() => play(`/audio/phonics/letters/${vowel.audioSlug}.mp3`, key)}
                playing={playingKey === key}
                tone="brand"
              />
            );
          })}
        </div>
      </div>

      <div className="grid gap-3 md:gap-4 lg:grid-cols-2">
        <section className="glass-card rounded-hero border border-brand-100 bg-brand-50/40 p-4 md:p-5 dark:border-brand-900/40 dark:bg-brand-950/10">
          <p className="font-display text-sm font-semibold text-brand-800 dark:text-brand-300">Vocales fuertes</p>
          <p className="mt-1 text-sm font-light text-brand-700/80 dark:text-brand-400">a / e / o 比较能撑住一个完整音节。</p>
          <div className="mt-3 flex flex-wrap gap-2.5 md:gap-2">
            {PHONICS_STRONG_VOWELS.map((example) => {
              const key: AudioKey = `example:${example.audioSlug}`;
              return (
                <AudioChip
                  key={example.audioSlug}
                  label={`${example.text} · ${example.zh}`}
                  onClick={() => play(`/audio/phonics/words/${example.audioSlug}.mp3`, key)}
                  playing={playingKey === key}
                  tone="brand"
                />
              );
            })}
          </div>
        </section>

        <section className="glass-card rounded-hero border border-zinc-200/50 bg-zinc-50/50 p-4 md:p-5 dark:border-zinc-800/50 dark:bg-zinc-950/20">
          <p className="font-display text-sm font-semibold text-zinc-900 dark:text-zinc-50">Vocales débiles</p>
          <p className="mt-1 text-sm font-light text-zinc-500 dark:text-zinc-400">i / u 靠近强元音时常会“让位”，和它们并进同一个音节。</p>
          <div className="mt-3 flex flex-wrap gap-2.5 md:gap-2">
            {PHONICS_WEAK_VOWELS.map((example) => {
              const key: AudioKey = `example:${example.audioSlug}`;
              return (
                <AudioChip
                  key={example.audioSlug}
                  label={`${example.text} · ${example.zh}`}
                  onClick={() => play(`/audio/phonics/words/${example.audioSlug}.mp3`, key)}
                  playing={playingKey === key}
                />
              );
            })}
          </div>
        </section>
      </div>

      <section className="glass-card rounded-hero border border-zinc-200/50 bg-white/70 p-4 md:p-6 shadow-sm dark:border-zinc-800/50 dark:bg-zinc-900/70">
        <div className="flex items-end justify-between gap-3">
          <div>
            <p className="font-display text-sm font-semibold text-zinc-900 dark:text-zinc-50">Diptongo</p>
            <p className="mt-1 text-sm font-light text-zinc-500 dark:text-zinc-400">
              强 + 弱、弱 + 强、弱 + 弱，常常会并进同一个音节，听起来更顺更连。
            </p>
          </div>
          <p className="hidden text-xs font-light text-zinc-400 dark:text-zinc-500 sm:block">
            Consonantes：其余 22 个字母都是辅音，具体变音规则见各字母详情。
          </p>
        </div>

        <div className="mt-4 grid gap-3 sm:grid-cols-3">
          {PHONICS_DIPHTHONGS.map((word) => {
            const key: AudioKey = `diphthong:${word.audioSlug}`;
            return (
              <div className="rounded-surface border border-zinc-100/50 bg-zinc-50/50 p-4 dark:border-zinc-850/20 dark:bg-zinc-950/20" key={word.audioSlug}>
                <div className="font-display text-lg font-semibold text-zinc-900 dark:text-zinc-200">
                  {word.before}
                  <span className="font-semibold text-brand-600 dark:text-brand-400">{word.highlight}</span>
                  {word.after}
                </div>
                <p className="mt-1 text-sm font-light text-zinc-500 dark:text-zinc-450">{word.zh}</p>
                <div className="mt-3">
                  <AudioChip
                    label={word.text}
                    onClick={() => play(`/audio/phonics/words/${word.audioSlug}.mp3`, key)}
                    playing={playingKey === key}
                    tone="brand"
                  />
                </div>
              </div>
            );
          })}
        </div>

        <p className="mt-4 text-xs font-light text-zinc-400 dark:text-zinc-500 sm:hidden">
          Consonantes：其余 22 个字母都是辅音，具体变音规则见各字母详情。
        </p>
      </section>
    </section>
  );
}
