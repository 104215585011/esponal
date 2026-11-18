// Timestamp: 2026-11-18 17:38
"use client";

import Link from "next/link";
import { useCallback, useEffect, useState } from "react";
import ConjugationTable from "@/app/components/vocab/ConjugationTable";
import type { VerbConjugations } from "@/lib/conjugate";
import { speak } from "@/lib/speak";

type ReviewRating = "Again" | "Hard" | "Good" | "Easy";
type ReviewMode = "context" | "cloze" | "audio";
type QueueMode = "recent" | "due" | "quick5";
type ScreenView = "hub" | "session" | "starter";

type ReviewWord = {
  id: string;
  itemType?: "word" | "phrase";
  phraseKind?: string | null;
  queueBucket?: "recent" | "due" | "new";
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

type ReviewCounts = {
  recent: number;
  due: number;
  quick5: number;
  unstartedNew: number;
};

type ReviewResponse = {
  totalDue: number;
  dueWords: ReviewWord[];
  mode?: string;
  counts?: ReviewCounts;
};

type StarterItem = {
  id: string;
  language: string;
  lemma: string;
  displayForm: string;
  kind: "word" | "phrase";
  posLabel: string;
  translationZh: string;
  exampleEs: string;
  exampleZh: string;
  noteZh: string;
  inVocab?: boolean;
  status?: string | null;
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
  const [view, setView] = useState<ScreenView>("hub");
  const [queueMode, setQueueMode] = useState<QueueMode>("quick5");
  const [counts, setCounts] = useState<ReviewCounts>({
    recent: 0,
    due: 0,
    quick5: 0,
    unstartedNew: 0
  });
  const [words, setWords] = useState<ReviewWord[]>([]);
  const [totalDue, setTotalDue] = useState(0);
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [index, setIndex] = useState(0);
  const [showBack, setShowBack] = useState(false);
  const [recallActive, setRecallActive] = useState(true);
  const [mode, setMode] = useState<ReviewMode>("context");
  const [reviewedLemmas, setReviewedLemmas] = useState<string[]>([]);

  const [starterItems, setStarterItems] = useState<StarterItem[]>([]);
  const [starterIdx, setStarterIdx] = useState(0);
  const [starterMsg, setStarterMsg] = useState<string | null>(null);

  const loadCountsAndStarter = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const [revRes, starterRes] = await Promise.all([
        fetch("/api/vocab/review?mode=all", { cache: "no-store" }),
        fetch("/api/vocab/starter?lang=es", { cache: "no-store" })
      ]);
      if (!revRes.ok) throw new Error("load failed");
      const revData = (await revRes.json()) as ReviewResponse;
      if (revData.counts) {
        setCounts(revData.counts);
      } else {
        const len = revData.dueWords?.length ?? 0;
        setCounts({ recent: 0, due: len, quick5: Math.min(5, len), unstartedNew: 0 });
      }
      setTotalDue(revData.totalDue ?? 0);

      if (starterRes.ok) {
        const stData = (await starterRes.json()) as { items?: StarterItem[] };
        setStarterItems(stData.items ?? []);
      }
    } catch {
      setError("复习信息加载失败，请稍后再试。");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void loadCountsAndStarter();
  }, [loadCountsAndStarter]);

  const startSession = async (chosen: QueueMode) => {
    setLoading(true);
    setError(null);
    setQueueMode(chosen);
    setIndex(0);
    setShowBack(false);
    setRecallActive(chosen !== "recent");
    setReviewedLemmas([]);
    setView("session");

    try {
      const response = await fetch(`/api/vocab/review?mode=${chosen}`, { cache: "no-store" });
      if (!response.ok) throw new Error("load failed");
      const data = (await response.json()) as ReviewResponse;
      setWords(data.dueWords ?? []);
      setTotalDue(data.totalDue ?? 0);
      if (data.counts) setCounts(data.counts);
    } catch {
      setError("复习队列加载失败，请稍后再试。");
    } finally {
      setLoading(false);
    }
  };

  const currentWord = words[index] ?? null;
  const reviewedCount = Math.min(index, words.length);
  const meanings = currentWord ? getMeanings(currentWord.dictData) : [];
  const examples = currentWord ? getExamples(currentWord.dictData) : [];
  const conjugations = currentWord ? getConjugations(currentWord.dictData) : undefined;
  const primaryEncounter = currentWord?.encounters?.[0] ?? null;

  useEffect(() => {
    if (view === "session" && mode === "audio" && recallActive && currentWord && !showBack) {
      const textToSpeak = currentWord.cloze?.fullSentence || currentWord.lemma;
      speak(textToSpeak);
    }
  }, [view, mode, recallActive, currentWord, showBack]);

  async function submitRating(rating: ReviewRating) {
    if (!currentWord || submitting) return;

    setSubmitting(true);
    setError(null);

    try {
      const response = await fetch(`/api/vocab/review/${currentWord.id}`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ rating, itemType: currentWord.itemType ?? "word" })
      });

      if (!response.ok) throw new Error("save failed");

      setReviewedLemmas((prev) =>
        prev.includes(currentWord.lemma) ? prev : [...prev, currentWord.lemma]
      );
      setIndex((value) => value + 1);
      setShowBack(false);
      setRecallActive(queueMode !== "recent");
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
      setRecallActive(queueMode !== "recent");
    } catch {
      setError("标熟失败，请重试。");
    } finally {
      setSubmitting(false);
    }
  }

  async function handleStarterSave(item: StarterItem, status: "NEW" | "KNOWN") {
    setSubmitting(true);
    setStarterMsg(null);
    try {
      if (item.kind === "phrase") {
        await fetch("/api/vocab/phrase/add", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            lemma: item.lemma,
            kind: "phrase",
            translationZh: item.translationZh,
            explanationZh: item.noteZh,
            data: {
              meanings: [item.translationZh],
              examples: [{ es: item.exampleEs, zh: item.exampleZh }],
              source: { sentence: item.exampleEs, type: "starter" }
            }
          })
        });
      } else {
        await fetch("/api/vocab/add", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            word: item.lemma,
            lemma: item.lemma,
            translation: item.translationZh,
            form: item.lemma,
            status,
            partOfSpeech: item.posLabel,
            sourceType: "course",
            sourceUrl: "/vocab/review",
            originalSentence: item.exampleEs,
            translatedSentence: item.exampleZh,
            dictData: {
              meanings: [item.translationZh],
              examples: [{ es: item.exampleEs, zh: item.exampleZh }]
            }
          })
        });
      }
      setStarterMsg(status === "KNOWN" ? "已标为早就认识" : "已加入待复习队列");
      setStarterItems((prev) =>
        prev.map((x) => (x.id === item.id ? { ...x, inVocab: true, status } : x))
      );
      setTimeout(() => {
        setStarterMsg(null);
        setStarterIdx((i) => i + 1);
      }, 350);
    } catch {
      setStarterMsg("保存失败，请重试");
    } finally {
      setSubmitting(false);
    }
  }

  if (loading) {
    return (
      <div className="rounded-2xl border border-gray-100 bg-surface p-6 text-sm text-gray-500">
        正在准备学习入口...
      </div>
    );
  }

  if (view === "hub") {
    return (
      <div className="space-y-4">
        <button
          type="button"
          onClick={() => void startSession("quick5")}
          disabled={counts.quick5 === 0}
          className="w-full rounded-3xl border border-brand-200/80 bg-brand-50/60 p-6 text-left transition hover:border-brand-300 disabled:opacity-50"
        >
          <div className="flex items-center justify-between gap-3">
            <span className="inline-flex items-center rounded-full bg-brand-500 px-3 py-1 text-xs font-semibold text-white">
              零碎时间首选 · 共 {counts.quick5} 张
            </span>
            <span className="text-sm font-semibold text-brand-700">开始 →</span>
          </div>
          <h2 className="mt-3 text-xl font-bold text-gray-900">练 5 分钟</h2>
          <p className="mt-1.5 text-sm text-gray-600">
            从「最近遇到」取 2 条 +「到期复习」取 3 条（同一词只出一次），不够时顺手补齐 5 张，刷完就收工。
          </p>
        </button>

        <div className="grid gap-4 sm:grid-cols-2">
          <button
            type="button"
            onClick={() => void startSession("recent")}
            disabled={counts.recent === 0}
            className="rounded-2xl border border-gray-200 bg-surface p-5 text-left transition hover:border-indigo-300 disabled:opacity-50"
          >
            <div className="flex items-center justify-between gap-2">
              <span className="text-xs font-semibold text-indigo-700">今天 / 昨天收藏</span>
              <span className="rounded-full bg-indigo-50 px-2.5 py-0.5 text-xs font-semibold text-indigo-700">
                {counts.recent} 条
              </span>
            </div>
            <h3 className="mt-2.5 text-lg font-bold text-gray-900">最近遇到</h3>
            <p className="mt-1.5 text-xs leading-relaxed text-gray-500">
              先看当时遇见的词形、原句和读音轻松过一遍；想记一记再点「遮住答案回想一次」，不把刚看答案误当记住。
            </p>
          </button>

          <button
            type="button"
            onClick={() => void startSession("due")}
            disabled={counts.due === 0}
            className="rounded-2xl border border-gray-200 bg-surface p-5 text-left transition hover:border-brand-300 disabled:opacity-50"
          >
            <div className="flex items-center justify-between gap-2">
              <span className="text-xs font-semibold text-gray-600">按计划间隔回想</span>
              <span className="rounded-full bg-gray-100 px-2.5 py-0.5 text-xs font-semibold text-gray-700">
                {counts.due} 条到期
              </span>
            </div>
            <h3 className="mt-2.5 text-lg font-bold text-gray-900">到期复习</h3>
            <p className="mt-1.5 text-xs leading-relaxed text-gray-500">
              按现有间隔复习计划回想之前学过的词和语块，答完再安排下次时间。
            </p>
          </button>
        </div>

        {starterItems.length > 0 ? (
          <button
            type="button"
            onClick={() => {
              setStarterIdx(0);
              setStarterMsg(null);
              setView("starter");
            }}
            className="w-full rounded-2xl border border-gray-200 bg-surface p-5 text-left transition hover:border-amber-300"
          >
            <div className="flex items-center justify-between gap-3">
              <div>
                <p className="text-xs font-semibold text-amber-700">
                  高频骨架词扫盲 · 共 {starterItems.length} 组
                </p>
                <p className="mt-1 text-base font-bold text-gray-900">
                  起步快速扫一遍高频词（hay / puede / tiene que …）
                </p>
                <p className="mt-1 text-xs text-gray-500">
                  不用死背：看看中文意思、听听读音、读一句短例句混个眼熟，以后在文章视频里遇到自然会熟。
                </p>
              </div>
              <span className="shrink-0 text-sm font-semibold text-gray-600">扫一遍 →</span>
            </div>
          </button>
        ) : null}

        {error ? <p className="text-sm text-red-600">{error}</p> : null}
      </div>
    );
  }

  if (view === "starter") {
    const item = starterItems[starterIdx] ?? null;
    return (
      <div className="space-y-6">
        <div className="flex items-center justify-between text-sm text-gray-500">
          <button
            type="button"
            onClick={() => setView("hub")}
            className="font-medium text-gray-600 hover:text-gray-900"
          >
            ← 返回复习入口
          </button>
          <span>
            {Math.min(starterIdx + 1, starterItems.length)} / {starterItems.length}
          </span>
        </div>

        {!item ? (
          <div className="rounded-3xl border border-gray-100 bg-surface p-8 text-center shadow-card">
            <p className="text-lg font-bold text-gray-900">这一轮高频骨架词扫完啦</p>
            <p className="mt-2 text-sm text-gray-500">
              第一轮认个脸熟、耳朵有印象就够了。接下来去看看视频或短文，很快就能撞见它们。
            </p>
            <div className="mt-6 flex justify-center gap-3">
              <button
                type="button"
                onClick={() => setView("hub")}
                className="inline-flex min-h-[44px] items-center justify-center rounded-full bg-brand-500 px-5 text-sm font-semibold text-white"
              >
                回复习首页
              </button>
              <Link
                href="/lectura"
                className="inline-flex min-h-[44px] items-center justify-center rounded-full border border-gray-200 px-5 text-sm font-semibold text-gray-700"
              >
                去读一篇短文
              </Link>
            </div>
          </div>
        ) : (
          <article className="rounded-3xl border border-gray-100 bg-surface p-6 shadow-card space-y-5">
            <div className="flex items-start justify-between gap-4">
              <div>
                <span className="inline-flex rounded-full bg-amber-50 px-2.5 py-0.5 text-xs font-semibold text-amber-700">
                  {item.posLabel}
                </span>
                <p className="mt-2.5 text-3xl font-bold text-gray-900">{item.displayForm}</p>
                <p className="mt-2 text-xl font-semibold text-brand-700">{item.translationZh}</p>
              </div>
              <button
                type="button"
                onClick={() => speak(item.lemma)}
                className="inline-flex min-h-[44px] shrink-0 items-center justify-center rounded-full border border-gray-200 px-4 text-sm font-medium text-gray-700"
              >
                听发音
              </button>
            </div>

            <div className="rounded-2xl bg-gray-50 p-4 space-y-2">
              <div className="flex items-start justify-between gap-3">
                <div>
                  <p className="text-base font-medium text-gray-900">{item.exampleEs}</p>
                  <p className="mt-1 text-sm text-gray-600">{item.exampleZh}</p>
                </div>
                <button
                  type="button"
                  onClick={() => speak(item.exampleEs)}
                  className="inline-flex min-h-[38px] shrink-0 items-center justify-center rounded-full border border-gray-200 bg-surface px-3 text-xs font-medium text-gray-700"
                >
                  听例句
                </button>
              </div>
              <p className="text-xs text-gray-500 pt-1">{item.noteZh}</p>
            </div>

            {starterMsg ? <p className="text-xs font-semibold text-brand-700">{starterMsg}</p> : null}

            <div className="flex flex-wrap items-center gap-3">
              <button
                type="button"
                onClick={() => setStarterIdx((i) => i + 1)}
                className="inline-flex min-h-[44px] items-center justify-center rounded-full bg-brand-500 px-5 text-sm font-semibold text-white"
              >
                混个眼熟了 · 下一个 →
              </button>
              <button
                type="button"
                disabled={submitting}
                onClick={() => void handleStarterSave(item, "NEW")}
                className="inline-flex min-h-[44px] items-center justify-center rounded-full border border-gray-200 px-4 text-sm font-medium text-gray-700"
              >
                {item.inVocab ? "已在词库" : "想重点记 · 加入复习"}
              </button>
              {item.kind === "word" ? (
                <button
                  type="button"
                  disabled={submitting}
                  onClick={() => void handleStarterSave(item, "KNOWN")}
                  className="ml-auto inline-flex min-h-[44px] items-center justify-center rounded-full px-3 text-xs font-medium text-gray-500 hover:text-gray-800"
                >
                  早就会了
                </button>
              ) : null}
            </div>
          </article>
        )}
      </div>
    );
  }

  if (error && words.length === 0) {
    return (
      <div className="space-y-4">
        <button
          type="button"
          onClick={() => setView("hub")}
          className="text-sm font-medium text-gray-600 hover:text-gray-900"
        >
          ← 返回复习入口
        </button>
        <div className="rounded-2xl border border-red-100 bg-red-50 p-6 text-sm text-red-700">
          {error}
        </div>
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
        <p className="mt-2 text-sm text-gray-500">
          {queueMode === "quick5"
            ? "这 5 分钟短练已完成，节奏刚刚好。"
            : queueMode === "recent"
              ? "最近遇到的词已经过完一遍，材料里的印象更稳了。"
              : "这批到期复习已经完成，间隔时间已重新安排。"}
        </p>
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
          <button
            type="button"
            onClick={() => {
              setView("hub");
              void loadCountsAndStarter();
            }}
            className="inline-flex min-h-[44px] items-center justify-center rounded-full border border-gray-200 px-5 text-sm font-semibold text-gray-700"
          >
            回复习入口
          </button>
          <Link
            className="inline-flex min-h-[44px] items-center justify-center rounded-full border border-gray-200 px-5 text-sm font-semibold text-gray-700"
            href="/vocab"
          >
            回到语料库
          </Link>
        </div>
      </div>
    );
  }

  const displayHeadline =
    currentWord.encounterForm &&
    currentWord.encounterForm.toLowerCase() !== currentWord.lemma.toLowerCase()
      ? `${currentWord.encounterForm}（原形 ${currentWord.lemma}）`
      : currentWord.articleCue?.maskedWithArticle ?? currentWord.lemma;

  const canQuickKnown =
    Boolean(currentWord.cognateHint?.isCognate) ||
    Boolean(currentWord.isLowFrequency) ||
    (currentWord.srsLapses ?? 0) >= 2;

  const isBrowseFirstRecent = !recallActive;

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-3 text-sm text-gray-500">
        <div className="flex items-center gap-3">
          <button
            type="button"
            onClick={() => {
              setView("hub");
              void loadCountsAndStarter();
            }}
            className="font-medium text-gray-600 hover:text-gray-900"
          >
            ← 入口
          </button>
          <span>·</span>
          <span>
            {queueMode === "recent"
              ? "最近遇到"
              : queueMode === "due"
                ? "到期复习"
                : "练 5 分钟"}
          </span>
          <span>·</span>
          <span>
            {reviewedCount + 1}/{Math.max(words.length, 1)}
          </span>
        </div>

        {recallActive ? (
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
        ) : (
          <span className="rounded-full bg-indigo-50 px-3 py-1 text-xs font-semibold text-indigo-700">
            轻松回看（不更新间隔）
          </span>
        )}
      </div>

      <article className="rounded-3xl border border-gray-100 bg-surface p-6 shadow-card">
        <div className="mb-3 flex flex-wrap items-center gap-2">
          {currentWord.queueBucket === "recent" ? (
            <span className="rounded-full bg-indigo-50 px-2.5 py-0.5 text-xs font-semibold text-indigo-700">
              最近遇到
            </span>
          ) : null}
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
            <span className="rounded-full bg-gray-100 px-2 py-0.5 text-xs font-semibold text-gray-700">
              {currentWord.frequencyLevel}
            </span>
          ) : null}
        </div>

        <div className="flex items-start justify-between gap-4">
          <div className="min-w-0 flex-1">
            {isBrowseFirstRecent ? (
              <div>
                <p className="text-3xl font-semibold text-gray-900">
                  {currentWord.encounterForm ?? currentWord.lemma}
                </p>
                {currentWord.encounterForm &&
                currentWord.encounterForm.toLowerCase() !== currentWord.lemma.toLowerCase() ? (
                  <p className="mt-1 text-xs text-gray-500">词典原形：{currentWord.lemma}</p>
                ) : null}
                {primaryEncounter?.originalSentence ? (
                  <p className="mt-3 rounded-xl bg-gray-50 px-3.5 py-2.5 text-sm italic text-gray-700">
                    “{primaryEncounter.originalSentence}”
                  </p>
                ) : null}
              </div>
            ) : mode === "audio" && !showBack ? (
              <div className="py-2">
                <p className="text-xl font-semibold text-gray-900">先听发音，想出意思与拼写</p>
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
                primaryEncounter?.originalSentence ||
                  (mode === "audio" && currentWord.cloze?.fullSentence) ||
                  currentWord.lemma
              )
            }
          >
            {primaryEncounter?.originalSentence || (mode === "audio" && currentWord.cloze)
              ? "听原句"
              : "朗读"}
          </button>
        </div>

        <div className="mt-6 rounded-2xl bg-gray-50 p-5">
          {isBrowseFirstRecent || showBack ? (
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
                  {recallActive && (mode === "cloze" || mode === "audio")
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

              {(primaryEncounter?.translatedSentence || examples[0]) ? (
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
                  : "先自己试着回想词义（名词顺带想冠词 el/la），再翻面确认答案。"}
            </div>
          )}
        </div>

        {isBrowseFirstRecent ? (
          <div className="mt-6 flex flex-wrap items-center gap-3">
            <button
              type="button"
              onClick={() => {
                setIndex((value) => value + 1);
                setShowBack(false);
                setRecallActive(false);
              }}
              className="inline-flex min-h-[44px] items-center justify-center rounded-full border border-gray-200 px-5 text-sm font-semibold text-gray-700 hover:bg-gray-50"
            >
              过一遍，下一条 →
            </button>
            <button
              type="button"
              onClick={() => {
                setRecallActive(true);
                setShowBack(false);
              }}
              className="inline-flex min-h-[44px] items-center justify-center rounded-full bg-brand-500 px-5 text-sm font-semibold text-white hover:bg-brand-600"
            >
              遮住答案 · 试着回想一次
            </button>
          </div>
        ) : (
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
        )}

        {error ? <p className="mt-4 text-sm text-red-600">{error}</p> : null}
      </article>
    </div>
  );
}
