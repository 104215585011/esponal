"use client";

import { useEffect, useState } from "react";

const STORAGE_KEY = "esponal:playback-rate";
const DEFAULT_RATE = 1;
const EVENT_NAME = "esponal:playback-rate-change";

export const PLAYBACK_RATES = [0.5, 0.75, 1, 1.25, 1.5] as const;
export type PlaybackRate = (typeof PLAYBACK_RATES)[number];

function normalize(value: unknown): number {
  const numeric = typeof value === "number" ? value : Number(value);
  if (!Number.isFinite(numeric) || numeric <= 0) return DEFAULT_RATE;
  // Clamp to range supported by HTMLMediaElement.playbackRate (0.25–4).
  return Math.min(Math.max(numeric, 0.25), 4);
}

export function getPlaybackRate(): number {
  if (typeof window === "undefined") return DEFAULT_RATE;
  try {
    return normalize(window.localStorage.getItem(STORAGE_KEY));
  } catch {
    return DEFAULT_RATE;
  }
}

export function setPlaybackRate(value: number) {
  if (typeof window === "undefined") return;
  const next = normalize(value);
  try {
    window.localStorage.setItem(STORAGE_KEY, String(next));
  } catch {
    // ignore storage errors (private mode, etc.)
  }
  window.dispatchEvent(new CustomEvent<number>(EVENT_NAME, { detail: next }));
}

export function usePlaybackRate(): [number, (value: number) => void] {
  const [rate, setRate] = useState<number>(DEFAULT_RATE);

  useEffect(() => {
    setRate(getPlaybackRate());
    function handleChange(event: Event) {
      const detail = (event as CustomEvent<number>).detail;
      if (typeof detail === "number") setRate(detail);
    }
    function handleStorage(event: StorageEvent) {
      if (event.key === STORAGE_KEY) setRate(getPlaybackRate());
    }
    window.addEventListener(EVENT_NAME, handleChange);
    window.addEventListener("storage", handleStorage);
    return () => {
      window.removeEventListener(EVENT_NAME, handleChange);
      window.removeEventListener("storage", handleStorage);
    };
  }, []);

  return [rate, setPlaybackRate];
}
