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
      ? "bg-brand-50 text-brand-700 hover:bg-brand-100"
      : "bg-gray-50 text-gray-700 hover:bg-gray-100";
  const activeClass =
    tone === "brand" ? "bg-brand-100 text-brand-700" : "bg-gray-100 text-gray-900";

  return (
    <button
      className={`inline-flex items-center rounded-full font-medium transition ${
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
      <div className="fixed inset-0 z-50 flex items-end bg-black/30 px-0 sm:items-center sm:justify-center sm:px-4">
        <div className="w-full rounded-t-card bg-white shadow-elevated sm:max-w-lg sm:rounded-card">
          <div className="flex items-start justify-between border-b border-gray-100 px-4 py-4 sm:px-5">
            <div>
              <div className="font-serif text-4xl leading-none text-gray-950">
                {selectedLetter.letter}
                <span className="ml-1 text-[0.55em]">{selectedLetter.letterLower}</span>
              </div>
              <p className="mt-2 text-sm text-gray-500">{selectedLetter.name}</p>
            </div>
            <button
              className="rounded-card px-2 py-1 text-sm text-gray-400 transition hover:bg-gray-50 hover:text-gray-600"
              onClick={() => setSelectedLetter(null)}
              type="button"
            >
              关闭
            </button>
          </div>

          <div className="max-h-[80vh] overflow-y-auto px-4 py-4 sm:px-5">
            {selectedLetter.rules.map((rule, index) => (
              <section
                className={`${index === 0 ? "" : "border-t border-gray-100 pt-4"} ${index === selectedLetter.rules!.length - 1 ? "" : "pb-4"}`}
                key={`${selectedLetter.slug}-${rule.condition}`}
              >
                <div className="flex flex-wrap items-center gap-2">
                  <span className="rounded-full bg-gray-100 px-2 py-1 text-xs text-gray-500">
                    {rule.condition}
                  </span>
                  <p className="text-sm text-gray-700">{rule.sound}</p>
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
                      <div className="flex items-center justify-between gap-3 rounded-card bg-gray-50 px-3 py-2" key={word.audioSlug}>
                        <p className="min-w-0 text-sm text-gray-600">
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
              className={`relative flex min-h-[184px] flex-col justify-between rounded-card border p-4 transition ${
                isUnique
                  ? "border-brand-100 bg-brand-50 text-brand-700"
                  : "border-gray-200 bg-white text-gray-900"
              }`}
              key={letter.slug}
            >
              {isUnique ? (
                <span className="absolute right-3 top-3 text-[10px] font-medium text-brand-500">
                  西语独有
                </span>
              ) : null}

              {hasRules ? (
                <span className="absolute right-3 top-3 h-1.5 w-1.5 bg-brand-400 rounded-full" />
              ) : null}

              <div>
                <div className="font-serif text-[56px] leading-none tracking-normal sm:text-6xl">
                  {letter.letter}
                  <span className="ml-1 text-[0.55em]">{letter.letterLower}</span>
                </div>
                <div className={`mt-3 text-sm ${isUnique ? "text-brand-600" : "text-gray-500"}`}>
                  {letter.name}
                </div>
                <div className="mt-3 truncate text-sm text-gray-700">
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
                    className="w-full text-right text-[11px] text-gray-400 transition hover:text-brand-600"
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
