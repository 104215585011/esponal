// Timestamp: 2026-06-03 11:10
"use client";

import Link from "next/link";
import { BookText, Play, Quote } from "lucide-react";
import { useEffect, useState } from "react";
import EmptyState from "@/app/components/ui/EmptyState";
import VocabAccordion, {
  type VocabWord
} from "@/app/components/vocab/VocabAccordion";
import { LookupCardStack } from "@/app/watch/LookupCard";

type CorpusMobileProps = {
  words: VocabWord[];
};

type PhraseKind = "collocation" | "phrase" | "idiom";

type VideoView = {
  id: string;
  videoId: string;
  title: string;
  channelTitle: string;
  thumbnail: string | null;
  viewedAt: string;
};

type SavedPhrase = {
  id: string;
  lemma: string;
  kind: PhraseKind;
  translationZh?: string | null;
  explanationZh?: string | null;
  createdAt: string;
};

type LoadableState<T> = {
  status: "idle" | "loading" | "ready" | "error";
  items: T[];
};

type LookupStackCard = {
  id: string;
  form: string;
  lookupKind: "word" | "phrase";
  phraseKind?: PhraseKind;
  originalSentence: string;
  translatedSentence: string;
  onClose: () => void;
  onExampleWordClick?: (form: string) => void;
  onRelatedPhraseClick?: (lemma: string, kind: PhraseKind) => void;
};

