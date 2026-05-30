// Timestamp: 2026-05-30 15:45
"use client";

import { useState } from "react";
import type { VerbConjugations } from "@/lib/conjugate";
import EmptyState from "@/app/components/ui/EmptyState";
import ConjugationTable from "@/app/components/vocab/ConjugationTable";
import { buildVideoJumpHref } from "@/app/components/vocab/videoHref";

export type VocabEncounter = {
  id: string;
  sourceUrl: string;
  timestampSec: number;
  sourceType: string;
  courseRef: string | null;
  originalSentence: string;
  translatedSentence: string;
  createdAt: string;
  videoTitle: string;
};

export type VocabWord = {
  id: string;
  lemma: string;
  translation: string;
  partOfSpeech: string | null;
  meanings: string[];
  examples: { es: string; zh: string }[];
  conjugations?: VerbConjugations;
  nounForms?: { singular: string; plural: string; gender: "m" | "f" | "mf" };
  adjectiveForms?: { ms: string; fs: string; mp: string; fp: string };
  encounterCount: number;
  recentEncounterAt: string | null;
  encounters: VocabEncounter[];
};

type VocabAccordionProps = {
  words: VocabWord[];
};

const formatTimestamp = (seconds: number) => {
  const minutes = Math.floor(seconds / 60);
  const remainingSeconds = seconds % 60;

  return `${minutes}:${String(remainingSeconds).padStart(2, "0")}`;
};

const formatRecentTime = (dateValue: string | null) => {
  if (!dateValue) return "暂无时间";

  return new Intl.DateTimeFormat("zh-CN", {
    month: "short",
    day: "numeric"
  }).format(new Date(dateValue));
};

const formatDividerDate = (dateValue: string) =>
  new Intl.DateTimeFormat("zh-CN", {
    year: "numeric",
    month: "long",
    day: "numeric"
  }).format(new Date(dateValue));

const getDateKey = (dateValue: string) => dateValue.slice(0, 10);

const TALK_SOURCE_NAMES: Record<string, string> = {
  carlos: "Carlos"
};

function getTalkSourceName(courseRef: string | null) {
  const characterId = courseRef?.split(":")[1] ?? "";
  return TALK_SOURCE_NAMES[characterId] ?? (characterId || "Talk");
}

