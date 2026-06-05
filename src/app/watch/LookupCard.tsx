// Timestamp: 2026-06-03 10:05
"use client";

import { useEffect, useMemo, useState, type PointerEvent } from "react";
import { createPortal } from "react-dom";
import EmptyState from "@/app/components/ui/EmptyState";
import { speak, useSpeechAvailable } from "@/lib/speak";

export type LookupSource =
  | {
      type: "video";
      url?: string;
      timestampSec?: number;
      sentence?: string;
    }
  | {
      type: "course";
      url: string;
      courseRef: string;
      sentence: string;
    }
  | {
      type: "lectura";
      storySlug: string;
      paragraphIndex: number;
      sentence: string;
    }
  | {
      type: "dissect";
      url: "/dissect";
      sentence: string;
    }
  | {
      type: "grammar";
      url: string;
      topicSlug: string;
      sentence: string;
    }
  | {
      type: "talk";
      url: string;
      characterId: string;
      sessionId: string;
      messageIndex: number;
      sentence: string;
    };

type RelatedPhrase = {
  lemma: string;
  translationZh: string;
  kind: "collocation" | "phrase" | "idiom";
};

type LookupCardProps = {
  currentTimeSec?: number;
  form: string;
  lookupKind?: "word" | "phrase";
  phraseKind?: "collocation" | "phrase" | "idiom";
  onExampleWordClick?: (form: string) => void;
  onRelatedPhraseClick?: (lemma: string, kind: "collocation" | "phrase" | "idiom") => void;
  onClose: () => void;
  onSaved?: () => void;
  originalSentence: string;
  translatedSentence: string;
  source?: LookupSource;
  useStaticLayout?: boolean;
};

type LookupCardStackCard = LookupCardProps & {
  id: string;
};

type LookupResponse = {
  word: string;
  lemma: string | null;
  morphInfo: string | null;
  partOfSpeech: string | null;
  meanings: string[];
  examples: { es: string; zh: string }[];
  phonetic: string | null;
  isSaved?: boolean;
  wordId?: string | null;
  totalEncounters?: number | null;
  conjugations?: unknown;
  nounForms?: unknown;
  adjectiveForms?: unknown;
  degraded?: boolean;
  relatedPhrases?: RelatedPhrase[];
  usageNote?: string | null;
};

type ButtonState = "default" | "loading" | "success" | "login" | "disabled" | "already_saved";

type LookupState =
  | { kind: "loading" }
  | { kind: "unsupported" }
  | { kind: "rateLimited" }
  | {
      kind: "ready";
      lemma: string;
      morphInfo: string;
      translation: string;
      partOfSpeech: string;
      meanings: string[];
      examples: { es: string; zh: string }[];
      phonetic: string | null;
      isSaved?: boolean;
      wordId?: string | null;
      totalEncounters?: number | null;
      conjugations?: LookupResponse["conjugations"];
      nounForms?: LookupResponse["nounForms"];
      adjectiveForms?: LookupResponse["adjectiveForms"];
      relatedPhrases?: RelatedPhrase[];
      usageNote?: string | null;
    };

const LEGACY_LEMMATIZE_ROUTE = "/api/lemmatize";

const globalRecentEncounters = new Map<string, number>();

function getPhraseKindLabel(kind?: "collocation" | "phrase" | "idiom") {
  if (kind === "idiom") return "习语";
  if (kind === "phrase") return "短语";
  return "固定搭配";
}

function splitExampleTokens(text: string) {
  return text.match(/[\p{L}áéíóúüñÁÉÍÓÚÜÑ]+|\s+|[^\s\p{L}áéíóúüñÁÉÍÓÚÜÑ]+/gu) ?? [];
}

function normalizeExampleWord(token: string) {
  return token
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/^[^a-záéíóúüñ]+|[^a-záéíóúüñ]+$/gi, "")
    .trim();
}

export function LookupCardStack({
  cards,
  onCloseCard
}: {
  cards: LookupCardStackCard[];
  onCloseCard: (id: string, options?: { autoPlay?: boolean }) => void;
}) {
  const visibleCards = cards.slice(-2);
  const activeCard = visibleCards[visibleCards.length - 1];
  const isMobileViewport = useIsMobileViewport();

  if (!activeCard || isMobileViewport === null) {
    return null;
  }

  const { id: activeId, ...activeCardProps } = activeCard;

  if (isMobileViewport) {
    return (
      <MobileLookupSheet
        card={activeCardProps}
        onClose={(options) => onCloseCard(activeId, options)}
      />
    );
  }

  return (
    <div className="relative w-full min-h-[360px]">
      {visibleCards.map((card, index) => {
        const isBottom = index === 0 && visibleCards.length > 1;
        const { id, ...cardProps } = card;

        return (
          <div
            className={`transition-all duration-300 ${
              isBottom
                ? "absolute inset-x-0 bottom-0 z-10 scale-[0.96] -translate-y-3 opacity-40 blur-[0.5px] pointer-events-none select-none"
                : "relative z-20"
            }`}
            key={id}
          >
            <LookupCard {...cardProps} onClose={() => onCloseCard(id)} />
          </div>
        );
      })}
    </div>
  );
}

