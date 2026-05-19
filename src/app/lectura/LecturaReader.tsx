"use client";

import { useEffect, useRef, useState } from "react";
import { LookupCard } from "@/app/watch/LookupCard";
import type { LecturaStory } from "@/../content/lectura";

type LecturaReaderProps = {
  story: LecturaStory;
};

type ActiveLookup = {
  paragraphIndex: number;
  form: string;
  anchorX: number;
  anchorY: number;
};

function splitParagraphTokens(text: string) {
  // Keep word-runs and whitespace/punctuation runs as separate tokens so we
  // can wrap only the word-like ones in clickable spans while preserving the
  // original spacing and punctuation around them.
  return text.match(/\S+|\s+/g) ?? [];
}

function normalizeLookupWord(token: string) {
  return token
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .toLowerCase()
    .replace(
      /^[^a-záéíóúñü]+|[^a-záéíóúñü]+$/gi,
      ""
    )
    .trim();
}

export function LecturaReader({ story }: LecturaReaderProps) {
  const [activeLookup, setActiveLookup] = useState<ActiveLookup | null>(null);
  const containerRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    function handlePointerDown(event: PointerEvent) {
      if (!containerRef.current) return;
      const target = event.target as Node | null;
      if (!target) return;
      if (containerRef.current.contains(target)) return;
      // Allow clicks inside the LookupCard (rendered outside the article body)
      const lookupEl = document.querySelector("[data-testid='lookup-card']");
      if (lookupEl && lookupEl.contains(target)) return;
      setActiveLookup(null);
    }

    function handleKeyDown(event: KeyboardEvent) {
      if (event.key === "Escape") setActiveLookup(null);
    }

    document.addEventListener("pointerdown", handlePointerDown);
    document.addEventListener("keydown", handleKeyDown);
    return () => {
      document.removeEventListener("pointerdown", handlePointerDown);
      document.removeEventListener("keydown", handleKeyDown);
    };
  }, []);

  return (
    <>
      <div
        className="font-serif text-[17px] leading-[1.85] text-gray-800"
        data-testid="lectura-reader"
        ref={containerRef}
      >
        {story.paragraphs.map((paragraph, paragraphIndex) => {
          const tokens = splitParagraphTokens(paragraph);
          return (
            <p
              className="mb-6"
              data-testid="lectura-paragraph"
              id={`p${paragraphIndex}`}
              key={paragraphIndex}
            >
              {tokens.map((token, tokenIndex) => {
                const normalized = normalizeLookupWord(token);
                if (!normalized) {
                  return <span key={tokenIndex}>{token}</span>;
                }
                return (
                  <span
                    className="cursor-pointer rounded-sm transition hover:bg-brand-50"
                    key={tokenIndex}
                    onClick={(event) => {
                      event.stopPropagation();
                      const rect = (
                        event.currentTarget as HTMLElement
                      ).getBoundingClientRect();
                      setActiveLookup({
                        paragraphIndex,
                        form: normalized,
                        anchorX: rect.left,
                        anchorY: rect.bottom + 6
                      });
                    }}
                    role="button"
                    tabIndex={0}
                    onKeyDown={(event) => {
                      if (event.key === "Enter" || event.key === " ") {
                        event.preventDefault();
                        event.stopPropagation();
                        const rect = (
                          event.currentTarget as HTMLElement
                        ).getBoundingClientRect();
                        setActiveLookup({
                          paragraphIndex,
                          form: normalized,
                          anchorX: rect.left,
                          anchorY: rect.bottom + 6
                        });
                      }
                    }}
                  >
                    {token}
                  </span>
                );
              })}
            </p>
          );
        })}
      </div>

      {activeLookup
        ? (() => {
            const paragraph = story.paragraphs[activeLookup.paragraphIndex] ?? "";
            // Clamp so the 300px card stays on-screen
            const left =
              typeof window !== "undefined"
                ? Math.min(activeLookup.anchorX, window.innerWidth - 340)
                : activeLookup.anchorX;
            const top =
              typeof window !== "undefined" &&
              activeLookup.anchorY + 280 > window.innerHeight
                ? activeLookup.anchorY - 300
                : activeLookup.anchorY;
            return (
              <div className="fixed z-50" style={{ left, top, width: 320 }}>
                <LookupCard
                  form={activeLookup.form}
                  onClose={() => setActiveLookup(null)}
                  originalSentence={paragraph}
                  translatedSentence=""
                  source={{
                    type: "lectura",
                    storySlug: story.slug,
                    paragraphIndex: activeLookup.paragraphIndex,
                    sentence: paragraph
                  }}
                />
              </div>
            );
          })()
        : null}
    </>
  );
}
