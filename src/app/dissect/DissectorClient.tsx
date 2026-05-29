// Timestamp: 2026-05-27 08:45
"use client";

import Link from "next/link";
import { useMemo, useRef, useState } from "react";
import type { DissectAnalysisResult } from "@/app/dissect/analysis";
import {
  DEFAULT_DISSECT_SENTENCE,
  getAggregationStyle,
  getFoundationDayHref
} from "@/lib/functionWords";
import { summarizeDissection, tokenizeSentence } from "@/app/dissect/tokenize";
import {
  PHRASE_HIGHLIGHT_CLASSES,
  usePhraseSpans,
  type PhraseSpan
} from "@/app/components/vocab/PhraseText";
import { LookupCard, LookupCardStack } from "@/app/watch/LookupCard";

type ActivePopover = {
  lemma: string;
  anchorId: string;
};

type ActiveLookupCard = {
  id: string;
  form: string;
  lookupKind: "word" | "phrase";
  phraseKind?: PhraseSpan["kind"];
};

type ActiveContentWord = {
  anchorId: string;
  cards: ActiveLookupCard[];
};

type AnalysisState = DissectAnalysisResult | "loading" | "error" | null;

function InterlinearGloss({ analysis }: { analysis: AnalysisState }) {
  if (!analysis) {
    return null;
  }

  return (
    <div className="border-t border-zinc-200 dark:border-zinc-800/80 mt-4 pt-4">
      <div className="flex items-center justify-between gap-3">
        <p className="text-sm font-semibold text-zinc-900 dark:text-zinc-50 font-display">逐词对照</p>
        <p className="text-xs text-zinc-400 dark:text-zinc-500">AI 辅助分析</p>
      </div>

      {analysis === "loading" ? (
        <div className="mt-3 rounded-xl border border-zinc-200 dark:border-zinc-800 bg-zinc-50/70 dark:bg-zinc-900/40 px-4 py-3 text-sm text-zinc-400 dark:text-zinc-500">
          分析中…
        </div>
      ) : null}

      {analysis === "error" ? (
        <div className="mt-3 rounded-xl border border-zinc-200 dark:border-zinc-800 bg-zinc-50/70 dark:bg-zinc-900/40 px-4 py-3 text-sm text-zinc-400 dark:text-zinc-500">
          分析暂不可用
        </div>
      ) : null}

      {analysis && analysis !== "loading" && analysis !== "error" ? (
        <div className="mt-3 rounded-xl border border-zinc-200 dark:border-zinc-800 bg-zinc-50/70 dark:bg-zinc-900/40 px-4 py-4">
          <div className="flex flex-nowrap overflow-x-auto gap-3 pb-1">
            {analysis.tokens.map((token, index) => {
              const impliedSubject =
                analysis.impliedSubject?.insertBeforeIndex === index
                  ? analysis.impliedSubject
                  : null;

              return (
                <div className="contents" key={`${token.form}-${index}`}>
                  {impliedSubject ? (
                    <div className="inline-flex flex-col items-center min-w-[2rem]">
                      <span className="bg-brand-50 dark:bg-brand-950/50 text-brand-600 dark:text-brand-400 rounded px-1.5 font-medium">
                        ({impliedSubject.pronoun})
                      </span>
                      <span className="italic text-brand-400 dark:text-brand-500">[{impliedSubject.english}]</span>
                      <span className="text-[10px] text-brand-300 dark:text-brand-700">省略</span>
                    </div>
                  ) : null}
                  <div className="inline-flex flex-col items-center min-w-[2rem]">
                    <span className="text-lg font-medium text-zinc-900 dark:text-zinc-50">{token.form}</span>
                    <span className="text-sm text-zinc-400 dark:text-zinc-500">
                      {token.isPunctuation ? "" : token.english}
                    </span>
                  </div>
                </div>
              );
            })}
          </div>
          <p className="mt-4 text-base font-medium text-zinc-700 dark:text-zinc-300">
            <span className="mr-2 text-zinc-400 dark:text-zinc-600">→</span>
            {analysis.naturalEnglish}
          </p>
          {analysis.inversionNote === "gustar" ? (
            <p className="text-xs text-gray-400 mt-1">
              ⓘ gustar 型：西语以「喜欢的事物」为主语，英语翻转为「人」做主语
            </p>
          ) : null}
        </div>
      ) : null}
    </div>
  );
}

