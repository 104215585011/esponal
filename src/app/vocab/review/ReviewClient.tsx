// Timestamp: 2026-11-18 16:40
"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import ConjugationTable from "@/app/components/vocab/ConjugationTable";
import type { VerbConjugations } from "@/lib/conjugate";
import { speak } from "@/lib/speak";

type ReviewRating = "Again" | "Hard" | "Good" | "Easy";
type ReviewMode = "context" | "cloze" | "audio";

type ReviewWord = {
  id: string;
  itemType?: "word" | "phrase";
  phraseKind?: string | null;
  language?: string;
  lemma: string;
  translation: string;
  partOfSpeech: string | null;
  dictData: unknown;
  srsState: string | null;
  srsDue: string | null;
  srsReps?: number;
  srsLapses?: number;
  encounterCount?: number;
  encounterForm?: string | null;
  articleCue?: {
    article: string;
    singularWithArticle: string;
    pluralWithArticle: string | null;
    maskedWithArticle: string;
    genderLabel: string;
  } | null;
  cloze?: {
    maskedSentence: string;
    answerForm: string;
    fullSentence: string;
    translatedSentence: string;
  } | null;
  cognateHint?: {
    isCognate: boolean;
    isFalseFriend?: boolean;
    patternLabel: string;
    tipZh: string;
  } | null;
  frequencyLevel?: string | null;
  priorityReason?: string | null;
  isLowFrequency?: boolean;
  encounters?: Array<{
    id: string;
    originalSentence: string;
    translatedSentence: string;
  }>;
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
  const [mode, setMode] = useState<ReviewMode>("context");
  const [reviewedLemmas, setReviewedLemmas] = useState<string[]>([]);

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
  const primaryEncounter = currentWord?.encounters?.[0] ?? null;

  useEffect(() => {
    if (mode === "audio" && currentWord && !showBack) {
      const textToSpeak = currentWord.cloze?.fullSentence || currentWord.lemma;
      speak(textToSpeak);
    }
  }, [mode, currentWord, showBack]);

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
        body: JSON.stringify({ rating, itemType: currentWord.itemType ?? "word" })
      });

      if (!response.ok) {
        throw new Error("save failed");
      }

      setReviewedLemmas((prev) =>
        prev.includes(currentWord.lemma) ? prev : [...prev, currentWord.lemma]
      );
      setIndex((value) => value + 1);
      setShowBack(false);
    } catch {
      setError("评分保存失败，请重试。");
    } finally {
      setSubmitting(false);
    }
  }

  async function markKnownOrSkip() {
    if (!currentWord || submitting) return;
    setSubmitting(true);
    setError(null);

    try {
      const response = await fetch("/api/vocab/status", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          id: currentWord.id,
          itemType: currentWord.itemType ?? "word",
          status: "KNOWN"
        })
      });
      if (!response.ok) throw new Error("status update failed");
      setIndex((value) => value + 1);
      setShowBack(false);
    } catch {
      setError("标熟失败，请重试。");
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
    const practiceTargets = reviewedLemmas.slice(0, 5);
    const talkHref =
      practiceTargets.length > 0
        ? `/talk/carlos?words=${encodeURIComponent(practiceTargets.join(","))}`
        : "/talk";

    return (
      <div className="rounded-2xl border border-gray-100 bg-surface p-8 text-center shadow-card">
        <p className="text-lg font-semibold text-gray-900">完成</p>
        <p className="mt-2 text-sm text-gray-500">今天这一轮复习已经清空，可以去对话里用一用或继续积累。</p>
        {practiceTargets.length > 0 ? (
          <div className="mt-4 flex flex-wrap justify-center gap-1.5">
            {practiceTargets.map((term) => (
              <span
                key={term}
                className="rounded-full bg-brand-50 px-3 py-1 text-xs font-semibold text-brand-700"
              >
                {term}
              </span>
            ))}
          </div>
        ) : null}
        <div className="mt-6 flex flex-wrap items-center justify-center gap-3">
          <Link
            className="inline-flex min-h-[44px] items-center justify-center rounded-full bg-brand-500 px-5 text-sm font-semibold text-white"
            href={talkHref}
          >
            去口语里把这几个词用出来 →
          </Link>
          <Link
            className="inline-flex min-h-[44px] items-center justify-center rounded-full border border-gray-200 px-5 text-sm font-semibold text-gray-700"
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

  const displayHeadline =
    currentWord.encounterForm &&
    currentWord.encounterForm.toLowerCase() !== currentWord.lemma.toLowerCase()
      ? `${currentWord.encounterForm}（${currentWord.lemma}）`
      : currentWord.articleCue?.maskedWithArticle ?? currentWord.lemma;

  const canQuickKnown =
    Boolean(currentWord.cognateHint?.isCognate) ||
    Boolean(currentWord.isLowFrequency) ||
    (currentWord.srsLapses ?? 0) >= 2;

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-3 text-sm text-gray-500">
        <div className="flex items-center gap-2">
          <span>待复习 {totalDue} 项</span>
          <span>·</span>
          <span>
            {reviewedCount + 1}/{Math.max(words.length, 1)}
          </span>
        </div>

        <div className="inline-flex rounded-full border border-gray-200 bg-surface p-0.5 text-xs">
          {(
            [
              { key: "context", label: "语境记忆" },
              { key: "cloze", label: "原句挖空" },
              { key: "audio", label: "听音辨义" }
            ] as const
          ).map((opt) => (
            <button
              key={opt.key}
              type="button"
              onClick={() => {
                setMode(opt.key);
                setShowBack(false);
              }}
              className={`rounded-full px-3 py-1 font-medium transition ${
                mode === opt.key ? "bg-brand-500 text-white" : "text-gray-600 hover:text-gray-900"
              }`}
            >
              {opt.label}
            </button>
          ))}
        </div>
      </div>

      <article className="rounded-3xl border border-gray-100 bg-surface p-6 shadow-card">
        <div className="flex flex-wrap items-center gap-2 mb-3">
          {currentWord.itemType === "phrase" ? (
            <span className="rounded-full bg-amber-50 px-2.5 py-0.5 text-xs font-semibold text-amber-700">
              {currentWord.partOfSpeech ?? "实用语块"}
            </span>
          ) : currentWord.partOfSpeech ? (
            <span className="rounded-full bg-gray-100 px-2.5 py-0.5 text-xs font-medium text-gray-600">
              {currentWord.partOfSpeech}
            </span>
          ) : null}
          {currentWord.priorityReason ? (
            <span className="rounded-full bg-brand-50 px-2.5 py-0.5 text-xs font-medium text-brand-700">
              {currentWord.priorityReason}
            </span>
          ) : null}
          {currentWord.frequencyLevel ? (
            <span className="rounded-full bg-indigo-50 px-2 py-0.5 text-xs font-semibold text-indigo-700">
              {currentWord.frequencyLevel}
            </span>
          ) : null}
        </div>

        <div className="flex items-start justify-between gap-4">
          <div className="min-w-0 flex-1">
            {mode === "audio" && !showBack ? (
              <div className="py-2">
                <p className="text-xl font-semibold text-gray-900">🎧 先听发音，想出意思与拼写</p>
                {currentWord.cloze?.translatedSentence ? (
                  <p className="mt-1.5 text-sm text-gray-500">
                    句意提示：{currentWord.cloze.translatedSentence}
                  </p>
                ) : null}
              </div>
            ) : mode === "cloze" && currentWord.cloze ? (
              <div>
                <p className="text-xl font-semibold leading-relaxed text-gray-900">
                  {currentWord.cloze.maskedSentence}
                </p>
                {currentWord.cloze.translatedSentence ? (
                  <p className="mt-2 text-sm text-gray-500">{currentWord.cloze.translatedSentence}</p>
                ) : null}
              </div>
            ) : (
              <div>
                <p className="text-3xl font-semibold text-gray-900">{displayHeadline}</p>
                {currentWord.articleCue ? (
                  <p className="mt-1.5 text-xs text-brand-700">
                    请先心想冠词（el / la）与词性（{currentWord.articleCue.genderLabel}）
                  </p>
                ) : null}
                {primaryEncounter?.originalSentence ? (
                  <p className="mt-3 rounded-xl bg-gray-50 px-3.5 py-2.5 text-sm italic text-gray-700">
                    “{primaryEncounter.originalSentence}”
                  </p>
                ) : null}
              </div>
            )}
          </div>
          <button
            type="button"
            className="inline-flex min-h-[44px] shrink-0 items-center justify-center rounded-full border border-gray-200 px-4 text-sm font-medium text-gray-700"
            onClick={() =>
              speak(
                mode === "audio" && currentWord.cloze?.fullSentence
                  ? currentWord.cloze.fullSentence
                  : currentWord.lemma
              )
            }
          >
            {mode === "audio" && currentWord.cloze ? "听原句" : "朗读"}
          </button>
        </div>

        <div className="mt-6 rounded-2xl bg-gray-50 p-5">
          {showBack ? (
            <div className="space-y-4">
              {currentWord.articleCue ? (
                <div className="rounded-xl bg-brand-50/80 px-3.5 py-2 text-sm font-semibold text-brand-800">
                  {currentWord.articleCue.singularWithArticle}
                  {currentWord.articleCue.pluralWithArticle
                    ? ` → ${currentWord.articleCue.pluralWithArticle}`
                    : ""}
                  <span className="ml-2 text-xs font-normal">
                    （{currentWord.articleCue.genderLabel}）
                  </span>
                </div>
              ) : null}

              <div>
                <p className="text-sm text-gray-400">
                  {mode === "cloze" || mode === "audio"
                    ? `目标词：${currentWord.cloze?.answerForm ?? currentWord.lemma}（原形 ${currentWord.lemma}）`
                    : "释义"}
                </p>
                <p className="mt-2 text-lg font-medium text-gray-900">
                  {meanings[0] ?? currentWord.translation}
                </p>
                {meanings.length > 1 ? (
                  <p className="mt-2 text-sm text-gray-500">{meanings.slice(1).join(" / ")}</p>
                ) : null}
              </div>

              {currentWord.cognateHint ? (
                <p className="rounded-xl bg-indigo-50 px-3.5 py-2 text-xs text-indigo-800">
                  {currentWord.cognateHint.patternLabel} · {currentWord.cognateHint.tipZh}
                </p>
              ) : null}

              {(primaryEncounter?.originalSentence || examples[0]) ? (
                <div className="rounded-2xl bg-surface p-4">
                  <div className="flex items-start justify-between gap-3">
                    <div>
                      <p className="text-sm italic text-gray-700">
                        {primaryEncounter?.originalSentence || examples[0]?.es}
                      </p>
                      <p className="mt-2 text-sm text-gray-500">
                        {primaryEncounter?.translatedSentence || examples[0]?.zh}
                      </p>
                    </div>
                    <button
                      type="button"
                      className="inline-flex min-h-[44px] shrink-0 items-center justify-center rounded-full border border-gray-200 px-4 text-sm font-medium text-gray-700"
                      onClick={() =>
                        speak(primaryEncounter?.originalSentence || examples[0]?.es || currentWord.lemma)
                      }
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
              {mode === "cloze"
                ? "结合整句语境想出空格里要填的词与形态，再翻面确认。"
                : mode === "audio"
                  ? "先听清语音，回忆词义与拼写，再翻面确认。"
                  : "结合原句回忆词义（名词顺带想冠词 el/la），再翻面确认答案。"}
            </div>
          )}
        </div>

        <div className="mt-6 flex flex-wrap items-center gap-3">
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
          {canQuickKnown ? (
            <button
              type="button"
              disabled={submitting}
              onClick={() => void markKnownOrSkip()}
              className="ml-auto inline-flex min-h-[44px] items-center justify-center rounded-full border border-gray-200 px-4 text-xs font-medium text-gray-600 hover:bg-gray-50"
            >
              {currentWord.cognateHint?.isCognate ? "同源秒懂 · 标熟" : "低频暂缓 · 标熟"}
            </button>
          ) : null}
        </div>

        {error ? <p className="mt-4 text-sm text-red-600">{error}</p> : null}
      </article>
    </div>
  );
}
