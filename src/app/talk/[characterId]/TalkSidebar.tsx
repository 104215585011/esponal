"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";

type TalkSessionItem = {
  id: string;
  title: string;
  updatedAt: string;
  lastMessagePreview?: string;
  archivedAt?: string | null;
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

async function readItems(url: string) {
  const response = await fetch(url);
  if (!response.ok) {
    throw new Error(`HTTP ${response.status}`);
  }

  const payload = (await response.json()) as SessionsResponse;
  return payload.items ?? [];
}

export function TalkSidebar({ characterId, characterName }: TalkSidebarProps) {
  const router = useRouter();
  const searchParams = useSearchParams();
  const activeSessionId = searchParams.get("session");

  const [sessions, setSessions] = useState<TalkSessionItem[]>([]);
  const [archivedSessions, setArchivedSessions] = useState<TalkSessionItem[]>([]);
  const [isOpen, setIsOpen] = useState(false);
  const [isArchiveOpen, setIsArchiveOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  const [statusMessage, setStatusMessage] = useState<string | null>(null);
  const [confirmingSession, setConfirmingSession] = useState<TalkSessionItem | null>(null);

  const loadSessions = useCallback(async () => {
    setLoading(true);
    try {
      const [activeItems, archivedItems] = await Promise.all([
        readItems(`/api/talk/sessions?characterId=${encodeURIComponent(characterId)}`),
        readItems(
          `/api/talk/sessions?characterId=${encodeURIComponent(characterId)}&includeArchived=true`
        )
      ]);
      setSessions(activeItems);
      setArchivedSessions(archivedItems);
      setStatusMessage(null);
    } catch {
      setStatusMessage("暂时无法加载对话列表");
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

  const sortedArchivedSessions = useMemo(
    () =>
      [...archivedSessions].sort((a, b) => {
        const aTime = new Date(a.archivedAt ?? a.updatedAt).getTime();
        const bTime = new Date(b.archivedAt ?? b.updatedAt).getTime();
        return bTime - aTime;
      }),
    [archivedSessions]
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
    setStatusMessage(null);
    router.replace(`/talk/${characterId}?session=${session.id}`, { scroll: false });
    setIsOpen(false);
    window.dispatchEvent(new CustomEvent("talk:sessions:changed"));
  }

  function onSessionChange(session: TalkSessionItem) {
    router.replace(`/talk/${characterId}?session=${session.id}`, { scroll: false });
    setIsOpen(false);
  }

  async function confirmArchive() {
    if (!confirmingSession) return;

    const session = confirmingSession;
    const response = await fetch(
      `/api/talk/sessions/${session.id}?characterId=${encodeURIComponent(characterId)}`,
      { method: "DELETE" }
    );

    if (!response.ok) {
      setStatusMessage("归档失败，请再试一次");
      return;
    }

    const payload = (await response.json()) as { item?: TalkSessionItem };
    const archivedItem = payload.item;

    setSessions((prev) => prev.filter((item) => item.id !== session.id));
    if (archivedItem) {
      setArchivedSessions((prev) => [archivedItem, ...prev.filter((item) => item.id !== session.id)]);
      setIsArchiveOpen(true);
    }
    if (activeSessionId === session.id) {
      router.replace(`/talk/${characterId}`, { scroll: false });
    }
    setStatusMessage(null);
    setConfirmingSession(null);
    window.dispatchEvent(new CustomEvent("talk:sessions:changed"));
  }

  async function restoreSession(session: TalkSessionItem) {
    const response = await fetch(
      `/api/talk/sessions/${session.id}/restore?characterId=${encodeURIComponent(characterId)}`,
      { method: "POST" }
    );

    if (!response.ok) {
      setStatusMessage("恢复失败，请再试一次");
      return;
    }

    const payload = (await response.json()) as { item?: TalkSessionItem };
    const restoredItem = payload.item;
    if (!restoredItem) return;

    setArchivedSessions((prev) => prev.filter((item) => item.id !== session.id));
    setSessions((prev) => [restoredItem, ...prev.filter((item) => item.id !== restoredItem.id)]);
    setStatusMessage(null);
    window.dispatchEvent(new CustomEvent("talk:sessions:changed"));
  }

  function renderSessionRow(session: TalkSessionItem) {
    const active = session.id === activeSessionId;

    return (
      <div
        className={`group flex items-start gap-2 rounded-card border-l-2 px-2 py-2 transition ${
          active
            ? "border-l-2 border-brand-500 bg-brand-50 text-brand-700"
            : "border-transparent text-gray-700 hover:bg-gray-50"
        }`}
        key={session.id}
      >
        <button
          className="min-w-0 flex-1 text-left"
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
            <p className="mt-1 line-clamp-1 text-[12px] text-gray-400">{session.lastMessagePreview}</p>
          ) : null}
        </button>

        <button
          aria-label="归档此对话"
          className="opacity-100 rounded-card px-2 py-1 text-sm text-gray-400 transition hover:bg-gray-100 hover:text-gray-600 lg:opacity-0 lg:group-hover:opacity-100"
          onClick={() => setConfirmingSession(session)}
          type="button"
        >
          🗑
        </button>
      </div>
    );
  }

  function renderArchivedSection() {
    return (
      <div className="mt-3 border-t border-gray-100 pt-3">
        <button
          className="flex w-full items-center justify-between rounded-card px-2 py-2 text-left text-sm text-gray-500 transition hover:bg-gray-50"
          onClick={() => setIsArchiveOpen((prev) => !prev)}
          type="button"
        >
          <span>归档（{sortedArchivedSessions.length}）</span>
          <span aria-hidden>{isArchiveOpen ? "−" : "+"}</span>
        </button>

        {isArchiveOpen ? (
          <div className="mt-2 space-y-1 rounded-card bg-gray-50 p-2 text-gray-500">
            {sortedArchivedSessions.length === 0 ? (
              <p className="px-2 py-3 text-[12px]">7 天内归档的对话会出现在这里</p>
            ) : (
              sortedArchivedSessions.map((session) => (
                <div className="flex items-center gap-2 rounded-card px-2 py-2" key={session.id}>
                  <div className="min-w-0 flex-1">
                    <p className="line-clamp-1 text-sm">{session.title || "新会话"}</p>
                    <p className="mt-1 text-[11px] text-gray-400">
                      {formatRelativeTime(session.archivedAt ?? session.updatedAt)}
                    </p>
                  </div>
                  <button
                    className="shrink-0 text-[12px] font-medium text-brand-600 transition hover:text-brand-700"
                    onClick={() => void restoreSession(session)}
                    type="button"
                  >
                    恢复
                  </button>
                </div>
              ))
            )}
          </div>
        ) : null}
      </div>
    );
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
          {statusMessage ? (
            <p className="mb-2 px-2 text-[12px] text-gray-500">{statusMessage}</p>
          ) : null}

          {sortedSessions.length === 0 && !loading ? (
            <div className="px-2 py-8 text-sm text-gray-500">
              <p>↑</p>
              <p className="mt-2">还没有和 {characterName} 聊过</p>
              <p className="mt-1 text-[12px] text-gray-400">点上方「+ 新对话」开始</p>
            </div>
          ) : null}

          <div className="space-y-1">{sortedSessions.map((session) => renderSessionRow(session))}</div>
          {renderArchivedSection()}
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

      <aside className="hidden h-full lg:block">{renderContent()}</aside>

      {isOpen ? (
        <div className="fixed inset-0 z-40 flex lg:hidden">
          <div className="h-full w-[80vw] max-w-sm shadow-elevated">{renderContent()}</div>
          <button
            aria-label="关闭会话列表"
            className="h-full w-[20vw] flex-1 bg-black/30"
            onClick={() => setIsOpen(false)}
            type="button"
          />
        </div>
      ) : null}

      {confirmingSession ? (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/30 px-4">
          <div className="w-full max-w-sm rounded-card bg-surface p-4 shadow-elevated">
            <h2 className="text-base font-semibold text-gray-900">归档此对话？</h2>
            <p className="mt-2 text-sm leading-6 text-gray-500">
              归档后会从列表移除。7 天内可在底部「归档」抽屉里恢复，之后将永久删除。
            </p>
            <div className="mt-4 flex justify-end gap-2">
              <button
                className="rounded-card px-3 py-2 text-sm text-gray-500 transition hover:bg-gray-50"
                onClick={() => setConfirmingSession(null)}
                type="button"
              >
                取消
              </button>
              <button
                className="rounded-card bg-brand-50 px-3 py-2 text-sm font-medium text-brand-700 transition hover:bg-brand-100"
                onClick={() => void confirmArchive()}
                type="button"
              >
                归档
              </button>
            </div>
          </div>
        </div>
      ) : null}
    </>
  );
}
