// COURSE-001 change timestamp: 2026-05-13 13:54
"use client";

import { useRef, useState } from "react";

type AudioButtonProps = {
  src: string;
  label: string;
};

export default function AudioButton({ src, label }: AudioButtonProps) {
  const audioRef = useRef<HTMLAudioElement | null>(null);
  const [isPlaying, setIsPlaying] = useState(false);
  const [unavailable, setUnavailable] = useState(false);

  const stop = () => {
    if (!audioRef.current) {
      return;
    }

    audioRef.current.pause();
    audioRef.current.currentTime = 0;
    setIsPlaying(false);
  };

  const play = () => {
    if (!src) {
      return;
    }

    if (unavailable) {
      return;
    }

    if (isPlaying) {
      stop();
      return;
    }

    const audio = new Audio(src);
    audioRef.current = audio;
    audio.addEventListener("ended", () => setIsPlaying(false), { once: true });
    audio.addEventListener(
      "error",
      () => {
        setUnavailable(true);
        setIsPlaying(false);
      },
      { once: true }
    );

    setIsPlaying(true);
    audio.play().catch(() => {
      setUnavailable(true);
      setIsPlaying(false);
    });
  };

  return (
    <button
      aria-label={`播放 ${label}`}
      className={`flex h-11 min-h-[44px] w-11 min-w-[44px] items-center justify-center rounded-full transition ${
        unavailable ? "cursor-not-allowed" : "hover:bg-emerald-50"
      }`}
      onClick={play}
      title={unavailable ? "音频暂时不可用" : `播放 ${label}`}
      type="button"
    >
      <span
        className={`flex w-9 h-9 items-center justify-center rounded-full text-sm font-semibold ${
          unavailable
            ? "bg-gray-50 text-gray-300"
            : isPlaying
              ? "bg-emerald-100 text-emerald-600"
              : "bg-emerald-50 text-emerald-600"
        }`}
      >
        {isPlaying ? "■" : "▶"}
      </span>
    </button>
  );
}
