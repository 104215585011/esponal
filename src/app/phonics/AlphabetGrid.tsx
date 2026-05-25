"use client";

import { useRef, useState } from "react";
import type { AlphabetLetter } from "@/../content/phonics/alphabet";
import { getPlaybackRate } from "@/lib/playback-rate";

type AlphabetGridProps = {
  letters: AlphabetLetter[];
};

type AudioKey = `${string}:letter` | `${string}:word`;

export function AlphabetGrid({ letters }: AlphabetGridProps) {
  const audioRef = useRef<HTMLAudioElement | null>(null);
  const [playingKey, setPlayingKey] = useState<AudioKey | null>(null);

  const play = (src: string, key: AudioKey) => {
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
  };

  return (
    <div className="grid grid-cols-3 gap-3 sm:grid-cols-4 sm:gap-4 lg:grid-cols-5">
      {letters.map((letter) => {
        const isUnique = letter.letter === "Ñ";
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

            <div className="mt-4 grid grid-cols-2 gap-2">
              <button
                aria-label={`播放 ${letter.name}`}
                className={`h-9 rounded-card px-2 text-xs font-medium transition ${
                  playingKey === letterKey
                    ? "bg-gray-100 text-gray-900"
                    : "bg-gray-50 text-gray-700 hover:bg-gray-100"
                }`}
                onClick={() => play(`/audio/phonics/letters/${letter.slug}.mp3`, letterKey)}
                type="button"
              >
                🔊 {letter.name}
              </button>
              <button
                aria-label={`播放 ${letter.example}`}
                className={`h-9 rounded-card px-2 text-xs font-medium transition ${
                  playingKey === wordKey
                    ? "bg-brand-100 text-brand-700"
                    : "bg-brand-50 text-brand-700 hover:bg-brand-100"
                }`}
                onClick={() => play(`/audio/phonics/words/${letter.slug}.mp3`, wordKey)}
                type="button"
              >
                🔊 {letter.example}
              </button>
            </div>
          </section>
        );
      })}
    </div>
  );
}
