"use client";

type SpeakOptions = {
  rate?: number;
  onEnd?: () => void;
  onStart?: () => void;
};

let currentAudio: HTMLAudioElement | null = null;

export function speak(text: string, options: SpeakOptions = {}) {
  if (typeof window === "undefined" || !text.trim()) {
    return false;
  }

  if (currentAudio) {
    currentAudio.pause();
    currentAudio.currentTime = 0;
    currentAudio = null;
  }

  const audio = new Audio(`/api/tts?text=${encodeURIComponent(text)}`);
  audio.playbackRate = options.rate ?? 1;
  currentAudio = audio;

  audio.addEventListener("play", () => options.onStart?.(), { once: true });
  audio.addEventListener(
    "ended",
    () => {
      if (currentAudio === audio) {
        currentAudio = null;
      }
      options.onEnd?.();
    },
    { once: true }
  );
  audio.addEventListener(
    "error",
    () => {
      if (currentAudio === audio) {
        currentAudio = null;
      }
      options.onEnd?.();
    },
    { once: true }
  );

  audio.play().catch(() => {
    if (currentAudio === audio) {
      currentAudio = null;
    }
    options.onEnd?.();
  });

  return true;
}

export function useSpeechAvailable() {
  return true;
}