function makeLookupId(prefix: string, value: string) {
  return `${prefix}-${value}-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
}

function formatViewedTime(dateValue: string) {
  return new Intl.DateTimeFormat("zh-CN", {
    hour: "2-digit",
    minute: "2-digit",
    hour12: false
  }).format(new Date(dateValue));
}

function formatGroupHeader(dateValue: string) {
  const date = new Date(dateValue);
  const day = new Date(date);
  day.setHours(0, 0, 0, 0);

  const today = new Date();
  today.setHours(0, 0, 0, 0);

  const yesterday = new Date(today);
  yesterday.setDate(today.getDate() - 1);

  if (day.getTime() === today.getTime()) return "今天";
  if (day.getTime() === yesterday.getTime()) return "昨天";

  const sameYear = day.getFullYear() === today.getFullYear();
  return new Intl.DateTimeFormat("zh-CN", {
    year: sameYear ? undefined : "numeric",
    month: "long",
    day: "numeric"
  }).format(day);
}

function groupByDate(views: VideoView[]) {
  const groups: Array<{ header: string; items: VideoView[] }> = [];

  for (const view of views) {
    const header = formatGroupHeader(view.viewedAt);
    const currentGroup = groups[groups.length - 1];

    if (!currentGroup || currentGroup.header !== header) {
      groups.push({ header, items: [view] });
      continue;
    }

    currentGroup.items.push(view);
  }

  return groups;
}

function getPhraseKindLabel(kind: PhraseKind) {
  if (kind === "idiom") return "习语";
  if (kind === "phrase") return "短语";
  return "固定搭配";
}

export default function CorpusMobile({ words }: CorpusMobileProps) {
  const [activeTab, setActiveTab] = useState<"video" | "word" | "phrase">("video");
  const [videoState, setVideoState] = useState<LoadableState<VideoView>>({
    status: "idle",
    items: []
  });
  const [phraseState, setPhraseState] = useState<LoadableState<SavedPhrase>>({
    status: "idle",
    items: []
  });
  const [cards, setCards] = useState<LookupStackCard[]>([]);

  useEffect(() => {
    if (videoState.status !== "idle") {
      return;
    }

    let cancelled = false;

    async function loadHistory() {
      setVideoState({ status: "loading", items: [] });

      try {
        const response = await fetch("/api/watch/history", { cache: "no-store" });
        if (!response.ok) {
          throw new Error(`history ${response.status}`);
        }

        const payload = (await response.json()) as { videos?: VideoView[] };
        if (cancelled) return;

        setVideoState({
          status: "ready",
          items: Array.isArray(payload.videos) ? payload.videos : []
        });
      } catch (error) {
        if (cancelled) return;
        console.error("Load watch history failed", error);
        setVideoState({ status: "error", items: [] });
      }
    }

    void loadHistory();

    return () => {
      cancelled = true;
    };
  }, [videoState.status]);

  useEffect(() => {
    if (activeTab !== "phrase" || phraseState.status !== "idle") {
      return;
    }

    let cancelled = false;

    async function loadPhrases() {
      setPhraseState((current) => ({ ...current, status: "loading" }));

      try {
        const response = await fetch("/api/vocab/phrase/list", { cache: "no-store" });
        if (!response.ok) {
          throw new Error(`phrases ${response.status}`);
        }

        const payload = (await response.json()) as { phrases?: SavedPhrase[] };
        if (cancelled) return;

        setPhraseState({
          status: "ready",
          items: Array.isArray(payload.phrases) ? payload.phrases : []
        });
      } catch (error) {
        if (cancelled) return;
        console.error("Load saved phrases failed", error);
        setPhraseState({ status: "error", items: [] });
      }
    }

    void loadPhrases();

    return () => {
      cancelled = true;
    };
  }, [activeTab, phraseState.status]);

  function pushWordLookup(form: string) {
    const normalizedForm = form.trim().toLowerCase();
    if (!normalizedForm) return;

    setCards((current) => [
      ...current,
      {
        id: makeLookupId("word", normalizedForm),
        form: normalizedForm,
        lookupKind: "word",
        originalSentence: "",
        translatedSentence: "",
        onClose: () => {},
        onExampleWordClick: pushWordLookup,
        onRelatedPhraseClick: pushPhraseLookup
      }
    ]);
  }

  function pushPhraseLookup(form: string, kind: PhraseKind) {
    const normalizedForm = form.trim().toLowerCase();
    if (!normalizedForm) return;

    setCards((current) => [
      ...current,
      {
        id: makeLookupId("phrase", normalizedForm),
        form: normalizedForm,
        lookupKind: "phrase",
        phraseKind: kind,
        originalSentence: "",
        translatedSentence: "",
        onClose: () => {},
        onExampleWordClick: pushWordLookup,
        onRelatedPhraseClick: pushPhraseLookup
      }
    ]);
  }

  function closeLookupCard(id: string) {
    setCards((current) => current.filter((card) => card.id !== id));
  }

  function retryVideo() {
    setVideoState({ status: "idle", items: [] });
  }

  function retryPhrase() {
    setPhraseState({ status: "idle", items: [] });
  }

  const videoGroups = groupByDate(videoState.items);

  return (
    <div className="min-h-screen bg-app pb-[calc(3.5rem+env(safe-area-inset-bottom))] text-zinc-900 dark:bg-[#09090B] dark:text-zinc-50 md:hidden">
      <div className="sticky top-[52px] z-30 border-b border-zinc-200/50 bg-white/80 px-4 py-2.5 backdrop-blur-xl dark:border-zinc-800/50 dark:bg-zinc-950/80">
        <div
          aria-label="语料库分类"
          className="grid grid-cols-3 gap-1 rounded-full bg-zinc-100/80 p-1 dark:bg-zinc-900/80"
          role="tablist"
        >
          {[
            { id: "video", label: "视频", Icon: Play },
            { id: "word", label: "单词", Icon: BookText },
            { id: "phrase", label: "短语", Icon: Quote }
          ].map(({ id, label, Icon }) => {
            const selected = activeTab === id;

            return (
              <button
                aria-selected={selected}
                className={`flex min-h-[40px] items-center justify-center gap-1.5 rounded-full text-sm transition-all ${
                  selected
                    ? "bg-white font-semibold text-brand-600 shadow-sm dark:bg-zinc-800 dark:text-brand-400"
                    : "bg-transparent font-medium text-zinc-500 active:scale-[0.97] dark:text-zinc-400"
                }`}
                key={id}
                onClick={() => setActiveTab(id as "video" | "word" | "phrase")}
                role="tab"
                type="button"
              >
                <Icon className="h-4 w-4" />
                <span>{label}</span>
              </button>
            );
          })}
        </div>
      </div>

      {activeTab === "video" ? (
        videoState.status === "loading" || videoState.status === "idle" ? (
          <div className="flex flex-col gap-2.5 px-4 pt-3">
            {[0, 1, 2].map((item) => (
              <div
                className="flex gap-3 rounded-2xl border border-zinc-200/50 bg-white/70 p-2.5 dark:border-zinc-800/50 dark:bg-zinc-900/70"
                key={item}
              >
                <div className="aspect-video w-[120px] shrink-0 animate-shimmer rounded-xl" />
                <div className="flex flex-1 flex-col justify-center gap-2">
                  <div className="h-3.5 w-4/5 animate-shimmer rounded" />
                  <div className="h-3 w-1/2 animate-shimmer rounded" />
                </div>
              </div>
            ))}
          </div>
        ) : videoState.status === "error" ? (
          <EmptyState
            action={{ label: "重试", onClick: retryVideo }}
            description="检查网络后重试。"
            kind="loading-failed"
            size="md"
            title="历史记录加载失败"
          />
        ) : videoState.items.length === 0 ? (
          <EmptyState
            action={{ href: "/watch", label: "去看视频" }}
            description="打开任意视频开始学习，看过的视频会按日期归到这里，方便随时回看。"
            kind="empty"
            size="lg"
            title="还没有观看记录"
          />
        ) : (
          <div className="flex flex-col gap-4 px-4 pt-3">
            {videoGroups.map((group) => (
              <section className="flex flex-col gap-2" key={group.header}>
                <h2 className="text-xs font-bold uppercase tracking-wider text-zinc-400 dark:text-zinc-500">
                  {group.header}
                </h2>
                <div className="flex flex-col gap-2.5">
                  {group.items.map((view) => (
                    <Link
                      className="group flex gap-3 rounded-2xl border border-zinc-200/50 bg-white/70 p-2.5 shadow-sm transition active:scale-[0.99] dark:border-zinc-800/50 dark:bg-zinc-900/70"
                      href={`/watch?v=${view.videoId}`}
                      key={view.id}
                    >
                      <div className="relative aspect-video w-[120px] shrink-0 overflow-hidden rounded-xl bg-zinc-100 dark:bg-zinc-800">
                        {view.thumbnail ? (
                          <img
                            alt=""
                            className="h-full w-full object-cover transition-transform duration-300 group-active:scale-105"
                            loading="lazy"
                            src={view.thumbnail}
                          />
                        ) : (
                          <div className="flex h-full w-full items-center justify-center text-zinc-300 dark:text-zinc-600">
                            <Play className="h-7 w-7" />
                          </div>
                        )}
                      </div>
                      <div className="flex min-w-0 flex-1 flex-col justify-center">
                        <p className="line-clamp-2 text-sm font-semibold leading-snug text-zinc-900 dark:text-zinc-50">
                          {view.title}
                        </p>
                        <p className="mt-1 truncate text-xs text-zinc-500 dark:text-zinc-400">
                          {view.channelTitle}
                        </p>
                        <p className="mt-1 text-[11px] text-zinc-400 dark:text-zinc-500">
                          {formatViewedTime(view.viewedAt)}
                        </p>
                      </div>
                    </Link>
                  ))}
                </div>
              </section>
            ))}
          </div>
        )
      ) : null}

      {activeTab === "word" ? (
        <div className="px-4 pt-3">
          <VocabAccordion words={words} />
        </div>
      ) : null}

      {activeTab === "phrase" ? (
        phraseState.status === "loading" || phraseState.status === "idle" ? (
          <div className="flex flex-col gap-2.5 px-4 pt-3">
            {[0, 1, 2].map((item) => (
              <div
                className="rounded-2xl border border-zinc-200/50 bg-white/70 p-4 dark:border-zinc-800/50 dark:bg-zinc-900/70"
                key={item}
              >
                <div className="h-4 w-1/2 animate-shimmer rounded" />
                <div className="mt-2 h-3 w-2/3 animate-shimmer rounded" />
              </div>
            ))}
          </div>
        ) : phraseState.status === "error" ? (
          <EmptyState
            action={{ label: "重试", onClick: retryPhrase }}
            description="检查网络后重试。"
            kind="loading-failed"
            size="md"
            title="短语加载失败"
          />
        ) : phraseState.items.length === 0 ? (
          <EmptyState
            description="查词时遇到固定搭配、短语或习语，点查词卡里的“收藏短语”即可存到这里。"
            kind="empty"
            size="lg"
            title="还没有收藏短语"
          />
        ) : (
          <div className="flex flex-col gap-2.5 px-4 pt-3">
            {phraseState.items.map((phrase) => (
              <button
                className="group flex w-full items-center justify-between gap-3 rounded-2xl border border-zinc-200/50 bg-white/70 p-4 text-left shadow-sm transition active:scale-[0.99] dark:border-zinc-800/50 dark:bg-zinc-900/70"
                key={phrase.id}
                onClick={() => pushPhraseLookup(phrase.lemma, phrase.kind)}
                type="button"
              >
                <div className="min-w-0 flex-1">
                  <p className="truncate font-display text-base font-semibold text-zinc-900 transition group-active:text-brand-600 dark:text-zinc-50 dark:group-active:text-brand-400">
                    {phrase.lemma}
                  </p>
                  {phrase.translationZh ? (
                    <p className="mt-1 line-clamp-1 text-sm text-zinc-500 dark:text-zinc-400">
                      {phrase.translationZh}
                    </p>
                  ) : null}
                  {phrase.explanationZh ? (
                    <p className="mt-1 line-clamp-2 text-sm text-zinc-500 dark:text-zinc-400">
                      {phrase.explanationZh}
                    </p>
                  ) : null}
                </div>
                <span className="shrink-0 rounded-full border border-amber-200/40 bg-amber-50 px-2 py-0.5 text-[11px] font-medium text-amber-700 dark:border-amber-800/30 dark:bg-amber-950/40 dark:text-amber-400">
                  {getPhraseKindLabel(phrase.kind)}
                </span>
              </button>
            ))}
          </div>
        )
      ) : null}

      <LookupCardStack cards={cards} onCloseCard={closeLookupCard} />
    </div>
  );
}
