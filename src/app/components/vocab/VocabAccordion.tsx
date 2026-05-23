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

  return (
    <div className="flex flex-col gap-3">
      {words.map((word) => {
        const isOpen = openWordId === word.id;
        let lastDateKey = "";
        const summary = word.meanings.length > 0 ? word.meanings.join(" / ") : word.translation;
        const hasForms = Boolean(word.conjugations || word.nounForms || word.adjectiveForms);

        return (
          <article className="overflow-hidden rounded-xl" data-testid="vocab-word" key={word.id}>
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
                {hasForms ? (
                  <div className="mb-3 rounded-xl bg-surface px-4 py-3">
                    {word.nounForms ? (
                      <p className="text-sm text-gray-600">
                        单/复{" "}
                        <span className="font-medium text-gray-900">
                          {word.nounForms.singular} / {word.nounForms.plural}
                        </span>
                        {" · "}
                        {word.nounForms.gender}
                      </p>
                    ) : null}
                    {word.adjectiveForms ? (
                      <p className="text-sm text-gray-600">
                        阳单/阴单/阳复/阴复{" "}
                        <span className="font-medium text-gray-900">
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
                    ? "bg-brand-50 text-brand-600"
                    : isLectura
                      ? "bg-purple-50 text-purple-600"
                      : isTalk
                        ? "bg-emerald-50 text-emerald-600"
                        : "bg-gray-200 text-gray-500";
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
                        <div className="date divider my-3 flex items-center gap-3 text-xs text-gray-300">
                          <span className="h-px flex-1 bg-gray-200" />
                          <span>{formatDividerDate(encounter.createdAt)}</span>
                          <span className="h-px flex-1 bg-gray-200" />
                        </div>
                      ) : null}
                      <div className="border-b border-gray-100 py-3 last:border-b-0">
                        <div className="flex items-start justify-between gap-3">
                          <div className="min-w-0">
                            <p className="text-sm font-medium text-gray-700">{titleLabel}</p>
                            <span
                              className={`mt-2 inline-flex rounded-full px-2 py-1 text-xs ${badgeClass}`}
                            >
                              {badgeLabel}
                            </span>
                          </div>
                          <a
                            className="inline-flex min-h-[44px] min-w-[44px] shrink-0 items-center justify-center text-xs font-medium text-brand-600 hover:underline"
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
