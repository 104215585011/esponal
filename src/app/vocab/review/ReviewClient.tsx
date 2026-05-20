"use client";

import { useCallback, useEffect, useState } from "react";
import { speak } from "@/lib/speak";

type DueWord = {
  id: string;
  lemma: string;
  translation: string;
  partOfSpeech: string | null;
  dictData: unknown;
  srsDue: string | null;
  srsState: string | null;
};

type ReviewClientProps = {
  initialWords: DueWord[];
  totalDue: number;
};

type Rating = "Again" | "Hard" | "Good" | "Easy";

function getMeanings(dictData: unknown): string[] {
  if (!dictData || typeof dictData !== "object") return [];
  const m = (dictData as { meanings?: unknown }).meanings;
  return Array.isArray(m) ? (m.filter((x): x is string => typeof x === "string")) : [];
}

function getExample(dictData: unknown): { es: string; zh: string } | null {
  if (!dictData || typeof dictData !== "object") return null;
  const examples = (dictData as { examples?: unknown }).examples;
  if (!Array.isArray(examples) || examples.length === 0) return null;
  const first = examples[0] as { es?: string; zh?: string };
  if (typeof first?.es === "string" && typeof first?.zh === "string") {
    return { es: first.es, zh: first.zh };
  }
  return null;
}

const RATING_CONFIG: { rating: Rating; label: string; color: string }[] = [
  { rating: "Again", label: "又忘了", color: "text-red-600 hover:bg-red-50 border-red-200" },
  { rating: "Hard", label: "难", color: "text-orange-500 hover:bg-orange-50 border-orange-200" },
  { rating: "Good", label: "记得", color: "text-brand-600 hover:bg-brand-50 border-brand-200" },
  { rating: "Easy", label: "很熟", color: "text-green-600 hover:bg-green-50 border-green-200" }
];

export function ReviewClient({ initialWords, totalDue }: ReviewClientProps) {
  const [queue, setQueue] = useState<DueWord[]>(initialWords);
  const [currentIndex, setCurrentIndex] = useState(0);
  const [showBack, setShowBack] = useState(false);
  const [doneCount, setDoneCount] = useState(0);
  const [speaking, setSpeaking] = useState(false);

  const current = queue[currentIndex];
  const isDone = currentIndex >= queue.length;

  const handleSpeak = useCallback(() => {
    if (!current) return;
    speak(current.lemma, {
      rate: 0.9,
      onStart: () => setSpeaking(true),
      onEnd: () => setSpeaking(false)
    });
  }, [current]);

  useEffect(() => {
    setSpeaking(false);
    setShowBack(false);
  }, [currentIndex]);

  async function handleRate(rating: Rating) {
    if (!current) return;

    try {
      await fetch(`/api/vocab/review/${current.id}`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ rating })
      });
    } catch {
      // Best-effort; don't block the user
    }

    setDoneCount((n) => n + 1);
    setCurrentIndex((i) => i + 1);
  }

  if (isDone) {
    return (
      <div className="flex flex-col items-center justify-center gap-6 py-20 text-center">
        <div className="text-5xl">🎉</div>
        <h2 className="text-2xl font-bold text-gray-900">完成！</h2>
        <p className="text-sm text-gray-500">
          今日复习 {doneCount} 词
        </p>
        <a
          href="/vocab"
          className="mt-2 inline-block rounded-lg bg-brand-500 px-6 py-2.5 text-sm font-medium text-white hover:bg-brand-600"
        >
          回到词库 →
        </a>
      </div>
    );
  }

  const meanings = getMeanings(current.dictData);
  const example = getExample(current.dictData);

  return (
    <div className="mx-auto max-w-md">
      {/* Progress */}
      <div className="mb-6 flex items-center justify-between text-sm text-gray-400">
        <span>今日复习 {currentIndex + 1}/{queue.length}</span>
        <span>共 {totalDue} 词到期</span>
      </div>

      {/* Card */}
      <div className="rounded-2xl border border-black/5 bg-surface p-8 shadow-card">
        {/* Front */}
        <div className="flex items-center gap-3">
          <p className="text-3xl font-bold text-gray-900 font-serif">{current.lemma}</p>
          {current.partOfSpeech ? (
            <span className="rounded bg-gray-100 px-1.5 py-0.5 text-[11px] text-gray-500">
              {current.partOfSpeech}
            </span>
          ) : null}
          <button
            aria-label={`Play pronunciation for ${current.lemma}`}
            className={`flex h-7 w-7 items-center justify-center rounded-full border text-xs transition ${
              speaking
                ? "animate-pulse border-brand-500 bg-brand-50 text-brand-600"
                : "border-gray-200 text-gray-400 hover:border-brand-500 hover:text-brand-600"
            }`}
            onClick={handleSpeak}
            type="button"
          >
            {">"}
          </button>
        </div>

        {/* Back */}
        {showBack ? (
          <div className="mt-6 space-y-4">
            {meanings.length > 0 ? (
              <ol className="space-y-1 pl-4 text-sm text-gray-700" style={{ listStyleType: "decimal" }}>
                {meanings.map((m) => (
                  <li key={m}>{m}</li>
                ))}
              </ol>
            ) : (
              <p className="text-sm text-gray-700">{current.translation}</p>
            )}

            {example ? (
              <div className="rounded-lg bg-gray-50 px-3 py-2">
                <p className="text-xs italic text-gray-600">{example.es}</p>
                <p className="mt-0.5 text-xs text-gray-400">{example.zh}</p>
              </div>
            ) : null}

            {/* Rating buttons */}
            <div className="mt-6 grid grid-cols-4 gap-2">
              {RATING_CONFIG.map(({ rating, label, color }) => (
                <button
                  key={rating}
                  className={`rounded-lg border py-2 text-xs font-medium transition ${color}`}
                  onClick={() => void handleRate(rating)}
                  type="button"
                >
                  {label}
                </button>
              ))}
            </div>
          </div>
        ) : (
          <button
            className="mt-8 w-full rounded-lg bg-gray-100 py-2.5 text-sm text-gray-600 hover:bg-gray-200"
            onClick={() => setShowBack(true)}
            type="button"
          >
            显示答案
          </button>
        )}
      </div>
    </div>
  );
}
