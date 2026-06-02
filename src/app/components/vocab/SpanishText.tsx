// Timestamp: 2026-06-02 09:03
"use client";

import { useEffect, useMemo, useState } from "react";
import { createPortal } from "react-dom";
import { LookupCardStack, type LookupSource } from "@/app/watch/LookupCard";
import {
  PHRASE_HIGHLIGHT_CLASSES,
  buildPhraseSegments,
  usePhraseSpans,
  type PhraseSpan,
  type TextToken
} from "@/app/components/vocab/PhraseText";

type SpanishTextProps = {
  text: string;
  translation?: string;
  source?: LookupSource;
  className?: string;
  wordClassName?: string;
  interactionDensity?: "inline" | "dense" | "readOnly";
  enableKeyboard?: boolean;
  enablePhrases?: boolean;
};

type ActiveLookupCard = {
  id: string;
  form: string;
  lookupKind: "word" | "phrase";
  phraseKind?: PhraseSpan["kind"];
};

type ActiveLookupStack = {
  index: string;
  anchorX: number;
  anchorY: number;
  cards: ActiveLookupCard[];
};

const wordPattern = /([\p{L}áéíóúüñÁÉÍÓÚÜÑ]+)/gu;
const SIDEBAR_W_LG = 260;
const LOOKUP_CARD_W = 320;
const LOOKUP_PADDING = 8;
let savedFormsPromise: Promise<Set<string>> | null = null;

// TODO: Replace opt-in per-word tab stops with roving tabindex when long-form keyboard lookup is needed.

