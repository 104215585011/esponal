"use client";

import { useRef, useState } from "react";
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
      ? "bg-brand-50 text-brand-700 hover:bg-brand-100"
      : "bg-gray-50 text-gray-700 hover:bg-gray-100";
  const activeClass =
    tone === "brand" ? "bg-brand-100 text-brand-700" : "bg-gray-100 text-gray-900";

  return (
    <button
      className={`inline-flex h-9 items-center rounded-full px-4 text-sm font-medium transition ${
        playing ? activeClass : idleClass
      }`}
      onClick={onClick}
      type="button"
    >
      馃攰 {label}
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
    <section className="space-y-8">
      <div>
        <h2 className="text-2xl font-semibold tracking-normal text-gray-950">发音基础</h2>
        <p className="mt-2 text-sm leading-6 text-gray-600">
          先把元音听稳，再看后面的字母变音规则。西语的元音比英语更固定，听熟以后拼读会轻松很多。
        </p>
      </div>

      <div className="space-y-4">
        <div className="flex items-end justify-between gap-3">
          <div>
            <p className="text-sm font-medium text-gray-900">Vocales</p>
            <p className="mt-1 text-sm text-gray-500">西语元音发音固定，每个字母基本只有一种核心读法。</p>
          </div>
          <p className="hidden text-xs text-gray-400 sm:block">阿 / 诶 / 衣 / 哦 / 乌</p>
        </div>
        <div className="flex flex-wrap gap-2">
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

      <div className="grid gap-4 lg:grid-cols-2">
        <section className="rounded-card border border-brand-100 bg-brand-50/70 p-4">
          <p className="text-sm font-medium text-brand-700">Vocales fuertes</p>
          <p className="mt-1 text-sm text-brand-700/80">a / e / o 比较能撑住一个完整音节。</p>
          <div className="mt-3 flex flex-wrap gap-2">
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

        <section className="rounded-card border border-gray-200 bg-gray-50 p-4">
          <p className="text-sm font-medium text-gray-700">Vocales débiles</p>
          <p className="mt-1 text-sm text-gray-500">i / u 靠近强元音时常会“让位”，和它们并进同一个音节。</p>
          <div className="mt-3 flex flex-wrap gap-2">
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

      <section className="rounded-card border border-gray-200 bg-white p-4">
        <div className="flex items-end justify-between gap-3">
          <div>
            <p className="text-sm font-medium text-gray-900">Diptongo</p>
            <p className="mt-1 text-sm text-gray-500">
              强 + 弱、弱 + 强、弱 + 弱，常常会并进同一个音节，听起来更顺更连。
            </p>
          </div>
          <p className="hidden text-xs text-gray-400 sm:block">
            Consonantes：其余 22 个字母都是辅音，具体变音规则见各字母详情。
          </p>
        </div>

        <div className="mt-4 grid gap-3 sm:grid-cols-3">
          {PHONICS_DIPHTHONGS.map((word) => {
            const key: AudioKey = `diphthong:${word.audioSlug}`;
            return (
              <div className="rounded-card bg-gray-50 p-3" key={word.audioSlug}>
                <div className="text-lg text-gray-900">
                  {word.before}
                  <span className="text-brand-600 font-semibold">{word.highlight}</span>
                  {word.after}
                </div>
                <p className="mt-1 text-sm text-gray-500">{word.zh}</p>
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

        <p className="mt-4 text-xs text-gray-400 sm:hidden">
          Consonantes：其余 22 个字母都是辅音，具体变音规则见各字母详情。
        </p>
      </section>
    </section>
  );
}
