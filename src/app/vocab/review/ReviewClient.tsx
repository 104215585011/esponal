"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import ConjugationTable from "@/app/components/vocab/ConjugationTable";
import type { VerbConjugations } from "@/lib/conjugate";
import { speak } from "@/lib/speak";

type ReviewRating = "Again" | "Hard" | "Good" | "Easy";

type ReviewWord = {
  id: string;
  lemma: string;
  translation: string;
  partOfSpeech: string | null;
  dictData: unknown;
  srsState: string | null;
  srsDue: string | null;
};

type ReviewResponse = {
  totalDue: number;
  dueWords: ReviewWord[];
};

const ratings: ReviewRating[] = ["Again", "Hard", "Good", "Easy"];

const getMeanings = (dictData: unknown) => {
  if (!dictData || typeof dictData !== "object") return [];
  const meanings = (dictData as { meanings?: unknown }).meanings;
  return Array.isArray(meanings)
    ? meanings.filter((item): item is string => typeof item === "string")
    : [];
};

const getExamples = (dictData: unknown) => {
  if (!dictData || typeof dictData !== "object") return [];
  const examples = (dictData as { examples?: unknown }).examples;
  if (!Array.isArray(examples)) return [];

  return examples.filter(
    (item): item is { es: string; zh: string } =>
      typeof item === "object" &&
      item !== null &&
      typeof (item as { es?: unknown }).es === "string" &&
      typeof (item as { zh?: unknown }).zh === "string"
  );
};

const getConjugations = (dictData: unknown) => {
  if (!dictData || typeof dictData !== "object") return undefined;
  const conjugations = (dictData as { conjugations?: unknown }).conjugations;
  return conjugations && typeof conjugations === "object"
    ? (conjugations as VerbConjugations)
    : undefined;
};