export function DissectorClient() {
  const [input, setInput] = useState(DEFAULT_DISSECT_SENTENCE);
  const [activePopover, setActivePopover] = useState<ActivePopover | null>(null);
  const [activeContent, setActiveContent] = useState<ActiveContentWord | null>(null);

  const openLookup = (
    anchorId: string,
    form: string,
    lookupKind: "word" | "phrase" = "word",
    phraseKind?: PhraseSpan["kind"]
  ) => {
    setActiveContent((prev) => {
      if (
        prev &&
        prev.anchorId === anchorId &&
        prev.cards[0]?.form === form &&
        prev.cards.length === 1
      ) {
        return null;
      }
      return {
        anchorId,
        cards: [
          {
            id: `${lookupKind}-${form}`,
            form,
            lookupKind,
            phraseKind
          }
        ]
      };
    });
  };

  const openNestedWord = (form: string) => {
    setActiveContent((prev) => {
      if (!prev || prev.cards.length >= 2) return prev;
      return {
        ...prev,
        cards: [
          ...prev.cards,
          {
            id: `word-${form}`,
            form,
            lookupKind: "word"
          }
        ]
      };
    });
  };

  const openNestedPhrase = (lemma: string, kind: "collocation" | "phrase" | "idiom") => {
    setActiveContent((prev) => {
      if (!prev || prev.cards.length >= 2) return prev;
      return {
        ...prev,
        cards: [
          ...prev.cards,
          {
            id: `phrase-${lemma}`,
            form: lemma,
            lookupKind: "phrase",
            phraseKind: kind
          }
        ]
      };
    });
  };

  const closeStackCard = (id: string) => {
    setActiveContent((prev) => {
      if (!prev) return null;
      const nextCards = prev.cards.filter((card) => card.id !== id);
      if (nextCards.length === 0) return null;
      return { ...prev, cards: nextCards };
    });
  };
  const [analysis, setAnalysis] = useState<AnalysisState>(null);
  const requestIdRef = useRef(0);

  const tokens = useMemo(() => tokenizeSentence(input), [input]);
  const phraseSpans = usePhraseSpans(input, true);
  const summary = useMemo(() => summarizeDissection(tokens), [tokens]);

  const activeMatch = activePopover
    ? tokens.find(
        (token) => token.lemma === activePopover.lemma && token.entry !== null
      )
    : null;
  const activeEntry = activeMatch?.entry ?? null;
  const activeLemma = activeMatch?.lemma ?? activePopover?.lemma ?? "";
  const activeStyle = activeEntry
    ? getAggregationStyle(activeEntry.category)
    : null;

  return (
    <div className="mx-auto w-full max-w-3xl px-4 py-10 sm:px-6">
      <header className="mb-8">
        <p className="text-sm font-medium text-brand-600 dark:text-brand-400 font-display">工具</p>
        <h1 className="mt-2 text-3xl font-bold text-zinc-900 dark:text-zinc-50 font-display tracking-tight">句子拆解器</h1>
        <p className="mt-3 text-base leading-7 text-zinc-600 dark:text-zinc-400 font-light">
          粘贴任意西语句子，先看骨架词，再异步补上逐词对照和省略主语提示。
        </p>
      </header>

      <div className="space-y-4">
        <label className="block text-sm font-semibold text-zinc-900 dark:text-zinc-200" htmlFor="dissect-input">
          西语句子
        </label>
        <textarea
          className="min-h-[96px] w-full resize-y rounded-2xl border border-zinc-200 dark:border-zinc-800 bg-white dark:bg-zinc-900/70 glass-card px-4 py-3 text-base leading-7 text-zinc-900 dark:text-zinc-100 outline-none transition focus:border-brand-500 focus:ring-2 focus:ring-brand-100/50 shadow-sm"
          data-testid="dissect-input"
          id="dissect-input"
          onChange={(event) => {
            setInput(event.target.value);
            setActivePopover(null);
            setActiveContent(null);
            setAnalysis(null);
            requestIdRef.current += 1;
          }}
          placeholder={DEFAULT_DISSECT_SENTENCE}
          rows={3}
          value={input}
        />
        <div className="flex flex-wrap items-center gap-3">
          <button
            className="rounded-full bg-brand-500 hover:bg-brand-600 px-6 py-2.5 text-sm font-semibold text-white transition shadow-lg shadow-brand-500/10"
            onClick={async () => {
              const sentence = input.trim();
              const requestId = requestIdRef.current + 1;
              requestIdRef.current = requestId;
              setActivePopover(null);
              setActiveContent(null);

              if (!sentence) {
                setAnalysis("error");
                return;
              }

              setAnalysis("loading");

              try {
                const response = await fetch("/api/dissect/analyze", {
                  method: "POST",
                  headers: {
                    "content-type": "application/json"
                  },
                  body: JSON.stringify({ sentence })
                });

                if (!response.ok) {
                  throw new Error(`analyze failed: ${response.status}`);
                }

                const payload = (await response.json()) as DissectAnalysisResult;
                if (requestIdRef.current === requestId) {
                  setAnalysis(payload);
                }
              } catch (error) {
                console.warn("Dissect analysis failed", error);
                if (requestIdRef.current === requestId) {
                  setAnalysis("error");
                }
              }
            }}
            type="button"
          >
            拆解
          </button>
          <button
            className="rounded-full border border-zinc-200 dark:border-zinc-800 bg-white dark:bg-zinc-900/50 px-4 py-2.5 text-sm font-medium text-zinc-700 dark:text-zinc-300 transition hover:bg-zinc-50 dark:hover:bg-zinc-800"
            onClick={() => {
              setInput(DEFAULT_DISSECT_SENTENCE);
              setActivePopover(null);
              setActiveContent(null);
              setAnalysis(null);
              requestIdRef.current += 1;
            }}
            type="button"
          >
            恢复示例
          </button>
        </div>
      </div>

      <section className="mt-8 rounded-surface border border-zinc-200/50 dark:border-zinc-800/50 bg-white/70 dark:bg-zinc-900/70 glass-card p-6 shadow-sm" data-testid="dissect-output">
        <p className="text-sm font-semibold text-zinc-900 dark:text-zinc-50 font-display">拆解结果</p>
        {phraseSpans.length > 0 ? (
          <div className="mt-3 flex flex-wrap gap-2">
            {phraseSpans.map((span) => (
              <span className="relative inline-block" key={`${span.start}-${span.end}`}>
                <button
                  className={PHRASE_HIGHLIGHT_CLASSES}
                  onClick={() => {
                    setActivePopover(null);
                    openLookup(
                      `phrase-${span.start}-${span.end}`,
                      span.lemma,
                      "phrase",
                      span.kind
                    );
                  }}
                  type="button"
                >
                  {span.surface}
                </button>
                {activeContent?.anchorId === `phrase-${span.start}-${span.end}` ? (
                  <div className="absolute left-0 top-full z-20 mt-2">
                    <LookupCardStack
                      cards={activeContent.cards.map((card) => ({
                        ...card,
                        onClose: () => closeStackCard(card.id),
                        onExampleWordClick: openNestedWord,
                        onRelatedPhraseClick: openNestedPhrase,
                        originalSentence: input,
                        translatedSentence: "",
                        source: {
                          type: "dissect",
                          url: "/dissect" as const,
                          sentence: input
                        }
                      }))}
                      onCloseCard={closeStackCard}
                    />
                  </div>
                ) : null}
              </span>
            ))}
          </div>
        ) : null}
        <div className="mt-4 text-lg leading-9 text-zinc-900 dark:text-zinc-100">
          {tokens.map((token, index) => {
            if (token.isWhitespace) {
              return <span key={`${token.raw}-${index}`}>{token.raw}</span>;
            }

            if (token.isPunctuation) {
              return (
                <span className="text-zinc-900 dark:text-zinc-100" key={`${token.raw}-${index}`}>
                  {token.raw}
                </span>
              );
            }

            if (!token.entry || !token.lemma) {
              const contentAnchorId = `content-${token.raw}-${index}`;
              const isContentActive = activeContent?.anchorId === contentAnchorId;
              return (
                <span className="relative inline" key={contentAnchorId}>
                  <button
                    aria-expanded={isContentActive}
                    className="rounded px-0.5 text-zinc-900 dark:text-zinc-100 underline-offset-4 transition hover:bg-brand-50 dark:hover:bg-brand-950/50 hover:text-brand-700 dark:hover:text-brand-300 hover:underline"
                    onClick={() => {
                      setActivePopover(null);
                      openLookup(contentAnchorId, token.raw);
                    }}
                    type="button"
                  >
                    {token.raw}
                  </button>
                  {isContentActive ? (
                    <div className="absolute left-0 top-full z-20 mt-2">
                        <LookupCardStack
                          cards={activeContent.cards.map((card) => ({
                            ...card,
                            onClose: () => closeStackCard(card.id),
                            onExampleWordClick: openNestedWord,
                            onRelatedPhraseClick: openNestedPhrase,
                            originalSentence: input,
                            translatedSentence: "",
                            source: {
                              type: "course",
                              url: "/dissect",
                              courseRef: "dissect",
                              sentence: input
                            }
                          }))}
                          onCloseCard={closeStackCard}
                        />
                    </div>
                  ) : null}
                </span>
              );
            }

            const style = getAggregationStyle(token.entry.category);
            const anchorId = `${token.lemma}-${index}`;
            const isActive = activePopover?.anchorId === anchorId;

            return (
              <span className="relative inline" key={anchorId}>
                <button
                  aria-expanded={isActive}
                  className={[
                    "inline border-b-2 pb-0.5 align-baseline transition",
                    style.borderClass,
                    style.textClass,
                    style.hoverClass,
                    isActive ? "bg-white dark:bg-zinc-800" : ""
                  ].join(" ")}
                  onClick={() => {
                    setActiveContent(null);
                    setActivePopover(
                      isActive ? null : { lemma: token.lemma!, anchorId }
                    );
                  }}
                  type="button"
                >
                  {token.raw}
                  <sup className={`ml-0.5 text-[10px] font-medium ${style.textClass}`}>
                    {style.badge}
                  </sup>
                </button>
                {isActive && activeEntry && activeStyle ? (
                  <div className="absolute left-0 top-full z-20 mt-2 w-72 rounded-card border border-zinc-200 dark:border-zinc-800 bg-white dark:bg-zinc-900 p-4 shadow-elevated glass-card">
                    <p className="text-base font-semibold text-zinc-900 dark:text-zinc-50 font-display">
                      {activeLemma}{" "}
                      <span className="text-sm font-medium text-zinc-500 dark:text-zinc-400">
                        {activeStyle.categoryLabel}
                      </span>
                    </p>
                    <p className="mt-2 text-sm text-zinc-600 dark:text-zinc-400">
                      ≈ English &quot;{activeEntry.english}&quot;
                    </p>
                    <p className="mt-2 text-sm text-zinc-600 dark:text-zinc-400">
                      {activeEntry.chinese.join(" / ")}
                    </p>
                    <p className="mt-3 text-sm leading-6 text-zinc-700 dark:text-zinc-300">
                      {activeEntry.esEnContrast}
                    </p>
                    <Link
                      className="mt-4 inline-flex text-sm font-medium text-brand-500 hover:text-brand-600 dark:hover:text-brand-400"
                      href={getFoundationDayHref(activeStyle.foundationDay)}
                    >
                      → 详见 Day {activeStyle.foundationDay} 课程
                    </Link>
                  </div>
                ) : null}
              </span>
            );
          })}
        </div>
        <p className="mt-6 text-sm text-zinc-500 dark:text-zinc-400">
          {summary.totalWords} 词 · {summary.skeletonCount} 个骨架词 · {summary.skeletonPercent}%
        </p>
        <InterlinearGloss analysis={analysis} />
      </section>
    </div>
  );
}


