// Timestamp: 2026-06-04 10:37
"use client";

import { useRef, useState } from "react";
import { Volume2 } from "lucide-react";
import {
  PHONICS_SINALEFA_SENTENCES,
  PHONICS_STRESS_RULES,
  type PhonicsSinalefaSentence,
  type PhonicsStressExample
} from "@/../content/phonics/prosody";
import { getPlaybackRate } from "@/lib/playback-rate";

function AudioButton({
  label,
  playing,
  onClick
}: {
  label: string;
  playing: boolean;
  onClick: () => void;
}) {
  return (
    <button
      className={`inline-flex min-h-[44px] items-center gap-1 rounded-full px-3 text-xs font-medium transition md:h-9 md:min-h-0 ${
        playing
          ? "bg-brand-100 text-brand-700 dark:bg-brand-900/60 dark:text-brand-300"
          : "bg-brand-50 text-brand-700 hover:bg-brand-100 dark:bg-brand-950/40 dark:text-brand-300 dark:hover:bg-brand-900/40"
      }`}
      onClick={onClick}
      type="button"
    >
      <Volume2 className="h-3.5 w-3.5 shrink-0" aria-hidden />
      <span className="truncate">{label}</span>
    </button>
  );
}

function StressWord({
  example,
  playing,
  onPlay
}: {
  example: PhonicsStressExample;
  playing: boolean;
  onPlay: () => void;
}) {
  return (
    <div className="rounded-card bg-zinc-50 px-4 py-3 dark:bg-zinc-900/60">
      <div className="flex items-center justify-between gap-3">
        <div className="min-w-0">
          <p className="text-sm text-zinc-900 dark:text-zinc-100">
            {example.syllables.map((syllable, index) => (
              <span
                className={index === example.stressedIndex ? "font-bold text-brand-600 dark:text-brand-400" : ""}
                key={`${example.slug}-${syllable}-${index}`}
              >
                {index === 0 ? "" : "·"}
                {syllable}
              </span>
            ))}
          </p>
          <p className="mt-1 text-xs text-zinc-500 dark:text-zinc-400">
            {example.text} · {example.zh}
          </p>
        </div>
        <AudioButton label={example.text} onClick={onPlay} playing={playing} />
      </div>
    </div>
  );
}

function SinalefaSentenceRow({
  sentence,
  playing,
  onPlay
}: {
  sentence: PhonicsSinalefaSentence;
  playing: boolean;
  onPlay: () => void;
}) {
  return (
    <div className="rounded-card bg-zinc-50 px-4 py-3 dark:bg-zinc-900/60">
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <p className="text-sm text-zinc-900 dark:text-zinc-100">
            <span>{sentence.parts.before}</span>
            <span className="border-b-2 border-brand-400">{sentence.parts.merge}</span>
            <span>{sentence.parts.after}</span>
          </p>
          <p className="mt-1 text-xs text-zinc-500 dark:text-zinc-400">
            {sentence.pronunciation} · {sentence.note}
          </p>
          <p className="mt-1 text-xs text-zinc-400 dark:text-zinc-500">{sentence.text}</p>
        </div>
        <AudioButton label={sentence.text} onClick={onPlay} playing={playing} />
      </div>
    </div>
  );
}

export function PhonicsProsody() {
  const audioRef = useRef<HTMLAudioElement | null>(null);
  const [playingKey, setPlayingKey] = useState<string | null>(null);

  function play(src: string, key: string) {
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
    <section className="mt-8 border-t border-zinc-100 pt-8 dark:border-zinc-900 md:mt-12 md:pt-10">
      <div className="max-w-3xl space-y-6 md:space-y-8">
        <div>
          <h2 className="font-display text-xl font-semibold tracking-tight text-zinc-950 dark:text-zinc-50 md:text-2xl">重音 & 连读</h2>
          <p className="mt-2 text-sm text-zinc-600 dark:text-zinc-400">
            先抓重读音节，再听元音相遇时怎么自然连起来。
          </p>
        </div>

        <section>
          <div className="mb-4">
            <h3 className="text-lg font-semibold text-zinc-950 dark:text-zinc-50">Acentuación</h3>
            <p className="mt-1 text-sm text-zinc-600 dark:text-zinc-400">重音通常有规律，但重音符号会直接改写它。</p>
          </div>
          <div className="space-y-4">
            {PHONICS_STRESS_RULES.map((rule) => (
              <div className="rounded-card border border-zinc-200/60 p-4 dark:border-zinc-800/50" key={rule.title}>
                <div className="mb-3">
                  <h4 className="text-sm font-semibold text-zinc-900 dark:text-zinc-100">{rule.title}</h4>
                  <p className="mt-1 text-sm text-zinc-600 dark:text-zinc-400">{rule.description}</p>
                </div>
                <div className="grid gap-3 sm:grid-cols-2">
                  {rule.examples.map((example) => {
                    const key = `stress:${example.slug}`;
                    return (
                      <StressWord
                        example={example}
                        key={example.slug}
                        onPlay={() => play(`/audio/phonics/stress/${example.slug}.mp3`, key)}
                        playing={playingKey === key}
                      />
                    );
                  })}
                </div>
              </div>
            ))}
          </div>
        </section>

        <section>
          <div className="mb-4">
            <h3 className="text-lg font-semibold text-zinc-950 dark:text-zinc-50">Sinalefa</h3>
            <p className="mt-1 text-sm text-zinc-600 dark:text-zinc-400">
              前一个词以元音结尾、后一个词以元音开头时，常会并进同一个音节里。
            </p>
          </div>
          <div className="space-y-3">
            {PHONICS_SINALEFA_SENTENCES.map((sentence) => {
              const key = `sinalefa:${sentence.slug}`;
              return (
                <SinalefaSentenceRow
                  key={sentence.slug}
                  onPlay={() => play(`/audio/phonics/sinalefa/${sentence.slug}.mp3`, key)}
                  playing={playingKey === key}
                  sentence={sentence}
                />
              );
            })}
          </div>
        </section>
      </div>
    </section>
  );
}