function useIsMobileViewport() {
  const [isMobileViewport, setIsMobileViewport] = useState<boolean | null>(null);

  useEffect(() => {
    const mediaQuery = window.matchMedia("(max-width: 767px)");
    const updateMobileViewport = () => setIsMobileViewport(mediaQuery.matches);

    updateMobileViewport();
    mediaQuery.addEventListener("change", updateMobileViewport);
    return () => mediaQuery.removeEventListener("change", updateMobileViewport);
  }, []);

  return isMobileViewport;
}

function MobileLookupSheet({
  card,
  onClose
}: {
  card: LookupCardProps;
  onClose: (options?: { autoPlay?: boolean }) => void;
}) {
  const [dragStartY, setDragStartY] = useState<number | null>(null);

  useEffect(() => {
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.body.style.overflow = previousOverflow;
    };
  }, []);

  const handlePointerDown = (event: PointerEvent) => {
    setDragStartY(event.clientY);
  };

  const handlePointerUp = (event: PointerEvent) => {
    if (dragStartY !== null && event.clientY - dragStartY > 72) {
      onClose({ autoPlay: false });
    }
    setDragStartY(null);
  };

  return createPortal(
    <div className="fixed inset-0 z-50 flex flex-col justify-end md:hidden">
      <button
        aria-label="Close lookup sheet backdrop"
        className="absolute inset-0 bg-black/45 backdrop-blur-[1px] transition-opacity duration-300 ease-out"
        onClick={() => onClose({ autoPlay: false })}
        type="button"
      />
      <section
        aria-modal="true"
        className="relative w-full max-h-[75vh] overflow-hidden rounded-t-2xl border border-zinc-200/80 border-b-0 bg-white shadow-hero transition-transform duration-300 ease-out dark:border-zinc-800 dark:bg-[#09090B] pb-[calc(env(safe-area-inset-bottom)+12px)]"
        role="dialog"
        onPointerDown={handlePointerDown}
        onPointerUp={handlePointerUp}
      >
        <button
          aria-label="Close lookup sheet"
          className="mx-auto flex min-h-[44px] w-16 items-center justify-center"
          onClick={() => onClose({ autoPlay: false })}
          type="button"
        >
          <span className="h-1 w-12 rounded-full bg-zinc-200 dark:bg-zinc-800" />
        </button>
        <div className="max-h-[calc(75vh-44px)] overflow-y-auto px-5 pb-4">
          <LookupCard {...card} useStaticLayout={true} onClose={() => onClose({ autoPlay: true })} />
        </div>
      </section>
    </div>,
    document.body
  );
}

function getCurrentUrl() {
  if (typeof window === "undefined") return "";
  return window.location.href;
}

function buildSignInHref() {
  if (typeof window === "undefined") return "/auth/sign-in";
  const callback = `${window.location.pathname}${window.location.search}${window.location.hash}`;
  return `/auth/sign-in?callbackUrl=${encodeURIComponent(callback)}`;
}

function getDefaultVideoSource(currentTimeSec: number | undefined, sentence: string): LookupSource {
  return {
    type: "video",
    url: getCurrentUrl(),
    timestampSec: Math.max(0, Math.floor(currentTimeSec ?? 0)),
    sentence
  };
}

