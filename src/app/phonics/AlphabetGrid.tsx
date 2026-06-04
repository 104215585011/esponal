// Timestamp: 2026-06-04 11:18
"use client";

import { useEffect, useRef, useState } from "react";
import { ChevronRight, Volume2 } from "lucide-react";
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
      ? "bg-brand-50 text-brand-700 hover:bg-brand-100 dark:bg-brand-950/40 dark:text-brand-300 dark:hover:bg-brand-900/40"
      : "bg-zinc-50 text-zinc-750 hover:bg-zinc-100 dark:bg-zinc-800/40 dark:text-zinc-300 dark:hover:bg-zinc-700/50";
  const activeClass =
    tone === "brand"
      ? "bg-brand-100 text-brand-700 dark:bg-brand-900/60 dark:text-brand-300"
      : "bg-zinc-100 text-zinc-900 dark:bg-zinc-750 dark:text-zinc-100";

  return (
    <button
      className={`inline-flex items-center gap-1 rounded-full font-medium transition duration-300 ${
        compact ? "min-h-[36px] px-3 py-1 text-xs" : "min-h-[44px] px-3 text-xs md:h-9 md:min-h-0"
      } ${playing ? activeClass : idleClass}`}
      onClick={onClick}
      type="button"
    >
      <Volume2 className="h-3.5 w-3.5 shrink-0" aria-hidden />
      <span className="truncate">{label}</span>
    </button>
  );
}

