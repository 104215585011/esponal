// Timestamp: 2026-05-26 16:35
"use client";

import { useRef, useState } from "react";
import type { AlphabetLetter } from "@/../content/phonics/alphabet";
import { getPlaybackRate } from "@/lib/playback-rate";

type AlphabetGridProps = {
  letters: AlphabetLetter[];
};

type AudioKey = string;

function AudioButton({
  label,
  playing,
  onClick,
  tone = "gray",
  compact = false
}: {
  label: string;
  playing: boolean;
  onClick: (event: React.MouseEvent<HTMLButtonElement>) => void;
  tone?: "gray" | "brand";
  compact?: boolean;
}) {
  const idleClass =
    tone === "brand"
      ? "bg-brand-50 dark:bg-brand-950/40 text-brand-700 dark:text-brand-300 hover:bg-brand-100 dark:hover:bg-brand-900/40"
      : "bg-zinc-50 dark:bg-zinc-800/40 text-zinc-750 dark:text-zinc-300 hover:bg-zinc-100 dark:hover:bg-zinc-700/50";
  const activeClass =
    tone === "brand"
      ? "bg-brand-100 dark:bg-brand-900/60 text-brand-700 dark:text-brand-300"
      : "bg-zinc-100 dark:bg-zinc-750 text-zinc-900 dark:text-zinc-100";

  return (
    <button
      className={`inline-flex items-center rounded-full font-medium transition duration-300 ${
        compact ? "px-3 py-1 text-xs" : "h-9 px-3 text-xs"
      } ${playing ? activeClass : idleClass}`}
      onClick={onClick}
      type="button"
    >
      🔊 {label}
    </button>
  );
}

