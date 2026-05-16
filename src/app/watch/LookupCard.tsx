"use client";

import { useEffect, useMemo, useState } from "react";

type LookupSource =
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
    };

type LookupCardProps = {
  currentTimeSec?: number;
  form: string;
  onClose: () => void;
  originalSentence: string;
  translatedSentence: string;
  source?: LookupSource;
};

type LookupResponse = {
  word: string;
  lemma: string | null;
  morphInfo: string | null;
  partOfSpeech: string | null;
  meanings: string[];
  examples: { es: string; zh: string }[];
  phonetic: string | null;
  degraded?: boolean;
};

type ButtonState = "default" | "loading" | "success" | "login" | "disabled";

type LookupState =
  | { kind: "loading" }
  | { kind: "unsupported" }
  | {
      kind: "ready";
      lemma: string;
      morphInfo: string;
      translation: string;
      partOfSpeech: string;
      meanings: string[];
      examples: { es: string; zh: string }[];
      phonetic: string | null;
    };

const LEGACY_LEMMATIZE_ROUTE = "/api/lemmatize";

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
  onClose,
  originalSentence,
  translatedSentence,
  source
}: LookupCardProps) {
  const [lookupState, setLookupState] = useState<LookupState>({ kind: "loading" });
  const [buttonState, setButtonState] = useState<ButtonState>("disabled");
  const [showLoginHint, setShowLoginHint] = useState(false);
  const normalizedForm = useMemo(() => form.trim().toLowerCase(), [form]);

  useEffect(() => {
    const controller = new AbortController();
    let cancelled = false;

    async function lookupWord() {
      setLookupState({ kind: "loading" });
      setButtonState("disabled");
      setShowLoginHint(false);

      try {
        const response = await fetch(`/api/vocab/lookup?word=${encodeURIComponent(normalizedForm)}`, {
          signal: controller.signal
        });

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
          phonetic: payload.phonetic
        });
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
            phonetic: lookupState.phonetic
          },
          partOfSpeech: lookupState.partOfSpeech,
          sourceType: resolvedSource.type,
          sourceUrl: resolvedSource.type === "course" ? resolvedSource.url : resolvedSource.url ?? getCurrentUrl(),
          timestampSec:
            resolvedSource.type === "video"
              ? Math.max(0, Math.floor(resolvedSource.timestampSec ?? currentTimeSec ?? 0))
              : 0,
          courseRef: resolvedSource.type === "course" ? resolvedSource.courseRef : null,
          originalSentence: sourceSentence,
          translatedSentence: translatedSentence || lookupState.translation
        })
      });

      if (response.status === 401) {
        setButtonState("login");
        setShowLoginHint(true);
        return;
      }

      if (!response.ok) throw new Error(`Save failed: ${response.status}`);

      setButtonState("success");
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

  return (
    <div className="absolute left-1/2 top-full z-20 mt-3 w-[300px] -translate-x-1/2 rounded-xl border border-black/5 bg-white p-4 shadow-[0_4px_16px_rgba(0,0,0,0.18),0_1px_4px_rgba(0,0,0,0.10)]">
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <div className="flex items-center gap-2">
            <p className="truncate text-[17px] font-bold text-gray-900">{lemma}</p>
            {partOfSpeech ? (
              <span className="rounded bg-gray-100 px-1.5 py-0.5 text-[11px] text-gray-500">
                {partOfSpeech}
              </span>
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
        ) : lookupState.kind === "unsupported" ? (
          <p className="text-sm text-gray-400">暂不支持该词</p>
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
          <p className="text-xs italic text-gray-600">{example.es}</p>
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
              className="block h-8 w-full rounded-md bg-emerald-500 text-center text-sm font-medium leading-8 text-white transition hover:bg-emerald-600"
              href={buildSignInHref()}
            >
              登录 / 注册
            </a>
          </>
        ) : (
          <button
            className={`h-8 w-full rounded-md text-sm font-medium transition ${
              buttonState === "default"
                ? "bg-emerald-50 text-emerald-600 hover:bg-emerald-100"
                : buttonState === "loading"
                  ? "cursor-progress bg-emerald-50 text-emerald-600 opacity-70"
                  : buttonState === "success"
                    ? "bg-emerald-50 text-emerald-600"
                    : "cursor-default bg-gray-100 text-gray-400"
            }`}
            disabled={
              !isReady ||
              buttonState === "loading" ||
              buttonState === "success"
            }
            onClick={handleAddToVocab}
            type="button"
          >
            {buttonState === "loading"
              ? "保存中..."
              : buttonState === "success"
                ? "已加入词库"
                : lookupState.kind === "unsupported"
                  ? "无法查词"
                  : "加入我的词库"}
          </button>
        )}
      </div>
    </div>
  );
}