export function AlphabetGrid({ letters }: AlphabetGridProps) {
  const audioRef = useRef<HTMLAudioElement | null>(null);
  const dragStartYRef = useRef<number | null>(null);
  const drawerOffsetRef = useRef(0);
  const [playingKey, setPlayingKey] = useState<AudioKey | null>(null);
  const [selectedLetter, setSelectedLetter] = useState<AlphabetLetter | null>(null);
  const [drawerOffset, setDrawerOffset] = useState(0);

  useEffect(() => {
    if (!selectedLetter) return;

    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";

    return () => {
      document.body.style.overflow = previousOverflow;
    };
  }, [selectedLetter]);

  useEffect(() => {
    setDrawerOffset(0);
    drawerOffsetRef.current = 0;
    dragStartYRef.current = null;
  }, [selectedLetter]);

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

  function handleDrawerPointerDown(event: React.PointerEvent<HTMLDivElement>) {
    dragStartYRef.current = event.clientY;
    event.currentTarget.setPointerCapture(event.pointerId);
  }

  function handleDrawerPointerMove(event: React.PointerEvent<HTMLDivElement>) {
    if (dragStartYRef.current === null) return;

    const nextOffset = Math.max(0, event.clientY - dragStartYRef.current);
    drawerOffsetRef.current = nextOffset;
    setDrawerOffset(nextOffset);
  }

  function handleDrawerPointerEnd() {
    dragStartYRef.current = null;

    if (drawerOffsetRef.current > 80) {
      setSelectedLetter(null);
      return;
    }

    drawerOffsetRef.current = 0;
    setDrawerOffset(0);
  }

  function handleDrawerPointerCancel() {
    dragStartYRef.current = null;
    drawerOffsetRef.current = 0;
    setDrawerOffset(0);
  }

  function renderRuleModal() {
    if (!selectedLetter?.rules?.length) return null;

    return (
      <div className="fixed inset-0 z-50 flex items-end bg-black/40 backdrop-blur-sm px-0 sm:items-center sm:justify-center sm:px-4">
        <div
          className="glass-card w-full rounded-t-card border border-zinc-200/20 bg-surface p-5 pb-[calc(env(safe-area-inset-bottom)+20px)] shadow-elevated transition-transform duration-200 ease-out dark:border-zinc-800/50 dark:bg-zinc-900 sm:max-w-lg sm:rounded-card sm:pb-5"
          onPointerCancel={handleDrawerPointerCancel}
          onPointerMove={handleDrawerPointerMove}
          onPointerUp={handleDrawerPointerEnd}
          style={{ transform: `translateY(${drawerOffset}px)` }}
        >
          <div
            className="mx-auto mt-3 mb-1 h-1 w-12 touch-none rounded-full bg-zinc-200 dark:bg-zinc-800 sm:hidden"
            aria-hidden
            onPointerDown={handleDrawerPointerDown}
          />
          <div className="mb-4 flex items-start justify-between border-b border-zinc-200 pb-4 dark:border-zinc-800">
            <div>
              <div className="font-serif text-4xl leading-none text-zinc-950 dark:text-zinc-100">
                {selectedLetter.letter}
                <span className="ml-1 text-[0.55em] font-sans font-normal text-zinc-500">{selectedLetter.letterLower}</span>
              </div>
              <p className="mt-2 font-display text-sm text-zinc-500 dark:text-zinc-400">{selectedLetter.name}</p>
            </div>
            <button
              className="min-h-[40px] rounded-full border border-zinc-200 px-4 py-2 text-sm text-zinc-600 transition hover:border-brand-500 hover:bg-zinc-50 dark:border-zinc-800 dark:text-zinc-400 dark:hover:bg-zinc-800 sm:py-1.5"
              onClick={() => setSelectedLetter(null)}
              type="button"
            >
              关闭
            </button>
          </div>

          <div className="max-h-[60vh] space-y-4 overflow-y-auto pr-1">
            {selectedLetter.rules.map((rule, index) => (
              <section
                className={`${index === 0 ? "" : "border-t border-zinc-200 pt-4 dark:border-zinc-800/80"} ${index === selectedLetter.rules!.length - 1 ? "" : "pb-4"}`}
                key={`${selectedLetter.slug}-${rule.condition}`}
              >
                <div className="flex flex-wrap items-center gap-2">
                  <span className="rounded-full bg-zinc-100 px-2.5 py-1 text-xs font-semibold text-zinc-600 dark:bg-zinc-800 dark:text-zinc-400">
                    {rule.condition}
                  </span>
                  <p className="text-sm font-light text-zinc-700 dark:text-zinc-300">{rule.sound}</p>
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
                      <div className="flex items-center justify-between gap-3 rounded-card border border-zinc-100/50 bg-zinc-50/50 px-3 py-2 dark:border-zinc-800/20 dark:bg-zinc-950/20" key={word.audioSlug}>
                        <p className="min-w-0 font-display text-sm font-light text-zinc-700 dark:text-zinc-300">
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
      <section className="mb-8 md:mb-10">
        <div className="mb-3 md:mb-6">
          <h2 className="font-display text-xl font-semibold tracking-tight text-zinc-950 dark:text-zinc-50 md:text-2xl">字母表</h2>
          <p className="mt-1 text-sm font-light text-zinc-500 dark:text-zinc-400">点字母听读音，带圆点的可展开发音规则。</p>
        </div>

        <div className="grid grid-cols-4 gap-2 sm:grid-cols-4 sm:gap-4 lg:grid-cols-5">
          {letters.map((letter) => {
            const isUnique = letter.letter === "Ñ";
            const hasRules = Boolean(letter.rules?.length);
            const letterKey: AudioKey = `${letter.slug}:letter`;
            const wordKey: AudioKey = `${letter.slug}:word`;

            return (
              <div key={letter.slug}>
                <div
                  className={`group relative md:hidden ${
                    playingKey === letterKey ? "rounded-card ring-2 ring-brand-400 ring-offset-1 ring-offset-app dark:ring-offset-zinc-950" : ""
                  }`}
                >
                  <button
                    type="button"
                    onClick={() => play(`/audio/phonics/letters/${letter.slug}.mp3`, letterKey)}
                    className={`relative flex aspect-square w-full flex-col items-center justify-center rounded-card border p-1 shadow-sm transition active:scale-[0.97] ${
                      isUnique
                        ? "border-brand-200 bg-brand-50/60 dark:border-brand-900/40 dark:bg-brand-950/20"
                        : "border-zinc-200/60 bg-white/70 dark:border-zinc-800/50 dark:bg-zinc-900/70"
                    }`}
                  >
                    {hasRules ? (
                      <span className="absolute right-1.5 top-1.5 h-1.5 w-1.5 rounded-full bg-brand-400" aria-hidden />
                    ) : null}
                    <span className="font-serif text-[34px] leading-none text-zinc-950 dark:text-zinc-50">{letter.letter}</span>
                    <span className="mt-1 text-[11px] font-medium text-zinc-500 dark:text-zinc-400">{letter.name}</span>
                    {playingKey === letterKey ? (
                      <Volume2 className="absolute bottom-1.5 right-1.5 h-3 w-3 text-brand-500" aria-hidden />
                    ) : null}
                  </button>

                  {hasRules ? (
                    <button
                      type="button"
                      aria-label={`${letter.name} 发音规则`}
                      onClick={(event) => {
                        event.stopPropagation();
                        setSelectedLetter(letter);
                      }}
                      className="absolute bottom-0 right-0 flex h-7 w-7 items-center justify-center rounded-tl-card rounded-br-card text-brand-500 active:bg-brand-50 dark:active:bg-brand-950/40"
                    >
                      <ChevronRight className="h-3.5 w-3.5" aria-hidden />
                    </button>
                  ) : null}
                </div>

                <section
                  className={`group relative hidden md:flex min-h-[196px] flex-col justify-between rounded-hero border p-4 shadow-sm transition duration-300 glass-card card-hover-lift ${
                    isUnique
                      ? "border-brand-100 bg-brand-50/40 text-brand-700 dark:border-brand-900/40 dark:bg-brand-950/10"
                      : "border-zinc-200/50 bg-white/70 text-zinc-900 dark:border-zinc-800/50 dark:bg-zinc-900/70"
                  }`}
                >
                  {isUnique ? (
                    <span className="absolute right-3 top-3 text-[10px] font-semibold text-brand-500">
                      西语独有
                    </span>
                  ) : null}

                  {hasRules ? (
                    <span className="absolute right-3 top-3 h-1.5 w-1.5 rounded-full bg-brand-400" />
                  ) : null}

                  <div>
                    <div className="font-serif text-[56px] leading-none tracking-normal text-zinc-950 dark:text-zinc-50 sm:text-6xl">
                      {letter.letter}
                      <span className="ml-1 text-[0.55em] font-sans font-normal text-zinc-400">{letter.letterLower}</span>
                    </div>
                    <div className={`mt-3 text-sm font-semibold transition-colors duration-300 group-hover:text-brand-500 ${isUnique ? "text-brand-600 dark:text-brand-400" : "text-zinc-500 dark:text-zinc-450"}`}>
                      {letter.name}
                    </div>
                    <div className="mt-3 truncate text-sm font-light text-zinc-650 dark:text-zinc-400">
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
                        className="w-full text-right text-[11px] text-zinc-400 transition hover:text-brand-600 dark:text-zinc-500 dark:hover:text-brand-400"
                        onClick={() => setSelectedLetter(letter)}
                        type="button"
                      >
                        查看发音
                      </button>
                    ) : null}
                  </div>
                </section>
              </div>
            );
          })}
        </div>
      </section>

      {renderRuleModal()}
    </>
  );
}
