"use client";

import { useEffect, useState } from "react";

type SpeakOptions = {
  lang?: string;
  rate?: number;
  onEnd?: () => void;
  onStart?: () => void;
};

function getSpeechSynthesis() {
  if (typeof window === "undefined") {
    return null;
  }

  return window.speechSynthesis ?? null;
}

function findSpanishVoice(voices: SpeechSynthesisVoice[], lang: string) {
  return voices.find((voice) => voice.lang === lang) ?? voices.find((voice) => voice.lang?.startsWith("es")) ?? null;
}

export function speak(text: string, options: SpeakOptions = {}) {
  const synthesis = getSpeechSynthesis();

  if (!synthesis || !text.trim()) {
    return false;
  }

  const lang = options.lang ?? "es-MX";
  const utterance = new SpeechSynthesisUtterance(text);
  const voice = findSpanishVoice(synthesis.getVoices(), lang);

  synthesis.cancel();
  utterance.lang = lang;
  utterance.rate = options.rate ?? 0.9;
  utterance.onstart = options.onStart ?? null;
  utterance.onend = options.onEnd ?? null;
  utterance.onerror = options.onEnd ?? null;

  if (voice) {
    utterance.voice = voice;
  }

  synthesis.speak(utterance);
  return true;
}

export function useSpeechAvailable() {
  const [available, setAvailable] = useState(false);

  useEffect(() => {
    const synthesis = getSpeechSynthesis();

    if (!synthesis) {
      setAvailable(false);
      return;
    }

    const checkVoices = () => {
      setAvailable(synthesis.getVoices().some((voice) => voice.lang?.startsWith("es")));
    };

    checkVoices();
    synthesis.addEventListener("voiceschanged", checkVoices);
    return () => synthesis.removeEventListener("voiceschanged", checkVoices);
  }, []);

  return available;
}
