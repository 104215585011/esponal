"use client";

import { useEffect, useMemo, useState } from "react";
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

type LookupCardProps = {
  currentTimeSec?: number;
  form: string;
  lookupKind?: "word" | "phrase";
  phraseKind?: "collocation" | "phrase" | "idiom";
  onExampleWordClick?: (form: string) => void;
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
  onCloseCard: (id: string) => void;
}) {
  const visibleCards = cards.slice(-2);

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
          adjectiveForms: payload.adjectiveForms
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

      if (!response.ok) throw new Error(`Save failed: ${response.status}`);

      setButtonState("success");
      onSaved?.();
    } catch (error) {
      console.error("Save vocab failed", error);
      setButtonState("default");
    }
  }

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
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <div className="flex items-center gap-2">
            <p className="truncate text-[17px] font-bold text-gray-900">{lemma}</p>
            {isPhraseLookup ? (
              <span className="rounded bg-amber-50 dark:bg-amber-950/40 border border-amber-200/30 dark:border-amber-800/30 px-1.5 py-0.5 text-[11px] font-medium text-amber-700 dark:text-amber-400">
                {getPhraseKindLabel(phraseKind)}
              </span>
            ) : null}
            {partOfSpeech ? (
              <span className="rounded bg-gray-100 px-1.5 py-0.5 text-[11px] text-gray-500">
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

      <div className="mt-3">
        {lookupState.kind === "loading" ? (
          <p className="text-sm text-gray-400">查询中...</p>
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
          <ol className="space-y-1 pl-4 text-sm text-gray-700" style={{ listStyleType: "decimal" }}>
            {meanings.map((meaning) => (
              <li key={meaning}>{meaning}</li>
            ))}
          </ol>
        ) : null}
      </div>

      {example ? (
        <div className="mt-3 rounded-lg bg-gray-50 px-3 py-2">
          <div className="flex items-start gap-2">
            <p className="min-w-0 flex-1 text-xs italic text-gray-600">
              {onExampleWordClick
                ? splitExampleTokens(example.es).map((token, index) => {
                    const normalized = normalizeExampleWord(token);
                    if (!normalized) return <span key={`${token}-${index}`}>{token}</span>;
                    return (
                      <button
                        className="rounded px-0.5 text-left transition hover:bg-brand-50 hover:text-brand-700"
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
      ) : null}

      <div className="mt-3 border-t border-gray-100 pt-3">
        {showLoginHint ? (
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
        ) : (
          <button
            className={`h-8 w-full rounded-md text-sm font-medium transition ${
              buttonState === "default"
                ? "bg-brand-50 text-brand-600 hover:bg-brand-100"
                : buttonState === "loading"
                  ? "cursor-progress bg-brand-50 text-brand-600 opacity-70"
                  : buttonState === "already_saved"
                    ? "bg-amber-50 text-amber-600 cursor-default"
                  : buttonState === "success"
                    ? "bg-brand-50 text-brand-600"
                    : "cursor-default bg-gray-100 text-gray-400"
            }`}
            disabled={
              !isReady ||
              buttonState === "loading" ||
              buttonState === "success" ||
              buttonState === "already_saved"
            }
            onClick={handleAddToVocab}
            type="button"
          >
            {buttonState === "loading"
              ? "保存中.."
              : buttonState === "already_saved"
                ? "已加入词库"
                : buttonState === "success"
                  ? "已加入词库"
                  : lookupState.kind === "unsupported"
                    ? "无法查词"
                    : "加入我的词库"}
          </button>
        )}
        {buttonState === "already_saved" && totalEncounters !== null && (
          <p className="mt-2 text-center text-xs text-gray-400 dark:text-zinc-500 font-light" data-testid="encounter-badge">
            第 {totalEncounters} 次遇到 · 已记录
          </p>
        )}
      </div>
    </div>
  );
}
