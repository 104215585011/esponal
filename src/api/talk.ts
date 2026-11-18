// Timestamp: 2026-11-15 08:10
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
  targetWords?: string[];
}) {
  return apiFetch<TalkReply>("/api/talk/message", {
    method: "POST",
    headers: { Accept: "application/json" },
    body: JSON.stringify({
      characterId: input.characterId,
      message: input.message,
      sessionId: input.sessionId,
      ...(input.targetWords && input.targetWords.length > 0
        ? { targetWords: input.targetWords }
        : {})
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

export type SpeechRecognitionResult = {
  transcript: string;
  language: string;
  provider: "whisper" | "unavailable";
  unavailableReason?: string;
};

/** 语音转文字(录音文件 base64 发给 /api/talk/recognize) */
export async function recognizeSpeech(input: {
  audioBase64: string;
  language?: string;
  mimeType?: string;
}) {
  return apiFetch<SpeechRecognitionResult>("/api/talk/recognize", {
    method: "POST",
    body: JSON.stringify({
      audioBase64: input.audioBase64,
      language: input.language ?? "es-MX",
      mimeType: input.mimeType ?? "audio/m4a"
    })
  });
}

export type TalkVoiceTurnReply = {
  emptyTranscript?: boolean;
  sessionId: string | null;
  userTranscript: string;
  reply: string;
  replyAudioBase64: string | null;
  replyAudioMimeType: string | null;
  ttsProvider: string | null;
  corrections: Array<TalkCorrection | string>;
  newWords: Array<TalkNewWord | string>;
  asrProvider: string;
};

/**
 * 语音直聊单次往返接口（Plan A）：
 * 手机端录 16kHz PCM WAV → 一次请求 `/api/talk/voice` → 服务端 ASR + AI 回复 + DeepSeek TTS WAV 返回。
 */
export async function sendTalkVoiceTurn(input: {
  characterId: string;
  sessionId?: string;
  targetWords?: string[];
  audioBase64: string;
  mimeType?: string;
  filename?: string;
  language?: string;
  wantTts?: boolean;
}) {
  return apiFetch<TalkVoiceTurnReply>("/api/talk/voice", {
    method: "POST",
    body: JSON.stringify({
      characterId: input.characterId,
      sessionId: input.sessionId,
      ...(input.targetWords && input.targetWords.length > 0
        ? { targetWords: input.targetWords }
        : {}),
      audioBase64: input.audioBase64,
      mimeType: input.mimeType ?? "audio/wav",
      filename: input.filename ?? "speech.wav",
      language: input.language ?? "es-MX",
      wantTts: input.wantTts ?? true
    })
  });
}
