"use client";

import { useState } from "react";
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

export function CourseLookupText({
  text,
  translation,
  courseRef,
  sourceUrl,
  className
}: CourseLookupTextProps) {
  const [activeWord, setActiveWord] = useState<ActiveWord | null>(null);
  const parts = splitText(text);

  return (
    <span className={className}>
      {parts.map((part, index) => {
        if (!part.isWord) return <span key={`${part.text}-${index}`}>{part.text}</span>;

        const isActive = activeWord?.index === index;
        return (
          <span className="relative inline-block" key={`${part.text}-${index}`}>
            <button
              className="rounded px-0.5 text-inherit underline-offset-4 hover:bg-emerald-50 hover:text-emerald-700 hover:underline"
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
