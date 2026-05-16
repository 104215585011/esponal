"use client";

import { useState } from "react";
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

function EmptyState() {
  return (
    <div className="flex min-h-[240px] flex-col items-center justify-center text-center">
      <div className="mb-6 h-24 w-32 text-gray-200" aria-hidden="true">
        <svg viewBox="0 0 128 96" fill="none" className="h-full w-full">
          <path
            d="M22 72C34 56 45 49 60 51C75 53 83 66 106 50"
            stroke="currentColor"
            strokeWidth="3"
            strokeLinecap="round"
          />
          <path
            d="M30 31H98M38 45H78M44 60H68"
            stroke="currentColor"
            strokeWidth="3"
            strokeLinecap="round"
          />
          <rect
            x="18"
            y="18"
            width="92"
            height="60"
            rx="14"
            stroke="currentColor"
            strokeWidth="3"
          />
        </svg>
      </div>
      <p className="text-base text-gray-500">还没有遭遇过词汇</p>
      <p className="mt-2 text-sm text-gray-400">
        看视频时遇到的词会自动收录到这里。
      </p>
    </div>
  );
}

export default function VocabAccordion({ words }: VocabAccordionProps) {
  const [openWordId, setOpenWordId] = useState<string | null>(null);

  if (words.length === 0) {
    return <EmptyState />;
  }

  return (
    <div className="flex flex-col gap-3">
      {words.map((word) => {
        const isOpen = openWordId === word.id;
        let lastDateKey = "";
        const summary = word.meanings.length > 0 ? word.meanings.join(" / ") : word.translation;

        return (
          <article className="overflow-hidden rounded-xl" key={word.id}>
            <button
              type="button"
              className="flex w-full cursor-pointer items-center justify-between gap-4 rounded-xl border border-gray-100 bg-surface p-4 text-left transition-colors hover:border-gray-200"
              onClick={() => setOpenWordId(isOpen ? null : word.id)}
              aria-expanded={isOpen}
            >
              <span>
                <span className="block text-base font-semibold text-gray-900">
                  {word.lemma}
                  {word.partOfSpeech ? (
                    <span className="ml-2 rounded bg-gray-100 px-1.5 py-0.5 text-[11px] font-medium text-gray-500">
                      {word.partOfSpeech}
                    </span>
                  ) : null}
                </span>
                <span className="mt-1 block text-sm text-gray-500">{summary}</span>
              </span>
              <span className="flex shrink-0 items-center gap-3 text-right">
                <span>
                  <span className="block text-xs text-gray-400">
                    遭遇 {word.encounterCount} 次
                  </span>
                  <span className="mt-1 block text-xs text-gray-300">
                    {formatRecentTime(word.recentEncounterAt)}
                  </span>
                </span>
                <span
                  className={`text-gray-300 transition-transform duration-200 ${
                    isOpen ? "rotate-180" : ""
                  }`}
                  aria-hidden="true"
                >
                  ↓
                </span>
              </span>
            </button>

            <div
              className={`overflow-hidden rounded-b-xl bg-gray-50 transition-[max-height] duration-200 ease-out ${
                isOpen ? "max-h-[1200px]" : "max-h-0"
              }`}
            >
              <div className="px-3 py-3 sm:px-4">
                {word.examples[0] ? (
                  <div className="mb-3 rounded-xl bg-surface px-4 py-3 text-sm text-gray-500">
                    <p className="italic text-gray-700">{word.examples[0].es}</p>
                    <p className="mt-1">{word.examples[0].zh}</p>
                  </div>
                ) : null}
                {word.encounters.map((encounter) => {
                  const dateKey = getDateKey(encounter.createdAt);
                  const showDivider = dateKey !== lastDateKey;
                  lastDateKey = dateKey;
                  const isCourse = encounter.sourceType === "course";

                  return (
                    <div key={encounter.id}>
                      {showDivider ? (
                        <div className="date divider my-3 flex items-center gap-3 text-xs text-gray-300">
                          <span className="h-px flex-1 bg-gray-200" />
                          <span>{formatDividerDate(encounter.createdAt)}</span>
                          <span className="h-px flex-1 bg-gray-200" />
                        </div>
                      ) : null}
                      <div className="border-b border-gray-100 py-3 last:border-b-0">
                        <div className="flex items-start justify-between gap-3">
                          <div className="min-w-0">
                            <p className="text-sm font-medium text-gray-700">
                              {isCourse ? encounter.courseRef ?? "课程出处" : encounter.videoTitle}
                            </p>
                            <span
                              className={`mt-2 inline-flex rounded-full px-2 py-1 text-xs ${
                                isCourse
                                  ? "bg-brand-50 text-brand-600"
                                  : "bg-gray-200 text-gray-500"
                              }`}
                            >
                              {isCourse ? "课程" : formatTimestamp(encounter.timestampSec)}
                            </span>
                          </div>
                          <a
                            className="inline-flex min-h-[44px] min-w-[44px] shrink-0 items-center justify-center text-xs font-medium text-brand-600 hover:underline"
                            href={
                              isCourse
                                ? encounter.sourceUrl
                                : buildVideoJumpHref(
                                    encounter.sourceUrl,
                                    encounter.timestampSec
                                  )
                            }
                            target="_blank"
                            rel="noreferrer"
                          >
                            {isCourse ? "查看" : "跳回视频"}
                          </a>
                        </div>
                        <p className="mt-3 text-sm italic text-gray-600">
                          {encounter.originalSentence}
                        </p>
                        <p className="mt-2 text-sm text-gray-400">
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
    </div>
  );
}