export default function ReviewClient() {
  const [words, setWords] = useState<ReviewWord[]>([]);
  const [totalDue, setTotalDue] = useState(0);
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [index, setIndex] = useState(0);
  const [showBack, setShowBack] = useState(false);

  useEffect(() => {
    let cancelled = false;

    async function loadReviewWords() {
      try {
        const response = await fetch("/api/vocab/review", { cache: "no-store" });
        if (!response.ok) {
          throw new Error("load failed");
        }

        const data = (await response.json()) as ReviewResponse;
        if (cancelled) return;
        setWords(data.dueWords);
        setTotalDue(data.totalDue);
      } catch {
        if (!cancelled) {
          setError("复习列表加载失败，请稍后再试。");
        }
      } finally {
        if (!cancelled) {
          setLoading(false);
        }
      }
    }

    void loadReviewWords();

    return () => {
      cancelled = true;
    };
  }, []);

  const currentWord = words[index] ?? null;
  const reviewedCount = Math.min(index, words.length);
  const meanings = currentWord ? getMeanings(currentWord.dictData) : [];
  const examples = currentWord ? getExamples(currentWord.dictData) : [];
  const conjugations = currentWord ? getConjugations(currentWord.dictData) : undefined;

  async function submitRating(rating: ReviewRating) {
    if (!currentWord || submitting) return;

    setSubmitting(true);
    setError(null);

    try {
      const response = await fetch(`/api/vocab/review/${currentWord.id}`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json"
        },
        body: JSON.stringify({ rating })
      });

      if (!response.ok) {
        throw new Error("save failed");
      }

      setIndex((value) => value + 1);
      setShowBack(false);
    } catch {
      setError("评分保存失败，请重试。");
    } finally {
      setSubmitting(false);
    }
  }

  if (loading) {
    return (
      <div className="rounded-2xl border border-gray-100 bg-surface p-6 text-sm text-gray-500">
        正在加载复习卡片...
      </div>
    );
  }

  if (error && words.length === 0) {
    return (
      <div className="rounded-2xl border border-red-100 bg-red-50 p-6 text-sm text-red-700">
        {error}
      </div>
    );
  }

  if (!currentWord) {
    return (
      <div className="rounded-2xl border border-gray-100 bg-surface p-8 text-center shadow-card">
        <p className="text-lg font-semibold text-gray-900">完成</p>
        <p className="mt-2 text-sm text-gray-500">今天这一轮复习已经清空，可以回语料库继续积累。</p>
        <div className="mt-6 flex items-center justify-center gap-3">
          <Link
            className="inline-flex min-h-[44px] items-center justify-center rounded-full bg-brand-500 px-5 text-sm font-semibold text-white"
            href="/vocab"
          >
            回到语料库
          </Link>
          <Link
            className="inline-flex min-h-[44px] items-center justify-center rounded-full border border-gray-200 px-5 text-sm font-semibold text-gray-700"
            href="/vocab/review"
          >
            再看一轮
          </Link>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between text-sm text-gray-500">
        <span>待复习 {totalDue} 词</span>
        <span>
          {reviewedCount + 1}/{Math.max(words.length, 1)}
        </span>
      </div>

      <article className="rounded-3xl border border-gray-100 bg-surface p-6 shadow-card">
        <div className="flex items-start justify-between gap-4">
          <div>
            <p className="text-3xl font-semibold text-gray-900">{currentWord.lemma}</p>
            {currentWord.partOfSpeech ? (
              <p className="mt-2 text-sm text-gray-500">{currentWord.partOfSpeech}</p>
            ) : null}
          </div>
          <button
            type="button"
            className="inline-flex min-h-[44px] items-center justify-center rounded-full border border-gray-200 px-4 text-sm font-medium text-gray-700"
            onClick={() => speak(currentWord.lemma)}
          >
            朗读
          </button>
        </div>

        <div className="mt-6 rounded-2xl bg-gray-50 p-5">
          {showBack ? (
            <div className="space-y-4">
              <div>
                <p className="text-sm text-gray-400">释义</p>
                <p className="mt-2 text-lg font-medium text-gray-900">
                  {meanings[0] ?? currentWord.translation}
                </p>
                {meanings.length > 1 ? (
                  <p className="mt-2 text-sm text-gray-500">{meanings.slice(1).join(" / ")}</p>
                ) : null}
              </div>

              {examples[0] ? (
                <div className="rounded-2xl bg-surface p-4">
                  <div className="flex items-start justify-between gap-3">
                    <div>
                      <p className="text-sm italic text-gray-700">{examples[0].es}</p>
                      <p className="mt-2 text-sm text-gray-500">{examples[0].zh}</p>
                    </div>
                    <button
                      type="button"
                      className="inline-flex min-h-[44px] shrink-0 items-center justify-center rounded-full border border-gray-200 px-4 text-sm font-medium text-gray-700"
                      onClick={() => speak(examples[0].es)}
                    >
                      例句朗读
                    </button>
                  </div>
                </div>
              ) : null}

              {conjugations ? <ConjugationTable conjugations={conjugations} /> : null}
            </div>
          ) : (
            <div className="py-10 text-center text-sm text-gray-500">
              先回忆这个词的意思，再翻面确认答案。
            </div>
          )}
        </div>

        <div className="mt-6 flex flex-wrap gap-3">
          <button
            type="button"
            className="inline-flex min-h-[44px] items-center justify-center rounded-full border border-gray-200 px-5 text-sm font-semibold text-gray-700"
            onClick={() => setShowBack((value) => !value)}
          >
            {showBack ? "收起答案" : "翻面"}
          </button>
          {ratings.map((rating) => (
            <button
              key={rating}
              type="button"
              className="inline-flex min-h-[44px] items-center justify-center rounded-full bg-brand-500 px-5 text-sm font-semibold text-white disabled:opacity-60"
              disabled={!showBack || submitting}
              onClick={() => void submitRating(rating)}
            >
              {rating}
            </button>
          ))}
        </div>

        {error ? <p className="mt-4 text-sm text-red-600">{error}</p> : null}
      </article>
    </div>
  );
}
