"use client";

import { useEffect, useMemo, useState } from "react";

type LookupCardProps = {
  currentTimeSec: number;
  form: string;
  onClose: () => void;
  originalSentence: string;
  translatedSentence: string;
};

type LemmaResponse = {
  lemma: string | null;
  morphInfo: string | null;
  translation: string | null;
  partOfSpeech: string | null;
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
    };

function getSourceUrl() {
  if (typeof window === "undefined") {
    return "";
  }

  return window.location.href;
}

export function LookupCard({
  currentTimeSec,
  form,
  onClose,
  originalSentence,
  translatedSentence
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
        const response = await fetch("/api/lemmatize", {
          method: "POST",
          headers: {
            "Content-Type": "application/json"
          },
          body: JSON.stringify({ form: normalizedForm }),
          signal: controller.signal
        });

        if (!response.ok) {
          throw new Error(`Lemmatize failed: ${response.status}`);
        }

        const payload = (await response.json()) as LemmaResponse;

        if (cancelled) {
          return;
        }

        if (!payload.lemma || !payload.translation) {
          setLookupState({ kind: "unsupported" });
          setButtonState("disabled");
          return;
        }

        setLookupState({
          kind: "ready",
          lemma: payload.lemma,
          morphInfo: payload.morphInfo ?? "",
          translation: payload.translation,
          partOfSpeech: payload.partOfSpeech ?? ""
        });
        setButtonState("default");
      } catch (error) {
        if (!cancelled) {
          console.error("Lookup failed", error);
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
      if (event.key === "Escape") {
        onClose();
      }
    };

    window.addEventListener("keydown", onKeyDown);
    return () => {
      window.removeEventListener("keydown", onKeyDown);
    };
  }, [onClose]);

  async function handleAddToVocab() {
    if (lookupState.kind !== "ready") {
      return;
    }

    setButtonState("loading");
    setShowLoginHint(false);

    try {
      const response = await fetch("/api/vocab/add", {
        method: "POST",
        headers: {
          "Content-Type": "application/json"
        },
        body: JSON.stringify({
          lemma: lookupState.lemma,
          translation: lookupState.translation,
          form: normalizedForm,
          sourceUrl: getSourceUrl(),
          timestampSec: Math.max(0, Math.floor(currentTimeSec)),
          originalSentence,
          translatedSentence: translatedSentence || lookupState.translation
        })
      });

      if (response.status === 401) {
        setButtonState("login");
        setShowLoginHint(true);
        return;
      }

      if (!response.ok) {
        throw new Error(`Save failed: ${response.status}`);
      }

      setButtonState("success");
    } catch (error) {
      console.error("Save vocab failed", error);
      setButtonState("default");
    }
  }

  const isReady = lookupState.kind === "ready";
  const lemma = isReady ? lookupState.lemma : normalizedForm;
  const morphInfo = isReady ? lookupState.morphInfo : "";
  const translation = isReady
    ? lookupState.translation
    : lookupState.kind === "loading"
      ? "查询中…"
      : "暂不支持该词";
  const partOfSpeech = isReady ? lookupState.partOfSpeech : "";

  return (
    <div className="absolute left-1/2 top-full z-20 mt-3 w-[280px] -translate-x-1/2 rounded-xl border border-black/5 bg-white p-4 shadow-[0_4px_16px_rgba(0,0,0,0.18),0_1px_4px_rgba(0,0,0,0.10)]">
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
          {morphInfo ? <p className="mt-1 text-xs text-gray-500">{morphInfo}</p> : null}
        </div>
        <button
          className="shrink-0 text-xs text-gray-400 transition hover:text-gray-600"
          onClick={onClose}
          type="button"
        >
          关闭
        </button>
      </div>

      <p
        className={`mt-3 text-sm ${
          lookupState.kind === "unsupported" ? "text-gray-400" : "text-gray-700"
        }`}
      >
        {translation}
      </p>

      <div className="mt-3 border-t border-gray-100 pt-3">
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
            buttonState === "success" ||
            buttonState === "login"
          }
          onClick={handleAddToVocab}
          type="button"
        >
          {buttonState === "loading"
            ? "保存中…"
            : buttonState === "success"
              ? "已加入词库"
              : buttonState === "login"
                ? "请先登录"
                : lookupState.kind === "unsupported"
                  ? "无法查词"
                  : "加入我的词库"}
        </button>
        {showLoginHint ? (
          <a
            className="mt-2 block text-center text-xs text-gray-400 hover:text-gray-600"
            href="/api/auth/signin"
            rel="noreferrer"
            target="_blank"
          >
            前往 Esponal 登录
          </a>
        ) : null}
      </div>
    </div>
  );
}
