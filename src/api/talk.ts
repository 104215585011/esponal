// Timestamp: 2026-11-14 15:35
import { apiFetch } from "@/api/client";

export type TalkCharacter = {
  id: string;
  name: string;
  language: string;
  bio: string;
  style: string;
};

export type TalkSessionItem = {
  id: string;
  title: string;
  updatedAt: string;
  lastMessagePreview: string;
  archivedAt: string | null;
};

export type TalkCorrection = {
  original?: string;
  corrected?: string;
  explanation?: string;
  note?: string;
};

export type TalkNewWord = {
  word?: string;
  lemma?: string;
  translation?: string;
  meaning?: string;
};

export type TalkMessage = {
  id: string;
  role: "user" | "assistant" | string;
  content: string;
  corrections?: TalkCorrection[] | null;
  newWords?: TalkNewWord[] | null;
  createdAt: string;
};

export type TalkReply = {
  sessionId: string;
  reply: string;
  corrections: TalkCorrection[];
  newWords: TalkNewWord[];
};

/** 角色是公开端点(不需要登录) */
export async function fetchTalkCharacters() {
  const res = await apiFetch<{ items?: TalkCharacter[] }>("/api/talk/characters");
  return res.items ?? [];
}

export async function fetchTalkSessions(characterId: string) {
  const res = await apiFetch<{ items?: TalkSessionItem[] }>(
    `/api/talk/sessions?characterId=${encodeURIComponent(characterId)}`
  );
  return res.items ?? [];
}

export async function startTalkSession(characterId: string) {
  const res = await apiFetch<{ item: TalkSessionItem }>("/api/talk/sessions", {
    method: "POST",
    body: JSON.stringify({ characterId })
  });
  return res.item;
}

export async function archiveTalkSession(sessionId: string, characterId: string) {
  return apiFetch<{ item: TalkSessionItem | null }>(
    `/api/talk/sessions/${encodeURIComponent(sessionId)}?characterId=${encodeURIComponent(characterId)}`,
    { method: "DELETE" }
  );
}

/**
 * 发一条消息。
 *
 * Web 端用 SSE 流式;RN 的 fetch 读不了流,所以带 Accept: application/json
 * 让服务端把整轮聚合后一次返回(服务端已支持该分支)。
 */
export async function sendTalkMessage(input: {
  characterId: string;
  message: string;
  sessionId?: string;
}) {
  return apiFetch<TalkReply>("/api/talk/message", {
    method: "POST",
    headers: { Accept: "application/json" },
    body: JSON.stringify({
      characterId: input.characterId,
      message: input.message,
      sessionId: input.sessionId
    })
  });
}

/** 会话历史(含解密后的消息、纠错、生词) */
export async function fetchTalkHistory(input: {
  characterId: string;
  sessionId?: string;
  page?: number;
}) {
  const params = new URLSearchParams({
    characterId: input.characterId,
    page: String(input.page ?? 1),
    pageSize: "50"
  });
  if (input.sessionId) params.set("sessionId", input.sessionId);

  const res = await apiFetch<{
    items?: Array<{
      id: string;
      title: string | null;
      updatedAt: string;
      messages?: TalkMessage[];
    }>;
  }>(`/api/talk/history?${params.toString()}`);

  // 每个 item 是一个会话;取第一个(按 sessionId 查时只会有一个)
  const session = res.items?.[0];
  return {
    sessionId: session?.id ?? null,
    messages: session?.messages ?? []
  };
}
