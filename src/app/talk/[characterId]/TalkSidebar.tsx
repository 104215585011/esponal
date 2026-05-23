"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";

type TalkSessionItem = {
  id: string;
  title: string;
  updatedAt: string;
  lastMessagePreview?: string;
};

type TalkSidebarProps = {
  characterId: string;
  characterName: string;
};

type SessionsResponse = {
  items?: TalkSessionItem[];
};

function formatRelativeTime(value: string) {
  const timestamp = new Date(value).getTime();
  if (!Number.isFinite(timestamp)) return "";
  const diffSeconds = Math.max(0, Math.floor((Date.now() - timestamp) / 1000));
  if (diffSeconds < 60) return "刚刚";
  const diffMinutes = Math.floor(diffSeconds / 60);
  if (diffMinutes < 60) return `${diffMinutes} 分钟前`;
  const diffHours = Math.floor(diffMinutes / 60);
  if (diffHours < 24) return `${diffHours} 小时前`;
  return `${Math.floor(diffHours / 24)} 天前`;
}

export function TalkSidebar({ characterId, characterName }: TalkSidebarProps) {
  const router = useRouter();
  const searchParams = useSearchParams();
  const activeSessionId = searchParams.get("session");
  const [sessions, setSessions] = useState<TalkSessionItem[]>([]);
  const [isOpen, setIsOpen] = useState(false);
  const [loading, setLoading] = useState(false);

  const loadSessions = useCallback(async () => {
    setLoading(true);
    try {
      const response = await fetch(`/api/talk/sessions?characterId=${encodeURIComponent(characterId)}`);
      if (!response.ok) return;
      const payload = (await response.json()) as SessionsResponse;
      setSessions(payload.items ?? []);
    } finally {
      setLoading(false);
    }
  }, [characterId]);

  useEffect(() => {
    void loadSessions();
    const onSessionsChanged = () => void loadSessions();
    window.addEventListener("talk:sessions:changed", onSessionsChanged);
    return () => window.removeEventListener("talk:sessions:changed", onSessionsChanged);
  }, [loadSessions]);

  const sortedSessions = useMemo(
    () =>
      [...sessions].sort(
        (a, b) => new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime()
      ),
    [sessions]
  );

  async function createSession() {
    const response = await fetch("/api/talk/sessions", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ characterId })
    });
    if (!response.ok) return;
    const payload = (await response.json()) as { item?: TalkSessionItem };
    const session = payload.item;
    if (!session) return;
    setSessions((prev) => [session, ...prev.filter((item) => item.id !== session.id)]);
    router.replace(`/talk/${characterId}?session=${session.id}`, { scroll: false });
    setIsOpen(false);
  }

  function onSessionChange(session: TalkSessionItem) {
    router.replace(`/talk/${characterId}?session=${session.id}`, { scroll: false });
    setIsOpen(false);
  }

  function renderContent() {
    return (
      <div className="flex h-full flex-col bg-app px-3 py-3">
        <button
          className="flex h-9 w-full items-center gap-2 rounded-card bg-brand-50 px-3 text-sm font-medium text-brand-700 transition hover:bg-brand-100"
          onClick={() => void createSession()}
          type="button"
        >
          <span aria-hidden className="text-base leading-none">+</span>
          <span>新对话</span>
        </button>

        <div className="mt-3 min-h-0 flex-1 overflow-y-auto">
          {sortedSessions.length === 0 && !loading ? (
            <div className="px-2 py-8 text-sm text-gray-500">
              <p>↑</p>
              <p className="mt-2">还没有和 {characterName} 聊过</p>
              <p className="mt-1 text-[12px] text-gray-400">点上方「+ 新对话」开始</p>
            </div>
          ) : null}

          <div className="space-y-1">
            {sortedSessions.map((session) => {
              const active = session.id === activeSessionId;
              return (
                <button
                  className={`group w-full rounded-card border-l-2 px-3 py-2 text-left transition ${
                    active
                      ? "border-l-2 border-brand-500 bg-brand-50 text-brand-700"
                      : "border-transparent text-gray-700 hover:bg-gray-50"
                  }`}
                  key={session.id}
                  onClick={() => onSessionChange(session)}
                  type="button"
                >
                  <div className="flex items-center gap-2">
                    <span
                      className="line-clamp-1 flex-1 text-sm font-medium transition-opacity duration-150"
                      key={session.title}
                    >
                      {session.title || "新会话"}
                    </span>
                    <span className="shrink-0 text-[11px] text-gray-400">
                      {formatRelativeTime(session.updatedAt)}
                    </span>
                  </div>
                  {session.lastMessagePreview ? (
                    <p className="mt-1 line-clamp-1 text-[12px] text-gray-400">
                      {session.lastMessagePreview}
                    </p>
                  ) : null}
                </button>
              );
            })}
          </div>
        </div>
      </div>
    );
  }

  return (
    <>
      <button
        aria-label="打开会话列表"
        className="mb-3 inline-flex h-9 items-center gap-2 rounded-card border border-gray-200 bg-surface px-3 text-sm text-gray-600 shadow-sm lg:hidden"
        onClick={() => setIsOpen(true)}
        type="button"
      >
        <span aria-hidden>☰</span>
        <span>会话</span>
      </button>

      <aside className="hidden h-full lg:block">
        {renderContent()}
      </aside>

      {isOpen ? (
        <div className="fixed inset-0 z-40 flex lg:hidden">
          <div className="h-full w-[80vw] max-w-sm shadow-elevated">
            {renderContent()}
          </div>
          <button
            aria-label="关闭会话列表"
            className="h-full w-[20vw] flex-1 bg-black/30"
            onClick={() => setIsOpen(false)}
            type="button"
          />
        </div>
      ) : null}
    </>
  );
}