function splitText(text: string): TextToken[] {
  const parts: TextToken[] = [];
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

function getLookupViewportLeft(anchorX: number, source?: LookupSource) {
  if (typeof window === "undefined") return 0;

  const isTalkDesktop = source?.type === "talk" && window.innerWidth >= 1024;
  const minLeft = isTalkDesktop ? SIDEBAR_W_LG + LOOKUP_PADDING : LOOKUP_PADDING;
  const maxLeft = Math.max(minLeft, window.innerWidth - LOOKUP_CARD_W - LOOKUP_PADDING);

  return Math.max(minLeft, Math.min(anchorX - LOOKUP_CARD_W / 2, maxLeft));
}

export function SpanishText({
  text,
  translation = "",
  source,
  className,
  wordClassName,
  interactionDensity = "inline",
  enableKeyboard = false,
  enablePhrases = false
}: SpanishTextProps) {
  const [activeLookup, setActiveLookup] = useState<ActiveLookupStack | null>(null);
  const setActiveWord = setActiveLookup;
  const [savedSet, setSavedSet] = useState<Set<string>>(() => new Set());
  const [savedVersion, setSavedVersion] = useState(0);
  const parts = useMemo(() => splitText(text), [text]);
  const isReadOnly = interactionDensity === "readOnly";
  const phraseSpans = usePhraseSpans(text, enablePhrases && !isReadOnly);
  const phraseSegments = useMemo(
    () => buildPhraseSegments(parts, phraseSpans),
    [parts, phraseSpans]
  );

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

  const openLookup = ({
    anchorX,
    anchorY,
    form,
    index,
    lookupKind = "word",
    phraseKind
  }: {
    anchorX: number;
    anchorY: number;
    form: string;
    index: string;
    lookupKind?: "word" | "phrase";
    phraseKind?: PhraseSpan["kind"];
  }) => {
    setActiveLookup((previous) =>
      previous?.index === index && previous.cards[0]?.form === form
        ? null
        : {
            index,
            anchorX,
            anchorY,
            cards: [
              {
                id: `${lookupKind}-${form}`,
                form,
                lookupKind,
                phraseKind
              }
            ]
          }
    );
  };

  const openNestedWord = (form: string) => {
    setActiveLookup((previous) => {
      if (!previous || previous.cards.length >= 2) {
        return previous;
      }

      return {
        ...previous,
        cards: [
          ...previous.cards,
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
    setActiveLookup((previous) => {
      if (!previous || previous.cards.length >= 2) {
        return previous;
      }

      return {
        ...previous,
        cards: [
          ...previous.cards,
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
    setActiveLookup((previous) => {
      if (!previous) return previous;
      const nextCards = previous.cards.filter((card) => card.id !== id);
      if (nextCards.length === 0) return null;
      return { ...previous, cards: nextCards };
    });
  };

  const renderStack = (index: string) => {
    if (activeLookup?.index !== index || typeof document === "undefined") {
      return null;
    }

    return createPortal(
      <span
        className="fixed z-[70] w-[300px] max-w-[min(20rem,calc(100vw-2rem))]"
        style={{
          left: getLookupViewportLeft(activeLookup.anchorX, source),
          position: "fixed",
          top: activeLookup.anchorY + LOOKUP_PADDING
        }}
      >
        <LookupCardStack
          cards={activeLookup.cards.slice(-2).map((card) => ({
            ...card,
            onClose: () => closeStackCard(card.id),
            onExampleWordClick: openNestedWord,
            onRelatedPhraseClick: openNestedPhrase,
            onSaved: handleSaved,
            originalSentence: text,
            translatedSentence: translation,
            source
          }))}
          onCloseCard={closeStackCard}
        />
      </span>,
      document.body
    );
  };

  const renderWordToken = ({
    index,
    text: tokenText
  }: {
    index: string;
    text: string;
  }) => {
    const normalized = normalizeLookupWord(tokenText);
    const isSaved = savedSet.has(normalized);

    if (isReadOnly) {
      return (
        <span
          className={isSaved ? `saved-word ${wordClassName ?? ""}` : wordClassName}
          key={index}
        >
          {tokenText}
        </span>
      );
    }

    return (
      <span
        className={`relative inline-block max-w-[min(20rem,calc(100vw-2rem))] ${
          activeLookup?.index === index ? "z-50" : ""
        }`}
        key={index}
      >
        <button
          className={getWordClassName({ isSaved, interactionDensity, wordClassName })}
          onClick={(event) => {
            const rect = event.currentTarget.getBoundingClientRect();
            openLookup({
              anchorX: rect.left + rect.width / 2,
              anchorY: rect.bottom,
              form: normalized || tokenText,
              index
            });
          }}
          tabIndex={enableKeyboard ? 0 : -1}
          type="button"
        >
          {tokenText}
        </button>
        {renderStack(index)}
      </span>
    );
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
      {phraseSegments.map((segment, segmentIndex) => {
        if (segment.type === "text") {
          if (!segment.token.isWord) {
            return <span key={`text-${segmentIndex}`}>{segment.token.text}</span>;
          }
          return renderWordToken({
            index: `text-${segmentIndex}`,
            text: segment.token.text
          });
        }

        const phraseIndex = `phrase-${segment.span.start}-${segment.span.end}`;

        return (
          <span
            className="relative inline-block max-w-[min(20rem,calc(100vw-2rem))]"
            key={phraseIndex}
          >
            <span
              className={PHRASE_HIGHLIGHT_CLASSES}
              onClick={(event) => {
                const rect = event.currentTarget.getBoundingClientRect();
                openLookup({
                  anchorX: rect.left + rect.width / 2,
                  anchorY: rect.bottom,
                  form: segment.span.lemma,
                  index: phraseIndex,
                  lookupKind: "phrase",
                  phraseKind: segment.span.kind
                });
              }}
              role="button"
              tabIndex={0}
            >
              {segment.tokens.map((token, tokenIndex) => {
                if (!token.isWord) {
                  return <span key={`${token.text}-${tokenIndex}`}>{token.text}</span>;
                }
                const normalized = normalizeLookupWord(token.text);
                const isSaved = savedSet.has(normalized);
                return (
                  <span
                    className={isSaved ? `saved-word ${wordClassName ?? ""}` : wordClassName}
                    key={`${token.text}-${tokenIndex}`}
                  >
                    {token.text}
                  </span>
                );
              })}
            </span>
            {renderStack(phraseIndex)}
          </span>
        );
      })}
    </span>
  );
}