export function AlphabetGrid({ letters }: AlphabetGridProps) {
  const audioRef = useRef<HTMLAudioElement | null>(null);
  const [playingKey, setPlayingKey] = useState<AudioKey | null>(null);
  const [selectedLetter, setSelectedLetter] = useState<AlphabetLetter | null>(null);

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

  function stopEvent(event: React.MouseEvent<HTMLButtonElement>) {
    event.stopPropagation();
  }

  function renderRuleModal() {
    if (!selectedLetter?.rules?.length) return null;

    return (
      <div className="fixed inset-0 z-50 flex items-end bg-black/40 backdrop-blur-sm px-0 sm:items-center sm:justify-center sm:px-4">
        <div className="w-full rounded-t-card bg-surface dark:bg-zinc-900 shadow-elevated border border-zinc-250/20 dark:border-zinc-800/50 sm:max-w-lg sm:rounded-card p-5 glass-card">
          <div className="flex items-start justify-between border-b border-zinc-150 dark:border-zinc-850 pb-4 mb-4">
            <div>
              <div className="font-serif text-4xl leading-none text-zinc-950 dark:text-zinc-55">
                {selectedLetter.letter}
                <span className="ml-1 text-[0.55em] font-sans font-normal text-zinc-500">{selectedLetter.letterLower}</span>
              </div>
              <p className="mt-2 text-sm text-zinc-500 dark:text-zinc-400 font-display">{selectedLetter.name}</p>
            </div>
            <button
              className="rounded-full border border-zinc-200 dark:border-zinc-800 px-4 py-1.5 text-sm text-zinc-650 dark:text-zinc-450 transition hover:bg-zinc-50 dark:hover:bg-zinc-800 hover:border-brand-500"
              onClick={() => setSelectedLetter(null)}
              type="button"
            >
              关闭
            </button>
          </div>

          <div className="max-h-[60vh] overflow-y-auto space-y-4 pr-1">
            {selectedLetter.rules.map((rule, index) => (
              <section
                className={`${index === 0 ? "" : "border-t border-zinc-150 dark:border-zinc-800/80 pt-4"} ${index === selectedLetter.rules!.length - 1 ? "" : "pb-4"}`}
                key={`${selectedLetter.slug}-${rule.condition}`}
              >
                <div className="flex flex-wrap items-center gap-2">
                  <span className="rounded-full bg-zinc-100 dark:bg-zinc-850 px-2.5 py-1 text-xs font-semibold text-zinc-600 dark:text-zinc-400">
                    {rule.condition}
                  </span>
                  <p className="text-sm text-zinc-700 dark:text-zinc-300 font-light">{rule.sound}</p>
                </div>

                <div className="mt-3 flex flex-wrap gap-2">
                  {rule.syllables.map((syllable) => {
                    const key = `syllable:${syllable}`;
                    return (
                      <AudioButton
                        compact
                        key={syllable}
                        label={syllable}
                        onClick={(event) => {
                          stopEvent(event);
                          play(`/audio/phonics/syllables/${syllable}.mp3`, key);
                        }}
                        playing={playingKey === key}
                        tone="brand"
                      />
                    );
                  })}
                </div>

                <div className="mt-3 space-y-2">
                  {rule.words.map((word) => {
                    const key = `rule-word:${word.audioSlug}`;
                    return (
                      <div className="flex items-center justify-between gap-3 rounded-card bg-zinc-50/50 dark:bg-zinc-950/20 px-3 py-2 border border-zinc-100/50 dark:border-zinc-850/20" key={word.audioSlug}>
                        <p className="min-w-0 text-sm text-zinc-750 dark:text-zinc-350 font-light font-display">
                          {word.text} · {word.zh}
                        </p>
                        <AudioButton
                          compact
                          label={word.text}
                          onClick={(event) => {
                            stopEvent(event);
                            play(`/audio/phonics/words/${word.audioSlug}.mp3`, key);
                          }}
                          playing={playingKey === key}
                        />
                      </div>
                    );
                  })}
                </div>
              </section>
            ))}
          </div>
        </div>
      </div>
    );
  }

  return (
    <>
      <div className="grid grid-cols-3 gap-3 sm:grid-cols-4 sm:gap-4 lg:grid-cols-5">
        {letters.map((letter) => {
          const isUnique = letter.letter === "Ñ";
          const hasRules = Boolean(letter.rules?.length);
          const letterKey: AudioKey = `${letter.slug}:letter`;
          const wordKey: AudioKey = `${letter.slug}:word`;

          return (
            <section
              className={`group relative flex min-h-[196px] flex-col justify-between rounded-hero border p-4 transition duration-300 glass-card card-hover-lift shadow-sm ${
                isUnique
                  ? "border-brand-100 dark:border-brand-900/40 bg-brand-50/40 dark:bg-brand-950/10 text-brand-700"
                  : "border-zinc-200/50 dark:border-zinc-800/50 bg-white/70 dark:bg-zinc-900/70 text-zinc-900"
              }`}
              key={letter.slug}
            >
              {isUnique ? (
                <span className="absolute right-3 top-3 text-[10px] font-semibold text-brand-500">
                  西语独有
                </span>
              ) : null}

              {hasRules ? (
                <span className="absolute right-3 top-3 h-1.5 w-1.5 bg-brand-400 rounded-full animate-pulse" />
              ) : null}

              <div>
                <div className="font-serif text-[56px] leading-none tracking-normal sm:text-6xl text-zinc-950 dark:text-zinc-50">
                  {letter.letter}
                  <span className="ml-1 text-[0.55em] font-sans font-normal text-zinc-400">{letter.letterLower}</span>
                </div>
                <div className={`mt-3 text-sm font-semibold transition-colors duration-300 group-hover:text-brand-500 ${isUnique ? "text-brand-600 dark:text-brand-400" : "text-zinc-500 dark:text-zinc-450"}`}>
                  {letter.name}
                </div>
                <div className="mt-3 truncate text-sm text-zinc-650 dark:text-zinc-400 font-light">
                  {letter.example} · {letter.exampleZh}
                </div>
              </div>

              <div className="mt-4 space-y-2">
                <div className="grid grid-cols-2 gap-2">
                  <AudioButton
                    label={letter.name}
                    onClick={(event) => {
                      stopEvent(event);
                      play(`/audio/phonics/letters/${letter.slug}.mp3`, letterKey);
                    }}
                    playing={playingKey === letterKey}
                  />
                  <AudioButton
                    label={letter.example}
                    onClick={(event) => {
                      stopEvent(event);
                      play(`/audio/phonics/words/${letter.slug}.mp3`, wordKey);
                    }}
                    playing={playingKey === wordKey}
                    tone="brand"
                  />
                </div>

                {hasRules ? (
                  <button
                    className="w-full text-right text-[11px] text-zinc-400 dark:text-zinc-500 transition hover:text-brand-600 dark:hover:text-brand-400"
                    onClick={() => setSelectedLetter(letter)}
                    type="button"
                  >
                    查看发音
                  </button>
                ) : null}
              </div>
            </section>
          );
        })}
      </div>

      {renderRuleModal()}
    </>
  );
}
