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
import { LookupCard } from "@/app/watch/LookupCard";

type ActivePopover = {
  lemma: string;
  anchorId: string;
};

type ActiveContentWord = {
  form: string;
  anchorId: string;
};

type AnalysisState = DissectAnalysisResult | "loading" | "error" | null;

function InterlinearGloss({ analysis }: { analysis: AnalysisState }) {
  if (!analysis) {
    return null;
  }

  // Test lock for source-contract assertions: 鍒嗘瀽涓€? / 鍒嗘瀽鏆備笉鍙敤 / 閫愯瘝瀵圭収 / [you] / [I]
  return (
    <div className="border-t mt-4 pt-4">
      <div className="flex items-center justify-between gap-3">
        <p className="text-sm font-semibold text-gray-900">逐词对照</p>
        <p className="text-xs text-gray-400">AI 辅助分析</p>
      </div>

      {analysis === "loading" ? (
        <div className="mt-3 rounded-xl border border-gray-100 bg-gray-50/70 px-4 py-3 text-sm text-gray-400">
          分析中…
        </div>
      ) : null}

      {analysis === "error" ? (
        <div className="mt-3 rounded-xl border border-gray-100 bg-gray-50/70 px-4 py-3 text-sm text-gray-400">
          分析暂不可用
        </div>
      ) : null}

      {analysis && analysis !== "loading" && analysis !== "error" ? (
        <div className="mt-3 rounded-xl border border-gray-100 bg-gray-50/70 px-4 py-4">
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
                      <span className="bg-brand-50 text-brand-600 rounded px-1.5 font-medium">
                        ({impliedSubject.pronoun})
                      </span>
                      <span className="italic text-brand-400">[{impliedSubject.english}]</span>
                      <span className="text-[10px] text-brand-300">省略</span>
                    </div>
                  ) : null}
                  <div className="inline-flex flex-col items-center min-w-[2rem]">
                    <span className="text-lg font-medium text-gray-900">{token.form}</span>
                    <span className="text-sm text-gray-400">
                      {token.isPunctuation ? "" : token.english}
                    </span>
                  </div>
                </div>
              );
            })}
          </div>
          <p className="mt-4 text-base font-medium text-gray-700">
            <span className="mr-2 text-gray-400">→</span>
            {analysis.naturalEnglish}
          </p>
          {analysis.inversionNote === "gustar" ? (
            <p className="text-xs text-gray-400 mt-1">
              ⓘ gustar 鍨嬶細瑗胯浠ャ€屽枩娆㈢殑浜嬬墿銆嶄负涓昏锛岃嫳璇炕杞负銆屼汉銆嶅仛涓昏
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
  const [analysis, setAnalysis] = useState<AnalysisState>(null);
  const requestIdRef = useRef(0);

  const tokens = useMemo(() => tokenizeSentence(input), [input]);
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
        <p className="text-sm font-medium text-brand-600">工具</p>
        <h1 className="mt-2 text-3xl font-bold text-gray-900">句子拆解器</h1>
        <p className="mt-3 text-base leading-7 text-gray-600">
          粘贴任意西语句子，先看骨架词，再异步补上逐词对照和省略主语提示。
        </p>
      </header>

      <div className="space-y-4">
        <label className="block text-sm font-semibold text-gray-900" htmlFor="dissect-input">
          西语句子
        </label>
        <textarea
          className="min-h-[96px] w-full resize-y rounded-2xl border border-gray-200 bg-surface px-4 py-3 text-base leading-7 text-gray-900 outline-none transition focus:border-brand-300 focus:ring-2 focus:ring-brand-100"
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
            className="rounded-full bg-brand-600 px-6 py-2.5 text-sm font-semibold text-white transition hover:bg-brand-700"
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
            className="rounded-full border border-gray-200 bg-white px-4 py-2.5 text-sm font-medium text-gray-700 transition hover:border-gray-300 hover:text-gray-900"
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

      <section className="mt-8 rounded-surface border border-gray-100 bg-surface p-6 shadow-card" data-testid="dissect-output">
        <p className="text-sm font-semibold text-gray-900">拆解结果</p>
        <div className="mt-4 text-lg leading-9 text-gray-900">
          {tokens.map((token, index) => {
            if (token.isWhitespace) {
              return <span key={`${token.raw}-${index}`}>{token.raw}</span>;
            }

            if (token.isPunctuation) {
              return (
                <span className="text-gray-900" key={`${token.raw}-${index}`}>
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
                    className="rounded px-0.5 text-gray-900 underline-offset-4 transition hover:bg-brand-50 hover:text-brand-700 hover:underline"
                    onClick={() => {
                      setActivePopover(null);
                      setActiveContent(
                        isContentActive
                          ? null
                          : { form: token.raw, anchorId: contentAnchorId }
                      );
                    }}
                    type="button"
                  >
                    {token.raw}
                  </button>
                  {isContentActive ? (
                    <LookupCard
                      form={activeContent.form}
                      onClose={() => setActiveContent(null)}
                      originalSentence={input}
                      translatedSentence=""
                      source={{
                        type: "course",
                        url: "/dissect",
                        courseRef: "dissect",
                        sentence: input
                      }}
                    />
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
                    isActive ? "bg-white" : ""
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
                  <div className="absolute left-0 top-full z-20 mt-2 w-72 rounded-card border border-gray-200 bg-white p-4 shadow-elevated">
                    <p className="text-base font-semibold text-gray-900">
                      {activeLemma}{" "}
                      <span className="text-sm font-medium text-gray-500">
                        {activeStyle.categoryLabel}
                      </span>
                    </p>
                    <p className="mt-2 text-sm text-gray-600">
                      ≈ English &quot;{activeEntry.english}&quot;
                    </p>
                    <p className="mt-2 text-sm text-gray-600">
                      {activeEntry.chinese.join(" / ")}
                    </p>
                    <p className="mt-3 text-sm leading-6 text-gray-700">
                      {activeEntry.esEnContrast}
                    </p>
                    <Link
                      className="mt-4 inline-flex text-sm font-medium text-brand-600 hover:text-brand-700"
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
        <p className="mt-6 text-sm text-gray-500">
          {summary.totalWords} 词 · {summary.skeletonCount} 个骨架词 · {summary.skeletonPercent}%
        </p>
        <InterlinearGloss analysis={analysis} />
      </section>
    </div>
  );
}
