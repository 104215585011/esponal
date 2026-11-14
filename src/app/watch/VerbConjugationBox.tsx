// Timestamp: 2026-11-15 04:48
"use client";

import { useState } from "react";
import type { Person, VerbConjugations } from "@/lib/conjugate";

type TenseKey =
  | "presente"
  | "preteritoIndefinido"
  | "preteritoImperfecto"
  | "preteritoPerfectoCompuesto"
  | "futuro"
  | "presenteSubjuntivo"
  | "condicional";

const TENSE_OPTIONS: Array<{ key: TenseKey; label: string }> = [
  { key: "presente", label: "现在时" },
  { key: "preteritoIndefinido", label: "简单过去" },
  { key: "preteritoImperfecto", label: "未完成过去" },
  { key: "preteritoPerfectoCompuesto", label: "现在完成" },
  { key: "futuro", label: "将来时" },
  { key: "presenteSubjuntivo", label: "虚拟式" },
  { key: "condicional", label: "条件式" },
];

const PERSON_LABELS: Array<{ key: Person; label: string }> = [
  { key: "yo", label: "yo" },
  { key: "tu", label: "tú" },
  { key: "el", label: "él/ella" },
  { key: "nosotros", label: "nosotros" },
  { key: "vosotros", label: "vosotros" },
  { key: "ellos", label: "ellos/ellas" },
];

export function VerbConjugationBox({ conjugations }: { conjugations: unknown }) {
  const [expanded, setExpanded] = useState(false);
  const [selectedTense, setSelectedTense] = useState<TenseKey>("presente");

  const data = conjugations as Partial<VerbConjugations> | null;
  if (!data || !data.presente) {
    return null;
  }

  const activeMap = data[selectedTense] as Partial<Record<Person, string>> | undefined;

  return (
    <div className="mt-3 rounded-lg border border-zinc-200/70 bg-zinc-50/70 p-2.5 dark:border-zinc-800/70 dark:bg-zinc-900/50">
      <button
        type="button"
        onClick={() => setExpanded((prev) => !prev)}
        className="flex w-full items-center justify-between text-left text-xs font-semibold text-zinc-700 dark:text-zinc-200"
      >
        <span>动词人称与时态变位</span>
        <span className="text-[11px] text-brand-600 dark:text-brand-400">
          {expanded ? "收起 ▲" : "展开全部时态 ▼"}
        </span>
      </button>

      {expanded ? (
        <div className="mt-2.5 space-y-2.5">
          <div className="flex flex-wrap gap-1.5">
            {TENSE_OPTIONS.filter((opt) => Boolean(data[opt.key])).map((opt) => {
              const active = selectedTense === opt.key;
              return (
                <button
                  key={opt.key}
                  type="button"
                  onClick={() => setSelectedTense(opt.key)}
                  className={`rounded-full px-2.5 py-1 text-[11px] font-semibold transition ${
                    active
                      ? "bg-brand-500 text-white"
                      : "border border-zinc-200 bg-white text-zinc-600 hover:bg-zinc-100 dark:border-zinc-700 dark:bg-zinc-800 dark:text-zinc-300"
                  }`}
                >
                  {opt.label}
                </button>
              );
            })}
          </div>

          {activeMap ? (
            <div className="grid grid-cols-2 gap-1.5">
              {PERSON_LABELS.map(({ key, label }) => (
                <div
                  key={key}
                  className="flex items-center justify-between rounded-md bg-white px-2 py-1 text-[11px] dark:bg-zinc-800/80"
                >
                  <span className="text-zinc-400 dark:text-zinc-500">{label}</span>
                  <span className="font-semibold text-zinc-800 dark:text-zinc-100">
                    {activeMap[key] ?? "—"}
                  </span>
                </div>
              ))}
            </div>
          ) : null}

          {data.participio || data.gerundio ? (
            <div className="flex flex-wrap gap-3 border-t border-zinc-200/60 pt-2 text-[11px] text-zinc-500 dark:border-zinc-800 dark:text-zinc-400">
              {data.participio ? <span>过去分词：{data.participio}</span> : null}
              {data.gerundio ? <span>现在分词：{data.gerundio}</span> : null}
            </div>
          ) : null}
        </div>
      ) : null}
    </div>
  );
}
