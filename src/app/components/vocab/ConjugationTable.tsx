"use client";

import { useState } from "react";
import type { Person, VerbConjugations } from "@/lib/conjugate";

type ConjugationTableProps = {
  conjugations: VerbConjugations;
};

const PEOPLE: { key: Person; label: string }[] = [
  { key: "yo", label: "yo" },
  { key: "tu", label: "tú" },
  { key: "el", label: "él/ella" },
  { key: "nosotros", label: "nosotros" },
  { key: "vosotros", label: "vosotros" },
  { key: "ellos", label: "ellos" }
];

const TENSE_OPTIONS = [
  { key: "presente", label: "现在时" },
  { key: "preteritoIndefinido", label: "简单过去" },
  { key: "preteritoImperfecto", label: "未完成过去" },
  { key: "futuro", label: "将来时" },
  { key: "condicional", label: "条件式" },
  { key: "presenteSubjuntivo", label: "虚拟现在" },
  { key: "imperativo", label: "命令式" }
] as const;

export default function ConjugationTable({ conjugations }: ConjugationTableProps) {
  const [activeTense, setActiveTense] =
    useState<(typeof TENSE_OPTIONS)[number]["key"]>("presente");

  const activeRows =
    activeTense === "imperativo"
      ? conjugations.imperativo ?? {}
      : conjugations[activeTense];

  return (
    <section className="mt-4 rounded-xl border border-gray-200 bg-white p-3">
      <div className="-mx-1 mb-3 flex gap-2 overflow-x-auto px-1 pb-1">
        {TENSE_OPTIONS.map((option) => (
          <button
            key={option.key}
            type="button"
            className={`shrink-0 rounded-full px-3 py-1.5 text-xs font-medium transition ${
              activeTense === option.key
                ? "bg-brand-500 text-white"
                : "bg-gray-100 text-gray-500 hover:bg-gray-200"
            }`}
            onClick={() => setActiveTense(option.key)}
          >
            {option.label}
          </button>
        ))}
      </div>
      <div className="overflow-hidden rounded-lg border border-gray-100">
        <table className="w-full text-sm">
          <tbody>
            {PEOPLE.filter((person) =>
              activeTense === "imperativo" ? person.key !== "yo" : true
            ).map((person) => {
              const value = activeRows[person.key];
              if (!value) {
                return null;
              }

              return (
                <tr className="border-t border-gray-100 first:border-t-0" key={person.key}>
                  <th className="w-28 bg-gray-50 px-3 py-2 text-left font-medium text-gray-500">
                    {person.label}
                  </th>
                  <td className="px-3 py-2 text-gray-900">{value}</td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </section>
  );
}
