"use client";

import { useEffect, useState } from "react";
import { LookupCard, type LookupSource } from "@/app/watch/LookupCard";

type SpanishTextProps = {
  text: string;
  translation?: string;
  source?: LookupSource;
  className?: string;
  wordClassName?: string;
  interactionDensity?: "inline" | "dense" | "readOnly";
  enableKeyboard?: boolean;
};

type ActiveWord = {
  form: string;
  index: number;
};

const wordPattern = /([\p{L}áéíóúüñÁÉÍÓÚÜÑ]+)/gu;
let savedFormsPromise: Promise<Set<string>> | null = null;

// TODO: Replace opt-in per-word tab stops with roving tabindex when long-form keyboard lookup is needed.

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
    .replace(/^[^a-záéíóúüñ]+|[^a-záéíóúüñ]+$/gi, "")
    .trim();
}

function invalidateSavedForms() {
  savedFormsPromise = null;
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

function getWordClassName({
  isSaved,
  interactionDensity,
  wordClassName
}: {
  isSaved: boolean;
  interactionDensity: Exclude<SpanishTextProps["interactionDensity"], undefined>;
  wordClassName?: string;
}) {
  const densityClass =
    interactionDensity === "dense"
      ? "rounded px-1 py-0.5"
      : "rounded px-0.5";

  return [
    "spanish-text-word text-inherit transition-colors hover:bg-brand-50 hover:text-brand-700 active:bg-brand-100",
    densityClass,
    isSaved ? "saved-word" : "",
    wordClassName ?? ""
  ]
    .filter(Boolean)
    .join(" ");
}

export function SpanishText({
  text,
  translation = "",
  source,
  className,
  wordClassName,
  interactionDensity = "inline",
  enableKeyboard = false
}: SpanishTextProps) {
  const [activeWord, setActiveWord] = useState<ActiveWord | null>(null);
  const [savedSet, setSavedSet] = useState<Set<string>>(() => new Set());
  const [savedVersion, setSavedVersion] = useState(0);
  const parts = splitText(text);
  const isReadOnly = interactionDensity === "readOnly";

  useEffect(() => {
    let cancelled = false;

    loadSavedForms().then((forms) => {
      if (!cancelled) setSavedSet(forms);
    });

    return () => {
      cancelled = true;
    };
  }, [savedVersion]);

  const handleSaved = () => {
    invalidateSavedForms();
    setSavedVersion((version) => version + 1);
  };

  return (
    <span className={className}>
      <style jsx>{`
        @media (hover: none) {
          .spanish-text-word {
            /* bg-brand-50/40 */
            background-color: rgb(236 253 245 / 0.4);
          }

          .spanish-text-word:active {
            background-color: rgb(209 250 229);
          }
        }
      `}</style>
      {parts.map((part, index) => {
        if (!part.isWord) return <span key={`${part.text}-${index}`}>{part.text}</span>;

        const normalized = normalizeLookupWord(part.text);
        const isSaved = savedSet.has(normalized);
        const isActive = activeWord?.index === index;

        if (isReadOnly) {
          return (
            <span
              className={isSaved ? `saved-word ${wordClassName ?? ""}` : wordClassName}
              key={`${part.text}-${index}`}
            >
              {part.text}
            </span>
          );
        }

        return (
          <span
            className="relative inline-block max-w-[min(20rem,calc(100vw-2rem))]"
            key={`${part.text}-${index}`}
          >
            <button
              className={getWordClassName({ isSaved, interactionDensity, wordClassName })}
              onClick={() => setActiveWord(isActive ? null : { form: part.text, index })}
              tabIndex={enableKeyboard ? 0 : -1}
              type="button"
            >
              {part.text}
            </button>
            {isActive ? (
              <LookupCard
                form={activeWord.form}
                onClose={() => setActiveWord(null)}
                onSaved={handleSaved}
                originalSentence={text}
                translatedSentence={translation}
                source={source}
              />
            ) : null}
          </span>
        );
      })}
    </span>
  );
}