export default function VocabAccordion({ words }: VocabAccordionProps) {
  const [openWordId, setOpenWordId] = useState<string | null>(null);
  const [searchQuery, setSearchQuery] = useState("");
  const [posFilter, setPosFilter] = useState("all");
  const [freqFilter, setFreqFilter] = useState("all");
  const [sourceFilter, setSourceFilter] = useState("all");
  const [sortBy, setSortBy] = useState("recent");
  const [pageSize, setPageSize] = useState(20);

  const handleSearchChange = (val: string) => {
    setSearchQuery(val);
    setPageSize(20);
  };
  const handlePosChange = (val: string) => {
    setPosFilter(val);
    setPageSize(20);
  };
  const handleFreqChange = (val: string) => {
    setFreqFilter(val);
    setPageSize(20);
  };
  const handleSourceChange = (val: string) => {
    setSourceFilter(val);
    setPageSize(20);
  };
  const handleSortChange = (val: string) => {
    setSortBy(val);
    setPageSize(20);
  };

  if (words.length === 0) {
    return (
      <EmptyState
        action={{ href: "/", label: "去看视频" }}
        description="看视频或学课程时遇到的词会自动收录到这里"
        kind="empty"
        title="生词本还空着"
      />
    );
  }

  // Filter logic
  const filteredWords = words.filter((word) => {
    // 1. Search Query
    if (searchQuery.trim()) {
      const q = searchQuery.toLowerCase().trim();
      const matchLemma = word.lemma.toLowerCase().includes(q);
      const matchTranslation = word.translation.toLowerCase().includes(q);
      const matchMeanings = word.meanings.some((m) => m.toLowerCase().includes(q));
      if (!matchLemma && !matchTranslation && !matchMeanings) {
        return false;
      }
    }

    // 2. Part of Speech Filter
    if (posFilter !== "all") {
      const pos = (word.partOfSpeech ?? "").toLowerCase().trim();
      const isVerb = pos.startsWith("v");
      const isNoun = pos.startsWith("n");
      const isAdj = pos.startsWith("adj");

      if (posFilter === "verb" && !isVerb) return false;
      if (posFilter === "noun" && !isNoun) return false;
      if (posFilter === "adjective" && !isAdj) return false;
      if (posFilter === "other" && (isVerb || isNoun || isAdj)) return false;
    }

    // 3. Frequency Filter
    if (freqFilter !== "all") {
      const count = word.encounterCount;
      if (freqFilter === "1" && count !== 1) return false;
      if (freqFilter === "2" && count !== 2) return false;
      if (freqFilter === "3+" && count < 3) return false;
    }

    // 4. Source Filter
    if (sourceFilter !== "all") {
      const hasSource = word.encounters.some(
        (encounter) => encounter.sourceType === sourceFilter
      );
      if (!hasSource) return false;
    }

    return true;
  });

  // Sort logic
  const sortedWords = [...filteredWords].sort((a, b) => {
    if (sortBy === "recent") {
      const left = a.recentEncounterAt ?? "";
      const right = b.recentEncounterAt ?? "";
      return right.localeCompare(left);
    } else if (sortBy === "frequency") {
      if (b.encounterCount !== a.encounterCount) {
        return b.encounterCount - a.encounterCount;
      }
      const left = a.recentEncounterAt ?? "";
      const right = b.recentEncounterAt ?? "";
      return right.localeCompare(left);
    } else if (sortBy === "alphabetical") {
      return a.lemma.localeCompare(b.lemma, "es");
    }
    return 0;
  });

  const displayedWords = sortedWords.slice(0, pageSize);
  const hasMore = sortedWords.length > pageSize;

  return (
    <div className="flex flex-col gap-4">
      {/* Control Panel */}
      <div className="flex flex-col gap-3">
        <div className="relative">
          <svg className="absolute left-3.5 top-1/2 h-4 w-4 -translate-y-1/2 text-zinc-400 dark:text-zinc-500 fill-none stroke-current" strokeWidth="2" viewBox="0 0 20 20">
            <circle cx="9" cy="9" r="5.5" />
            <path d="M13.5 13.5 18 18" />
          </svg>
          <input
            type="text"
            placeholder="搜索单词或释义..."
            value={searchQuery}
            onChange={(e) => handleSearchChange(e.target.value)}
            className="w-full pl-10 pr-4 py-2 text-sm rounded-lg border border-zinc-200/50 dark:border-zinc-800/50 bg-white/70 dark:bg-zinc-900/70 text-zinc-900 dark:text-zinc-50 placeholder-zinc-400 focus:outline-none focus:ring-1 focus:ring-brand-500/50 transition-all outline-none"
            data-testid="vocab-search-input"
          />
        </div>

        <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
          <div className="flex flex-col gap-1">
            <span className="text-[11px] font-medium text-zinc-400 dark:text-zinc-500 ml-1">词性</span>
            <select
              value={posFilter}
              onChange={(e) => handlePosChange(e.target.value)}
              className="w-full text-xs rounded-lg border border-zinc-200/50 dark:border-zinc-800/50 bg-white/70 dark:bg-zinc-900/70 px-2 py-1.5 text-zinc-700 dark:text-zinc-300 focus:outline-none focus:ring-1 focus:ring-brand-500/50 cursor-pointer"
              data-testid="vocab-filter-pos"
            >
              <option value="all">全部</option>
              <option value="verb">动词</option>
              <option value="noun">名词</option>
              <option value="adjective">形容词</option>
              <option value="other">其他</option>
            </select>
          </div>

          <div className="flex flex-col gap-1">
            <span className="text-[11px] font-medium text-zinc-400 dark:text-zinc-500 ml-1">遭遇频次</span>
            <select
              value={freqFilter}
              onChange={(e) => handleFreqChange(e.target.value)}
              className="w-full text-xs rounded-lg border border-zinc-200/50 dark:border-zinc-800/50 bg-white/70 dark:bg-zinc-900/70 px-2 py-1.5 text-zinc-700 dark:text-zinc-300 focus:outline-none focus:ring-1 focus:ring-brand-500/50 cursor-pointer"
              data-testid="vocab-filter-freq"
            >
              <option value="all">全部</option>
              <option value="1">1 次</option>
              <option value="2">2 次</option>
              <option value="3+">3 次及以上</option>
            </select>
          </div>

          <div className="flex flex-col gap-1">
            <span className="text-[11px] font-medium text-zinc-400 dark:text-zinc-500 ml-1">遭遇来源</span>
            <select
              value={sourceFilter}
              onChange={(e) => handleSourceChange(e.target.value)}
              className="w-full text-xs rounded-lg border border-zinc-200/50 dark:border-zinc-800/50 bg-white/70 dark:bg-zinc-900/70 px-2 py-1.5 text-zinc-700 dark:text-zinc-300 focus:outline-none focus:ring-1 focus:ring-brand-500/50 cursor-pointer"
              data-testid="vocab-filter-source"
            >
              <option value="all">全部</option>
              <option value="video">视频</option>
              <option value="course">课程</option>
              <option value="lectura">阅读</option>
              <option value="talk">对话</option>
              <option value="grammar">语法</option>
              <option value="dissect">拆解</option>
            </select>
          </div>

          <div className="flex flex-col gap-1">
            <span className="text-[11px] font-medium text-zinc-400 dark:text-zinc-500 ml-1">排序</span>
            <select
              value={sortBy}
              onChange={(e) => handleSortChange(e.target.value)}
              className="w-full text-xs rounded-lg border border-zinc-200/50 dark:border-zinc-800/50 bg-white/70 dark:bg-zinc-900/70 px-2 py-1.5 text-zinc-700 dark:text-zinc-300 focus:outline-none focus:ring-1 focus:ring-brand-500/50 cursor-pointer"
              data-testid="vocab-sort"
            >
              <option value="recent">最近遭遇</option>
              <option value="frequency">遭遇最多</option>
              <option value="alphabetical">字母 (A-Z)</option>
            </select>
          </div>
        </div>
      </div>

      {sortedWords.length === 0 ? (
        <div className="text-center py-12 rounded-xl border border-dashed border-zinc-200/50 dark:border-zinc-800/50 bg-white/30 dark:bg-zinc-900/30">
          <p className="text-sm text-zinc-500 dark:text-zinc-400">没有找到符合筛选条件的单词</p>
          <button
            onClick={() => {
              setSearchQuery("");
              setPosFilter("all");
              setFreqFilter("all");
              setSourceFilter("all");
              setSortBy("recent");
              setPageSize(20);
            }}
            className="mt-3 text-xs font-semibold text-brand-500 hover:text-brand-600 dark:hover:text-brand-400 hover:underline cursor-pointer"
          >
            清空筛选条件
          </button>
        </div>
      ) : (
        <div className="flex flex-col gap-3">
          {displayedWords.map((word) => {
            const isOpen = openWordId === word.id;
            let lastDateKey = "";
            const summary = word.meanings.length > 0 ? word.meanings.join(" / ") : word.translation;
            const hasForms = Boolean(word.conjugations || word.nounForms || word.adjectiveForms);

            return (
              <article className="overflow-hidden rounded-xl border border-zinc-200/50 dark:border-zinc-800/50 bg-white/70 dark:bg-zinc-900/70 glass-card shadow-sm" data-testid="vocab-word" key={word.id}>
                <button
                  type="button"
                  className="flex w-full cursor-pointer items-center justify-between gap-4 p-4 text-left transition-colors hover:bg-zinc-50/50 dark:hover:bg-zinc-800/50"
                  onClick={() => setOpenWordId(isOpen ? null : word.id)}
                  aria-expanded={isOpen}
                >
                  <span>
                    <span className="block text-base font-semibold text-zinc-900 dark:text-zinc-50 font-display">
                      {word.lemma}
                      {word.partOfSpeech ? (
                        <span className="ml-2 rounded bg-zinc-100 dark:bg-zinc-800 px-1.5 py-0.5 text-[11px] font-medium text-zinc-500 dark:text-zinc-400">
                          {word.partOfSpeech}
                        </span>
                      ) : null}
                    </span>
                    <span className="mt-1 block text-sm text-zinc-500 dark:text-zinc-400">{summary}</span>
                  </span>
                  <span className="flex shrink-0 items-center gap-3 text-right">
                    <span>
                      <span className="block text-xs text-zinc-400 dark:text-zinc-500">
                        遭遇 {word.encounterCount} 次
                      </span>
                      <span className="mt-1 block text-xs text-zinc-300 dark:text-zinc-600">
                        {formatRecentTime(word.recentEncounterAt)}
                      </span>
                    </span>
                    <span
                      className={`text-zinc-300 dark:text-zinc-600 transition-transform duration-200 ${
                        isOpen ? "rotate-180" : ""
                      }`}
                      aria-hidden="true"
                    >
                      ↓
                    </span>
                  </span>
                </button>

                <div
                  className={`overflow-hidden bg-gray-50 dark:bg-zinc-950/20 border-t border-zinc-200/50 dark:border-zinc-800/50 transition-[max-height] duration-200 ease-out ${
                    isOpen ? "max-h-[1200px]" : "max-h-0"
                  }`}
                >
                  <div className="px-3 py-3 sm:px-4">
                    {word.examples[0] ? (
                      <div className="mb-3 rounded-xl bg-white dark:bg-zinc-900 border border-zinc-200/50 dark:border-zinc-800/50 px-4 py-3 text-sm text-zinc-500 dark:text-zinc-400 shadow-sm">
                        <p className="italic text-zinc-700 dark:text-zinc-300">{word.examples[0].es}</p>
                        <p className="mt-1">{word.examples[0].zh}</p>
                      </div>
                    ) : null}
                    {hasForms ? (
                      <div className="mb-3 rounded-xl bg-white dark:bg-zinc-900 border border-zinc-200/50 dark:border-zinc-800/50 px-4 py-3 shadow-sm">
                        {word.nounForms ? (
                          <p className="text-sm text-zinc-600 dark:text-zinc-400">
                            单/复{" "}
                            <span className="font-medium text-zinc-900 dark:text-zinc-100">
                              {word.nounForms.singular} / {word.nounForms.plural}
                            </span>
                            {" · "}
                            {word.nounForms.gender}
                          </p>
                        ) : null}
                        {word.adjectiveForms ? (
                          <p className="text-sm text-zinc-600 dark:text-zinc-400">
                            阳单/阴单/阳复/阴复{" "}
                            <span className="font-medium text-zinc-900 dark:text-zinc-100">
                              {word.adjectiveForms.ms} / {word.adjectiveForms.fs} /{" "}
                              {word.adjectiveForms.mp} / {word.adjectiveForms.fp}
                            </span>
                          </p>
                        ) : null}
                        {word.conjugations ? (
                          <ConjugationTable conjugations={word.conjugations} />
                        ) : null}
                      </div>
                    ) : null}
                    {word.encounters.map((encounter) => {
                      const dateKey = getDateKey(encounter.createdAt);
                      const showDivider = dateKey !== lastDateKey;
                      lastDateKey = dateKey;
                      const isCourse = encounter.sourceType === "course";
                      const isLectura = encounter.sourceType === "lectura";
                      const isTalk = encounter.sourceType === "talk";
                      const isStatic = isCourse || isLectura || isTalk;
                      const talkName = getTalkSourceName(encounter.courseRef);
                      const badgeLabel = isCourse
                        ? "课程"
                        : isLectura
                          ? "阅读"
                          : isTalk
                            ? "talk"
                            : formatTimestamp(encounter.timestampSec);
                      const badgeClass = isCourse
                        ? "bg-brand-50 dark:bg-brand-950/50 text-brand-600 dark:text-brand-400"
                        : isLectura
                          ? "bg-purple-50 dark:bg-purple-950/50 text-purple-600 dark:text-purple-400"
                          : isTalk
                            ? "bg-brand-50 dark:bg-brand-950/50 text-brand-600 dark:text-brand-400"
                            : "bg-zinc-100 dark:bg-zinc-800 text-zinc-500 dark:text-zinc-400";
                      const titleLabel = isLectura
                        ? encounter.courseRef ?? "阅读出处"
                        : isCourse
                          ? encounter.courseRef ?? "课程出处"
                          : isTalk
                            ? `talk · ${talkName}`
                            : encounter.videoTitle;
                      const linkLabel = isStatic ? "查看" : "跳回视频";

                      return (
                        <div key={encounter.id}>
                          {showDivider ? (
                            <div className="date divider my-3 flex items-center gap-3 text-xs text-zinc-400 dark:text-zinc-500">
                              <span className="h-px flex-1 bg-zinc-200 dark:bg-zinc-800" />
                              <span>{formatDividerDate(encounter.createdAt)}</span>
                              <span className="h-px flex-1 bg-zinc-200 dark:bg-zinc-800" />
                            </div>
                          ) : null}
                          <div className="border-b border-zinc-100 dark:border-zinc-800/50 py-3 last:border-b-0">
                            <div className="flex items-start justify-between gap-3">
                              <div className="min-w-0">
                                <p className="text-sm font-medium text-zinc-700 dark:text-zinc-300">{titleLabel}</p>
                                <span
                                  className={`mt-2 inline-flex rounded-full px-2 py-1 text-xs ${badgeClass}`}
                                >
                                  {badgeLabel}
                                </span>
                              </div>
                              <a
                                className="inline-flex min-h-[44px] min-w-[44px] shrink-0 items-center justify-center text-xs font-semibold text-brand-500 hover:text-brand-600 dark:hover:text-brand-400 hover:underline"
                                href={
                                  isStatic
                                    ? encounter.sourceUrl
                                    : buildVideoJumpHref(
                                        encounter.sourceUrl,
                                        encounter.timestampSec
                                      )
                                }
                                target="_blank"
                                rel="noreferrer"
                              >
                                {linkLabel}
                              </a>
                            </div>
                            <p className="mt-3 text-sm italic text-zinc-700 dark:text-zinc-300">
                              {encounter.originalSentence}
                            </p>
                            <p className="mt-2 text-sm text-zinc-400 dark:text-zinc-500">
                              {encounter.translatedSentence}
                            </p>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </div>
              </article>
            );
          })}
          {hasMore && (
            <button
              type="button"
              onClick={() => setPageSize((prev) => prev + 20)}
              className="w-full py-3 text-xs font-semibold text-zinc-500 dark:text-zinc-400 hover:text-brand-500 dark:hover:text-brand-400 rounded-xl bg-zinc-50 dark:bg-zinc-800/20 hover:bg-zinc-100/50 dark:hover:bg-zinc-800/40 border border-zinc-200/50 dark:border-zinc-800/50 transition-all text-center cursor-pointer mt-2"
              data-testid="vocab-load-more"
            >
              加载更多
            </button>
          )}
        </div>
      )}
    </div>
  );
}



