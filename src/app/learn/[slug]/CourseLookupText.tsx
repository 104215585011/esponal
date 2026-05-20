"use client";

import { useEffect, useState } from "react";
import { LookupCard } from "@/app/watch/LookupCard";

type CourseLookupTextProps = {
  text: string;
  translation: string;
  courseRef: string;
  sourceUrl: string;
  className?: string;
};

type ActiveWord = {
  form: string;
  index: number;
};

const wordPattern = /([\p{L}áéíóúüñÁÉÍÓÚÜÑ]+)/gu;
let savedFormsPromise: Promise<Set<string>> | null = null;

function splitText(text: string) {
  const parts: { text: string; isWord: boolean }[] = [];
  let lastIndex = 0;

  for (const match of text.matchAll(wordPattern)) {
    const index = match.index ?? 0;
    if (index > lastIndex) {
      parts.push({ text: text.slice(lastIndex, index), isWord: false });
    }
    parts.push({ text: match[0], isWord: true });
    lastIndex = index + match[0].length;
  }

  if (lastIndex < text.length) {
    parts.push({ text: text.slice(lastIndex), isWord: false });
  }

  return parts;
}

function normalizeLookupWord(token: string) {
  return token
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/^[^a-záéíóúñü]+|[^a-záéíóúñü]+$/gi, "")
    .trim();
}

function loadSavedForms() {
  if (!savedFormsPromise) {
    savedFormsPromise = fetch("/api/vocab/highlight")
      .then((response) => (response.ok ? response.json() : { savedForms: [] }))
      .then((data: { savedForms?: unknown }) => {
        if (!Array.isArray(data.savedForms)) return new Set<string>();
        return new Set(
          data.savedForms
            .filter((form): form is string => typeof form === "string")
            .map((form) => normalizeLookupWord(form))
            .filter(Boolean)
        );
      })
      .catch(() => new Set<string>());
  }

  return savedFormsPromise;
}

export function CourseLookupText({
  text,
  translation,
  courseRef,
  sourceUrl,
  className
}: CourseLookupTextProps) {
  const [activeWord, setActiveWord] = useState<ActiveWord | null>(null);
  const [savedSet, setSavedSet] = useState<Set<string>>(() => new Set());
  const parts = splitText(text);

  useEffect(() => {
    let cancelled = false;

    loadSavedForms().then((forms) => {
      if (!cancelled) setSavedSet(forms);
    });

    return () => {
      cancelled = true;
    };
  }, []);

  return (
    <span className={className}>
      {parts.map((part, index) => {
        if (!part.isWord) return <span key={`${part.text}-${index}`}>{part.text}</span>;

        const isActive = activeWord?.index === index;
        const normalized = normalizeLookupWord(part.text);
        const isSaved = savedSet.has(normalized);
        return (
          <span className="relative inline-block" key={`${part.text}-${index}`}>
            <button
              className={`rounded px-0.5 text-inherit underline-offset-4 hover:bg-brand-50 hover:text-brand-700 hover:underline ${
                isSaved ? "saved-word" : ""
              }`}
              onClick={() => setActiveWord(isActive ? null : { form: part.text, index })}
              type="button"
            >
              {part.text}
            </button>
            {isActive ? (
              <LookupCard
                form={activeWord.form}
                onClose={() => setActiveWord(null)}
                originalSentence={text}
                translatedSentence={translation}
                source={{
                  type: "course",
                  url: sourceUrl,
                  courseRef,
                  sentence: text
                }}
              />
            ) : null}
          </span>
        );
      })}
    </span>
  );
}