export function LookupCard({
  currentTimeSec,
  form,
  lookupKind = "word",
  phraseKind,
  onExampleWordClick,
  onRelatedPhraseClick,
  onClose,
  onSaved,
  originalSentence,
  translatedSentence,
  source,
  useStaticLayout
}: LookupCardProps) {
  const [lookupState, setLookupState] = useState<LookupState>({ kind: "loading" });
  const [buttonState, setButtonState] = useState<ButtonState>("disabled");
  const [showLoginHint, setShowLoginHint] = useState(false);
  const [showSaveLimitHint, setShowSaveLimitHint] = useState(false);
  const [speakingText, setSpeakingText] = useState<string | null>(null);
  const [totalEncounters, setTotalEncounters] = useState<number | null>(null);
  const normalizedForm = useMemo(() => form.trim().toLowerCase(), [form]);
  const speechAvailable = useSpeechAvailable();
  const isPhraseLookup = lookupKind === "phrase";

  useEffect(() => {
    const controller = new AbortController();
    let cancelled = false;

    async function lookupWord() {
      setLookupState({ kind: "loading" });
      setButtonState("disabled");
      setShowLoginHint(false);
      setShowSaveLimitHint(false);
      setTotalEncounters(null);

      try {
        const response = await fetch(`/api/vocab/lookup?word=${encodeURIComponent(normalizedForm)}`, {
          signal: controller.signal
        });

        if (response.status === 429) {
          setLookupState({ kind: "rateLimited" });
          setButtonState("disabled");
          return;
        }

        if (!response.ok) throw new Error(`Lookup failed: ${response.status}`);

        const payload = (await response.json()) as LookupResponse;

        if (cancelled) return;

        if (!payload.lemma || payload.meanings.length === 0) {
          setLookupState({ kind: "unsupported" });
          setButtonState("disabled");
          return;
        }

        setLookupState({
          kind: "ready",
          lemma: payload.lemma,
          morphInfo: payload.morphInfo ?? "",
          translation: payload.meanings.join("；"),
          partOfSpeech: payload.partOfSpeech ?? "",
          meanings: payload.meanings,
          examples: payload.examples ?? [],
          phonetic: payload.phonetic,
          isSaved: payload.isSaved,
          wordId: payload.wordId,
          totalEncounters: payload.totalEncounters,
          conjugations: payload.conjugations,
          nounForms: payload.nounForms,
          adjectiveForms: payload.adjectiveForms,
          relatedPhrases: payload.relatedPhrases,
          usageNote: payload.usageNote
        });
        if (payload.isSaved === true) {
          setButtonState("already_saved");
          if (typeof payload.totalEncounters === "number") {
            setTotalEncounters(payload.totalEncounters);
          }
          return;
        }
        setButtonState("default");
      } catch (error) {
        if (!cancelled) {
          console.error("Lookup failed", error, LEGACY_LEMMATIZE_ROUTE);
          setLookupState({ kind: "unsupported" });
          setButtonState("disabled");
        }
      }
    }

    void lookupWord();
    return () => {
      cancelled = true;
      controller.abort();
    };
  }, [normalizedForm]);

  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") onClose();
    };
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [onClose]);

  useEffect(() => {
    if (lookupState.kind !== "ready" || !lookupState.isSaved || !lookupState.wordId) {
      return;
    }

    const wordId = lookupState.wordId;
    const translation = lookupState.translation;
    const now = Date.now();
    const lastTriggered = globalRecentEncounters.get(wordId);

    if (lastTriggered && now - lastTriggered < 5000) {
      return;
    }

    globalRecentEncounters.set(wordId, now);

    let cancelled = false;

    async function recordEncounter() {
      const resolvedSource = source ?? getDefaultVideoSource(currentTimeSec, originalSentence);
      const sourceSentence = resolvedSource.sentence || originalSentence;

      try {
        const response = await fetch("/api/vocab/encounter", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            wordId,
            sourceType: resolvedSource.type,
            sourceUrl:
              resolvedSource.type === "lectura"
                ? `/lectura/${resolvedSource.storySlug}#p${resolvedSource.paragraphIndex}`
                : resolvedSource.type === "video"
                  ? resolvedSource.url ?? getCurrentUrl()
                  : resolvedSource.url,
            originalSentence: sourceSentence,
            translatedSentence: translatedSentence || translation,
            timestampSec:
              resolvedSource.type === "video"
                ? Math.max(0, Math.floor(resolvedSource.timestampSec ?? currentTimeSec ?? 0))
                : 0,
            courseRef:
              resolvedSource.type === "course"
                ? resolvedSource.courseRef
                : resolvedSource.type === "lectura"
                  ? `lectura:${resolvedSource.storySlug}/p${resolvedSource.paragraphIndex}`
                  : resolvedSource.type === "grammar"
                    ? `grammar:${resolvedSource.topicSlug}`
                    : resolvedSource.type === "dissect"
                      ? "dissect"
                      : resolvedSource.type === "talk"
                        ? `talk:${resolvedSource.characterId}:${resolvedSource.sessionId}:m${resolvedSource.messageIndex}`
                        : null
          })
        });

        if (cancelled) return;

        if (response.status === 401) {
          console.warn("Unauthenticated encounter recording attempt.");
          return;
        }

        if (!response.ok) {
          throw new Error(`Encounter API returned ${response.status}`);
        }

        const data = (await response.json()) as { ok: boolean; totalEncounters: number };
        if (data.ok && typeof data.totalEncounters === "number") {
          setTotalEncounters(data.totalEncounters);
        }
      } catch (error) {
        console.warn("Failed to record word encounter:", error);
      }
    }

    void recordEncounter();

    return () => {
      cancelled = true;
    };
  }, [lookupState, source, currentTimeSec, originalSentence, translatedSentence]);

  async function handleAddToVocab() {
    if (lookupState.kind !== "ready") return;

    const resolvedSource = source ?? getDefaultVideoSource(currentTimeSec, originalSentence);
    const sourceSentence = resolvedSource.sentence || originalSentence;

    setButtonState("loading");
    setShowLoginHint(false);
    setShowSaveLimitHint(false);

    try {
      const response = await fetch("/api/vocab/add", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          lemma: lookupState.lemma,
          translation: lookupState.translation,
          form: normalizedForm,
          dictData: {
            meanings: lookupState.meanings,
            examples: lookupState.examples,
            phonetic: lookupState.phonetic,
            conjugations: lookupState.conjugations,
            nounForms: lookupState.nounForms,
            adjectiveForms: lookupState.adjectiveForms
          },
          partOfSpeech: lookupState.partOfSpeech,
          sourceType: resolvedSource.type,
          sourceUrl:
            resolvedSource.type === "lectura"
              ? `/lectura/${resolvedSource.storySlug}#p${resolvedSource.paragraphIndex}`
              : resolvedSource.type === "video"
                ? resolvedSource.url ?? getCurrentUrl()
                : resolvedSource.url,
          timestampSec:
            resolvedSource.type === "video"
              ? Math.max(0, Math.floor(resolvedSource.timestampSec ?? currentTimeSec ?? 0))
              : 0,
          courseRef:
            resolvedSource.type === "course"
              ? resolvedSource.courseRef
              : resolvedSource.type === "lectura"
                ? `lectura:${resolvedSource.storySlug}/p${resolvedSource.paragraphIndex}`
                : resolvedSource.type === "grammar"
                  ? `grammar:${resolvedSource.topicSlug}`
                  : resolvedSource.type === "dissect"
                    ? "dissect"
                    : resolvedSource.type === "talk"
                      ? `talk:${resolvedSource.characterId}:${resolvedSource.sessionId}:m${resolvedSource.messageIndex}`
                      : null,
          originalSentence: sourceSentence,
          translatedSentence: translatedSentence || lookupState.translation
        })
      });

      if (response.status === 401) {
        setButtonState("login");
        setShowLoginHint(true);
        return;
      }

      if (response.status === 429) {
        setShowLoginHint(false);
        setButtonState("default");
        return;
      }

      if (response.status === 403) {
        setButtonState("default");
        setShowSaveLimitHint(true);
        return;
      }

      if (!response.ok) throw new Error(`Save failed: ${response.status}`);

      setButtonState("success");
      onSaved?.();
    } catch (error) {
      console.error("Save vocab failed", error);
      setButtonState("default");
    }
  }

  async function handleSavePhrase() {
    if (lookupState.kind !== "ready") return;

    setButtonState("loading");
    setShowLoginHint(false);
    setShowSaveLimitHint(false);

    try {
      const response = await fetch("/api/vocab/phrase/add", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          lemma: lookupState.lemma,
          kind: phraseKind ?? "phrase",
          translationZh: lookupState.translation,
          explanationZh: lookupState.usageNote || lookupState.morphInfo,
          data: {
            meanings: lookupState.meanings,
            examples: lookupState.examples,
            phonetic: lookupState.phonetic,
            source
          }
        })
      });

      if (response.status === 401) {
        setButtonState("login");
        setShowLoginHint(true);
        return;
      }

      if (response.status === 429) {
        setButtonState("default");
        return;
      }

      if (response.status === 403) {
        setButtonState("default");
        setShowSaveLimitHint(true);
        return;
      }

      if (!response.ok) throw new Error(`Save phrase failed: ${response.status}`);

      setButtonState("success");
      onSaved?.();
    } catch (error) {
      console.error("Save phrase failed", error);
      setButtonState("default");
    }
  }

  const handlePrimarySave = isPhraseLookup ? handleSavePhrase : handleAddToVocab;

  const isReady = lookupState.kind === "ready";
  const lemma = isReady ? lookupState.lemma : normalizedForm;
  const partOfSpeech = isReady ? lookupState.partOfSpeech : "";
  const meanings = isReady ? lookupState.meanings : [];
  const example = isReady ? lookupState.examples[0] : null;
  const phonetic = isReady ? lookupState.phonetic : null;

  const handleSpeakLemma = () => {
    const didSpeak = speak(lemma, {
      rate: 0.9,
      onStart: () => setSpeakingText(lemma),
      onEnd: () => setSpeakingText(null)
    });

    if (didSpeak) {
      setSpeakingText(lemma);
    }
  };

  const handleSpeakExample = () => {
    if (!example) {
      return;
    }

    const didSpeak = speak(example.es, {
      rate: 0.85,
      onStart: () => setSpeakingText(example.es),
      onEnd: () => setSpeakingText(null)
    });

    if (didSpeak) {
      setSpeakingText(example.es);
    }
  };

  return (
    <div
      className={
        useStaticLayout
          ? "w-full bg-transparent text-gray-900 dark:text-zinc-100"
          : `absolute left-1/2 top-full z-20 mt-3 w-[300px] max-w-[min(20rem,calc(100vw-2rem))] -translate-x-1/2 rounded-xl border border-black/5 bg-surface p-4 shadow-elevated ${isPhraseLookup ? "overflow-hidden pt-5" : ""}`
      }
      data-testid="lookup-card"
    >
      {isPhraseLookup ? (
        <div className="absolute top-0 left-0 right-0 h-1 bg-amber-500 dark:bg-amber-600" />
      ) : null}

      {/* 词头区 Word Header */}
      {useStaticLayout ? (
        <div className="flex items-start justify-between gap-3">
          <div className="min-w-0 flex-1">
            <div className="flex items-center gap-2.5">
              <h3 className="truncate text-2xl font-extrabold tracking-tight text-zinc-900 dark:text-zinc-50 font-display">
                {lemma}
              </h3>
              {isPhraseLookup ? (
                <span className="shrink-0 rounded bg-amber-50 dark:bg-amber-950/40 border border-amber-200/30 dark:border-amber-800/30 px-1.5 py-0.5 text-[11px] font-medium text-amber-700 dark:text-amber-400">
                  {getPhraseKindLabel(phraseKind)}
                </span>
              ) : null}
              {!isPhraseLookup && partOfSpeech ? (
                <span className="shrink-0 rounded bg-zinc-100 dark:bg-zinc-800/60 text-zinc-600 dark:text-zinc-400 px-1.5 py-0.5 text-[11px] font-medium">
                  {partOfSpeech}
                </span>
              ) : null}
              {isReady && speechAvailable ? (
                <button
                  aria-label={`Play pronunciation for ${lemma}`}
                  className={`flex h-8 w-8 items-center justify-center rounded-full border text-xs transition duration-200 ${
                    speakingText === lemma
                      ? "animate-pulse border-brand-500 bg-brand-500/10 text-brand-700 dark:text-brand-400"
                      : "border-zinc-200 dark:border-zinc-800 text-brand-600 dark:text-brand-400 bg-brand-500/5 hover:bg-brand-500/10 dark:bg-brand-500/10 dark:hover:bg-brand-500/20"
                  }`}
                  onClick={handleSpeakLemma}
                  type="button"
                >
                  <svg className="h-[18px] w-[18px]" fill="none" stroke="currentColor" strokeWidth="2.5" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg">
                    <path strokeLinecap="round" strokeLinejoin="round" d="M19.114 5.636a9 9 0 010 12.728M16.463 8.288a5.25 5.25 0 010 7.424M6.75 8.25l4.72-4.72a.75.75 0 011.28.53v15.88a.75.75 0 01-1.28.53l-4.72-4.72H4.51c-.88 0-1.704-.507-1.938-1.354A9.01 9.01 0 012.25 12c0-.83.112-1.633.322-2.396C2.806 8.756 3.63 8.25 4.51 8.25H6.75z" />
                  </svg>
                </button>
              ) : null}
            </div>

            <div className="flex items-center gap-2 mt-1.5">
              {phonetic ? <p className="text-xs text-zinc-400 dark:text-zinc-500 font-mono">/{phonetic}/</p> : null}
              {isReady && lookupState.morphInfo ? (
                <p className="text-xs text-zinc-400 dark:text-zinc-500 font-light">{lookupState.morphInfo}</p>
              ) : null}
            </div>

            {buttonState === "already_saved" && (
              <div className="mt-2.5 flex items-center gap-1.5 rounded-full bg-brand-500/10 text-brand-700 dark:text-brand-400 border border-brand-500/20 px-2.5 py-0.5 text-xs font-semibold w-fit">
                <svg className="h-3 w-3" fill="none" stroke="currentColor" strokeWidth="3.5" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" d="M4.5 12.75l6 6 9-13.5" />
                </svg>
                <span>已学习</span>
              </div>
            )}
          </div>

          <div className="flex items-center gap-2">
            {isReady && (
              <button
                onClick={handlePrimarySave}
                disabled={buttonState === "already_saved" || buttonState === "loading" || buttonState === "success"}
                className={`p-1.5 rounded-full transition duration-300 ${
                  buttonState === "already_saved" || buttonState === "success"
                    ? "text-brand-600 dark:text-brand-400 hover:text-brand-700 scale-105"
                    : "text-zinc-300 dark:text-zinc-600 hover:text-brand-600 dark:hover:text-brand-400"
                }`}
                type="button"
                aria-label="Add to vocabulary"
              >
                <svg className="h-5 w-5" fill={buttonState === "already_saved" || buttonState === "success" ? "currentColor" : "none"} stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" d="M21 8.25c0-2.485-2.099-4.5-4.688-4.5-1.935 0-3.597 1.126-4.312 2.733-.715-1.607-2.377-2.733-4.313-2.733C5.1 3.75 3 5.765 3 8.25c0 7.22 9 12 9 12s9-4.78 9-12z" />
                </svg>
              </button>
            )}
            <button
              className="shrink-0 text-xs text-gray-400 transition hover:text-gray-600"
              onClick={onClose}
              type="button"
            >
              关闭
            </button>
          </div>
        </div>
      ) : (
        <div className="flex items-start justify-between gap-3">
          <div className="min-w-0 flex-1">
            <div className="flex items-center gap-2">
              <p className="truncate text-[17px] font-bold text-gray-900 dark:text-zinc-100">{lemma}</p>
              {isPhraseLookup ? (
                <span className="shrink-0 rounded bg-amber-50 dark:bg-amber-950/40 border border-amber-200/30 dark:border-amber-800/30 px-1.5 py-0.5 text-[11px] font-medium text-amber-700 dark:text-amber-400">
                  {getPhraseKindLabel(phraseKind)}
                </span>
              ) : null}
              {!isPhraseLookup && partOfSpeech ? (
                <span className="shrink-0 rounded bg-gray-100 dark:bg-zinc-800 text-gray-500 dark:text-zinc-400 px-1.5 py-0.5 text-[11px] font-medium">
                  {partOfSpeech}
                </span>
              ) : null}
              {isReady && speechAvailable ? (
                <button
                  aria-label={`Play pronunciation for ${lemma}`}
                  className={`flex h-7 w-7 items-center justify-center rounded-full border text-xs transition ${
                    speakingText === lemma
                      ? "animate-pulse border-brand-500 bg-brand-50 text-brand-600"
                      : "border-gray-200 text-gray-400 hover:border-brand-500 hover:text-brand-600"
                  }`}
                  onClick={handleSpeakLemma}
                  type="button"
                >
                  {">"}
                </button>
              ) : null}
            </div>
            {phonetic ? <p className="mt-1 text-xs text-gray-400">/{phonetic}/</p> : null}
            {isReady && lookupState.morphInfo ? (
              <p className="mt-1 text-xs text-gray-400">{lookupState.morphInfo}</p>
            ) : null}
          </div>
          <button
            className="shrink-0 text-xs text-gray-400 transition hover:text-gray-600"
            onClick={onClose}
            type="button"
          >
            关闭
          </button>
        </div>
      )}

      {/* 翻译/释义区 Dictionary Translation */}
      <div className="mt-4">
        {lookupState.kind === "loading" ? (
          <p className="text-sm text-zinc-400 dark:text-zinc-500 animate-pulse">查询中...</p>
        ) : lookupState.kind === "rateLimited" ? (
          <EmptyState
            description="等一小会儿再点这个词"
            kind="loading-failed"
            size="sm"
            title="查询过于频繁"
          />
        ) : lookupState.kind === "unsupported" ? (
          <EmptyState
            description="可能是少见词或拼写差异"
            kind="error"
            size="sm"
            title="暂时查不到这个词"
          />
        ) : meanings.length > 0 ? (
          useStaticLayout ? (
            <ol className="space-y-1.5 pl-4 text-sm text-zinc-800 dark:text-zinc-200 leading-relaxed font-sans" style={{ listStyleType: "decimal" }}>
              {meanings.map((meaning) => (
                <li key={meaning} className="pl-0.5">{meaning}</li>
              ))}
            </ol>
          ) : (
            <ol className="space-y-1 pl-4 text-sm text-gray-700 dark:text-zinc-300" style={{ listStyleType: "decimal" }}>
              {meanings.map((meaning) => (
                <li key={meaning}>{meaning}</li>
              ))}
            </ol>
          )
        ) : null}
      </div>

      {/* 用法提示 Usage Note */}
      {isReady && lookupState.usageNote && (
        useStaticLayout ? (
          <div className="mt-3 p-3 bg-amber-500/5 dark:bg-amber-500/10 border-l-2 border-brand-500 rounded-r-xl text-xs leading-relaxed text-zinc-600 dark:text-zinc-300">
            <span className="font-semibold text-brand-600 dark:text-brand-400 mr-1.5">用法提示</span>
            {lookupState.usageNote}
          </div>
        ) : (
          <div className="mt-2.5 p-2.5 bg-zinc-50 dark:bg-zinc-800/30 border-l-2 border-brand-500 dark:border-brand-500 rounded-r-lg text-xs leading-relaxed text-zinc-600 dark:text-zinc-400">
            <span className="font-semibold text-brand-600 dark:text-brand-400 mr-1.5">用法提示</span>
            {lookupState.usageNote}
          </div>
        )
      )}

      {/* 遭遇卡片/例句 Encounter Card */}
      {example ? (
        useStaticLayout ? (
          <div className="mt-4">
            <div className="flex justify-between items-center text-[10px] font-bold text-zinc-400 dark:text-zinc-500 uppercase tracking-widest mb-2">
              <span>你在今天遇到了</span>
              <button
                onClick={handlePrimarySave}
                className="text-brand-600 dark:text-brand-400 hover:text-brand-700 transition p-0.5"
                type="button"
                disabled={buttonState === "already_saved" || buttonState === "loading"}
                aria-label="Add to vocabulary from encounter"
              >
                <svg className="h-4 w-4" fill="none" stroke="currentColor" strokeWidth="2.5" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" d="M12 4.5v15m7.5-7.5h-15" />
                </svg>
              </button>
            </div>
            <div className="rounded-2xl bg-zinc-50 dark:bg-zinc-950/60 border border-zinc-100 dark:border-zinc-800/40 p-3.5 shadow-sm">
              <div className="flex items-start gap-2">
                <p className="min-w-0 flex-1 text-sm italic text-zinc-700 dark:text-zinc-300 leading-relaxed font-sans">
                  {onExampleWordClick
                    ? splitExampleTokens(example.es).map((token, index) => {
                        const normalized = normalizeExampleWord(token);
                        if (!normalized) return <span key={`${token}-${index}`}>{token}</span>;

                        const isTarget = normalized === normalizedForm;
                        return (
                          <button
                            className={`rounded px-0.5 text-left transition ${
                              isTarget
                                ? "text-brand-600 dark:text-brand-400 font-bold hover:bg-brand-500/10"
                                : "hover:bg-zinc-200/50 dark:hover:bg-zinc-800/50 hover:text-zinc-950 dark:hover:text-white"
                            }`}
                            key={`${token}-${index}`}
                            onClick={(event) => {
                              event.stopPropagation();
                              onExampleWordClick(normalized);
                            }}
                            type="button"
                          >
                            {token}
                          </button>
                        );
                      })
                    : example.es}
                </p>
                {speechAvailable ? (
                  <button
                    aria-label="Play example sentence"
                    className={`flex h-[26px] w-[26px] shrink-0 items-center justify-center rounded-full border text-[11px] transition ${
                      speakingText === example.es
                        ? "animate-pulse border-brand-500 bg-brand-500/10 text-brand-600 dark:text-brand-400"
                        : "border-zinc-200 dark:border-zinc-800 text-zinc-400 dark:text-zinc-500 hover:border-brand-500/30 hover:text-brand-600 dark:hover:text-brand-400"
                    }`}
                    onClick={handleSpeakExample}
                    type="button"
                  >
                    <svg className="h-3 w-3 fill-current" viewBox="0 0 24 24">
                      <path d="M8 5v14l11-7z" />
                    </svg>
                  </button>
                ) : null}
              </div>

              <p className="mt-1 text-xs text-zinc-400 dark:text-zinc-500 leading-normal font-sans">{example.zh}</p>

              <div className="mt-2.5 flex items-center gap-1.5 text-[11px] text-zinc-400 dark:text-zinc-500 font-light">
                <svg className="h-3.5 w-3.5" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" d="M6 20.25h12A2.25 2.25 0 0020.25 18V6A2.25 2.25 0 0018 3.75H6A2.25 2.25 0 003.75 6v12A2.25 2.25 0 006 20.25z" />
                  <path strokeLinecap="round" strokeLinejoin="round" d="M15.75 6.75L12 10.5l-3.75-3.75M12 10.5v8.25" />
                </svg>
                <span className="truncate font-sans">
                  {source?.type === "video" ? "遭遇视频" : source?.type === "lectura" ? "阅读" : "对话"}
                </span>
              </div>
            </div>
          </div>
        ) : (
          <div className="mt-3 rounded-lg bg-gray-50 dark:bg-zinc-800/30 px-3 py-2">
            <div className="flex items-start gap-2">
              <p className="min-w-0 flex-1 text-xs italic text-gray-600 dark:text-zinc-300">
                {onExampleWordClick
                  ? splitExampleTokens(example.es).map((token, index) => {
                      const normalized = normalizeExampleWord(token);
                      if (!normalized) return <span key={`${token}-${index}`}>{token}</span>;
                      return (
                        <button
                          className="rounded px-0.5 text-left transition hover:bg-brand-50 hover:text-brand-700 dark:hover:bg-brand-950/30"
                          key={`${token}-${index}`}
                          onClick={(event) => {
                            event.stopPropagation();
                            onExampleWordClick(normalized);
                          }}
                          type="button"
                        >
                          {token}
                        </button>
                      );
                    })
                  : example.es}
              </p>
              {speechAvailable ? (
                <button
                  aria-label="Play example sentence"
                  className={`flex h-6 w-6 shrink-0 items-center justify-center rounded-full border text-[11px] transition ${
                    speakingText === example.es
                      ? "animate-pulse border-brand-500 bg-brand-50 text-brand-600"
                      : "border-gray-200 text-gray-400 hover:border-brand-500 hover:text-brand-600"
                  }`}
                  onClick={handleSpeakExample}
                  type="button"
                >
                  {">"}
                </button>
              ) : null}
            </div>
            <p className="mt-0.5 text-xs text-gray-400">{example.zh}</p>
          </div>
        )
      ) : null}

      {/* 相关搭配 Related Phrases */}
      {lookupKind === "word" && isReady && lookupState.relatedPhrases && lookupState.relatedPhrases.length > 0 && (
        <div className={useStaticLayout ? "mt-5 space-y-2" : "mt-3.5 space-y-2"}>
          <h4 className={
            useStaticLayout
              ? "text-[10px] font-bold text-zinc-400 dark:text-zinc-500 uppercase tracking-widest"
              : "text-xs font-semibold text-zinc-400 dark:text-zinc-500 uppercase tracking-wider"
          }>相关搭配</h4>
          <div className={useStaticLayout ? "space-y-1.5" : "space-y-1"}>
            {lookupState.relatedPhrases.map((phrase) => (
              <button
                key={phrase.lemma}
                type="button"
                onClick={() => onRelatedPhraseClick?.(phrase.lemma, phrase.kind)}
                className={
                  useStaticLayout
                    ? "flex items-center justify-between w-full text-left rounded-xl p-2.5 bg-zinc-50 dark:bg-zinc-950/60 border border-zinc-100 dark:border-zinc-800/40 hover:border-brand-500/30 transition duration-150 group"
                    : "flex items-center justify-between w-full text-left rounded-lg p-2 bg-transparent hover:bg-zinc-50 dark:hover:bg-zinc-800/40 border border-transparent hover:border-zinc-200/50 dark:hover:border-zinc-800/50 transition duration-150 group"
                }
              >
                <div className={
                  useStaticLayout
                    ? "flex items-center gap-2 min-w-0 font-sans"
                    : "flex items-center gap-2 min-w-0"
                }>
                  <span className={
                    useStaticLayout
                      ? "text-sm font-semibold text-zinc-800 dark:text-zinc-200 group-hover:text-brand-600 dark:group-hover:text-brand-400 transition truncate"
                      : "text-sm font-semibold text-zinc-800 dark:text-zinc-200 group-hover:text-brand-600 dark:group-hover:text-brand-400 truncate"
                  }>
                    {phrase.lemma}
                  </span>
                  <span className="text-xs text-zinc-400 dark:text-zinc-500 truncate">
                    · {phrase.translationZh}
                  </span>
                </div>
                <span className="shrink-0 rounded bg-amber-50 dark:bg-amber-950/40 border border-amber-200/30 dark:border-amber-800/30 px-1.5 py-0.5 text-[10px] font-semibold text-amber-700 dark:text-amber-400 tracking-wider">
                  {getPhraseKindLabel(phrase.kind)}
                </span>
              </button>
            ))}
          </div>
        </div>
      )}

      {/* 底部保存生词本 Actions */}
      <div className={
        useStaticLayout
          ? "mt-4 border-t border-zinc-100 dark:border-zinc-800/50 pt-3.5"
          : "mt-3 border-t border-gray-100 pt-3"
      }>
        {showLoginHint ? (
          useStaticLayout ? (
            <>
              <p className="mb-2.5 text-xs text-zinc-500 dark:text-zinc-400 text-center font-sans">
                登录后才能保存到生词本，下次还能查到
              </p>
              <a
                className="block h-11 w-full rounded-full bg-brand-500 text-center text-sm font-semibold flex items-center justify-center text-white transition hover:bg-brand-600 shadow-md"
                href={buildSignInHref()}
              >
                登录 / 注册
              </a>
            </>
          ) : (
            <>
              <p className="mb-2 text-xs text-gray-500">
                登录后才能保存到生词本，下次还能查到
              </p>
              <a
                className="block h-8 w-full rounded-md bg-brand-500 text-center text-sm font-medium leading-8 text-white transition hover:bg-brand-600"
                href={buildSignInHref()}
              >
                登录 / 注册
              </a>
            </>
          )
        ) : showSaveLimitHint ? (
          useStaticLayout ? (
            <>
              <p className="mb-2.5 text-center text-xs text-zinc-500 dark:text-zinc-400 font-sans">
                免费方案收藏上限为 50，升级后即可继续保存。
              </p>
              <a
                className="block h-11 w-full rounded-full bg-brand-500 text-center text-sm font-semibold flex items-center justify-center text-white transition hover:bg-brand-600 shadow-md"
                href="/membership"
              >
                查看会员方案
              </a>
            </>
          ) : (
            <>
              <p className="mb-2 text-xs text-gray-500">
                免费方案收藏上限为 50，升级后即可继续保存。
              </p>
              <a
                className="block h-8 w-full rounded-md bg-brand-500 text-center text-sm font-medium leading-8 text-white transition hover:bg-brand-600"
                href="/membership"
              >
                查看会员方案
              </a>
            </>
          )
        ) : (
          <button
            className={
              useStaticLayout
                ? `h-11 w-full rounded-full text-sm font-semibold transition flex items-center justify-center gap-2 shadow-sm ${
                    buttonState === "default"
                      ? "bg-brand-500 hover:bg-brand-600 text-white hover:shadow-md active:scale-[0.99]"
                      : buttonState === "loading"
                        ? "cursor-progress bg-brand-500/70 text-white opacity-70"
                        : buttonState === "already_saved"
                          ? "bg-zinc-100 dark:bg-zinc-800/40 text-zinc-400 dark:text-zinc-500 cursor-default shadow-none border border-transparent dark:border-zinc-800/50"
                          : buttonState === "success"
                            ? "bg-brand-500 text-white"
                            : "cursor-default bg-zinc-100 text-zinc-400"
                  }`
                : `h-8 w-full rounded-md text-sm font-medium transition ${
                    buttonState === "default"
                      ? "bg-brand-50 text-brand-600 hover:bg-brand-100"
                      : buttonState === "loading"
                        ? "cursor-progress bg-brand-50 text-brand-600 opacity-70"
                        : buttonState === "already_saved"
                          ? "bg-amber-50 text-amber-600 cursor-default"
                          : buttonState === "success"
                            ? "bg-brand-50 text-brand-600"
                            : "cursor-default bg-gray-100 text-gray-400"
                  }`
            }
            disabled={
              !isReady ||
              buttonState === "loading" ||
              buttonState === "success" ||
              buttonState === "already_saved"
            }
            onClick={handlePrimarySave}
            type="button"
          >
            {buttonState === "already_saved" && useStaticLayout && (
              <svg className="h-4 w-4 text-zinc-400 dark:text-zinc-500" fill="none" stroke="currentColor" strokeWidth="3" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" d="M4.5 12.75l6 6 9-13.5" />
              </svg>
            )}
            {buttonState === "loading"
              ? isPhraseLookup
                ? "收藏中..."
                : "保存中..."
              : buttonState === "already_saved"
                ? "已加入词库"
                : buttonState === "success"
                  ? isPhraseLookup
                    ? "已收藏短语"
                    : "已加入词库"
                  : lookupState.kind === "unsupported"
                    ? "无法查词"
                    : isPhraseLookup
                      ? "收藏短语"
                      : "加入我的词库"}
          </button>
        )}
        {buttonState === "already_saved" && totalEncounters !== null && (
          <p className={
            useStaticLayout
              ? "mt-2 text-center text-xs text-zinc-400 dark:text-zinc-500 font-light font-sans"
              : "mt-2 text-center text-xs text-gray-400"
          } data-testid="encounter-badge">
            第 {totalEncounters} 次遇到 · 已记录
          </p>
        )}
      </div>
    </div>
  );
}
