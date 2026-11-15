// Timestamp: 2026-11-15 08:05
import { NextResponse } from "next/server";
import { getAuthedUserId } from "@/lib/api-auth";
import { ACTION_COST_MINOR } from "@/lib/credits/config";
import { requireCredits } from "@/lib/credits/runtime";
import { spendCredits } from "@/lib/credits/service";
import { prisma } from "@/lib/prisma";
import { getTalkCharacterById } from "@/lib/talk/characters";
import { streamChatMessage } from "@/lib/talk/chat-service";
import {
  synthesizeAudioWithDeepSeek,
  transcribeAudioWithDeepSeek
} from "@/lib/talk/deepseek-voice";
import { getMessageEncryptionSecret } from "@/lib/talk/env";
import { transcribeViaWhisperTunnel } from "@/lib/talk/whisper-client";

export const maxDuration = 60;

const MAX_AUDIO_BYTES = 8 * 1024 * 1024;

function jsonError(status: number, code: string, message: string) {
  return NextResponse.json({ error: { code, message } }, { status });
}

type VoicePayload = {
  characterId: string;
  sessionId?: string;
  language: string;
  mimeType: string;
  filename: string;
  wantTts: boolean;
  audioBuffer: Buffer;
};

async function parseVoiceRequest(request: Request): Promise<VoicePayload | { error: Response }> {
  const contentType = request.headers.get("content-type") ?? "";

  if (contentType.includes("multipart/form-data")) {
    const form = await request.formData().catch(() => null);
    if (!form) return { error: jsonError(400, "BAD_FORM", "无效的语音表单") };

    const audio = form.get("audio");
    if (!(audio instanceof Blob)) {
      return { error: jsonError(400, "EMPTY_AUDIO", "缺少语音文件") };
    }
    const audioBuffer = Buffer.from(await audio.arrayBuffer());
    const filename =
      "name" in audio && typeof audio.name === "string" && audio.name ? audio.name : "speech.wav";
    const mimeType = audio.type || (filename.endsWith(".ogg") ? "audio/ogg" : "audio/wav");

    return {
      characterId: String(form.get("characterId") ?? ""),
      sessionId: form.get("sessionId") ? String(form.get("sessionId")) : undefined,
      language: String(form.get("language") ?? "es-MX") || "es-MX",
      mimeType,
      filename,
      wantTts: form.get("wantTts") !== "false",
      audioBuffer
    };
  }

  let body: Record<string, unknown>;
  try {
    body = (await request.json()) as Record<string, unknown>;
  } catch {
    return { error: jsonError(400, "BAD_JSON", "请求体不是合法 JSON") };
  }

  const audioBase64 = typeof body.audioBase64 === "string" ? body.audioBase64.trim() : "";
  if (!audioBase64) {
    return { error: jsonError(400, "EMPTY_AUDIO", "录音数据不能为空") };
  }

  const cleanB64 = audioBase64.replace(/^data:[^;]+;base64,/, "");
  const audioBuffer = Buffer.from(cleanB64, "base64");
  const mimeType =
    typeof body.mimeType === "string" && body.mimeType ? body.mimeType : "audio/wav";
  const filename =
    typeof body.filename === "string" && body.filename
      ? body.filename
      : mimeType.includes("ogg")
        ? "speech.ogg"
        : mimeType.includes("mp4") || mimeType.includes("m4a")
          ? "speech.m4a"
          : "speech.wav";

  return {
    characterId: typeof body.characterId === "string" ? body.characterId : "",
    sessionId:
      typeof body.sessionId === "string" && body.sessionId ? body.sessionId : undefined,
    language:
      typeof body.language === "string" && body.language ? body.language : "es-MX",
    mimeType,
    filename,
    wantTts: body.wantTts !== false,
    audioBuffer
  };
}

/**
 * 单次往返语音直聊接口：
 * 客户端发送录音 → 后端调用 DeepSeek `/v1/tools/asr`（可选降级 Whisper 隧道）→ 对话生成 + 纠错/新词 → DeepSeek `/v1/tools/tts` 返回语音。
 */
export async function POST(request: Request) {
  const userId = await getAuthedUserId(request);
  if (!userId) {
    return jsonError(401, "UNAUTHORIZED", "登录后再来聊");
  }

  const parsed = await parseVoiceRequest(request);
  if ("error" in parsed) {
    return parsed.error;
  }

  const character = getTalkCharacterById(parsed.characterId);
  if (!character) {
    return jsonError(404, "CHARACTER_NOT_FOUND", "未知角色");
  }
  if (parsed.audioBuffer.length === 0) {
    return jsonError(400, "EMPTY_AUDIO", "录音内容为空");
  }
  if (parsed.audioBuffer.length > MAX_AUDIO_BYTES) {
    return jsonError(413, "AUDIO_TOO_LARGE", "单条语音请控制在 8MB / 2 分钟以内");
  }

  if (parsed.sessionId) {
    const existing = await prisma.chatSession.findFirst({
      where: {
        id: parsed.sessionId,
        userId,
        characterId: parsed.characterId,
        status: "ACTIVE"
      }
    });
    if (!existing) {
      return jsonError(404, "SESSION_NOT_FOUND", "找不到该对话或无权访问");
    }
  }

  const creditGuard = await requireCredits(userId, ACTION_COST_MINOR.talk_turn);
  if (!creditGuard.ok) {
    const status = creditGuard.code === "UNAUTHORIZED" ? 401 : 402;
    return jsonError(
      status,
      creditGuard.code,
      status === 402 ? "积分不足，请先充值或复习攒积分" : "登录后再来聊"
    );
  }

  // 1) 语音识别：WAV / Ogg 优先直连 DeepSeek /v1/tools/asr，其它格式或失败再尝试 Whisper 隧道
  let transcript = "";
  let asrProvider: "deepseek-asr" | "whisper" | "unavailable" = "unavailable";
  let asrReason = "";

  const isDeepSeekNativeFormat =
    parsed.mimeType.includes("wav") ||
    parsed.mimeType.includes("ogg") ||
    parsed.mimeType.includes("opus") ||
    parsed.filename.endsWith(".wav") ||
    parsed.filename.endsWith(".ogg");

  if (isDeepSeekNativeFormat) {
    const dsRes = await transcribeAudioWithDeepSeek({
      audioBuffer: parsed.audioBuffer,
      filename: parsed.filename,
      mimeType: parsed.mimeType
    });
    if (dsRes.ok) {
      transcript = dsRes.transcript;
      asrProvider = "deepseek-asr";
    } else {
      asrReason = dsRes.reason;
    }
  }

  if (asrProvider === "unavailable") {
    const whisperRes = await transcribeViaWhisperTunnel({
      audioBase64: parsed.audioBuffer.toString("base64"),
      language: parsed.language,
      mimeType: parsed.mimeType
    });
    if (whisperRes.provider === "whisper") {
      transcript = whisperRes.transcript;
      asrProvider = "whisper";
    } else if (!asrReason) {
      asrReason = whisperRes.unavailableReason ?? "asr_unavailable";
    }
  }

  if (asrProvider === "unavailable") {
    return jsonError(503, "ASR_UNAVAILABLE", `语音识别服务暂时不可用（${asrReason}）`);
  }

  if (!transcript.trim()) {
    // 空语音不扣积分，提示用户再说一遍
    return NextResponse.json({
      emptyTranscript: true,
      sessionId: parsed.sessionId ?? null,
      userTranscript: "",
      reply: "",
      corrections: [],
      newWords: [],
      asrProvider
    });
  }

  // 2) 对话模型生成回复与纠错
  const encryptionSecret = getMessageEncryptionSecret();
  let streamed = "";
  let done: {
    sessionId: string;
    assistantText: string;
    corrections: string[];
    newWords: string[];
  } | null = null;

  try {
    for await (const event of streamChatMessage(prisma, {
      userId,
      characterId: parsed.characterId,
      message: transcript,
      sessionId: parsed.sessionId,
      encryptionSecret
    })) {
      if (event.type === "delta") {
        streamed += event.text;
      } else if (event.type === "done") {
        const spendResult = await spendCredits(
          userId,
          ACTION_COST_MINOR.talk_turn,
          "talk",
          event.sessionId
        );
        if (!spendResult.ok) {
          console.warn("Talk voice credits spend skipped", {
            userId,
            sessionId: event.sessionId
          });
        }
        done = {
          sessionId: event.sessionId,
          assistantText: event.assistantText || streamed,
          corrections: event.corrections,
          newWords: event.newWords
        };
      }
    }
  } catch (error) {
    return jsonError(
      502,
      "CHAT_FAILED",
      error instanceof Error ? error.message : "对话生成失败"
    );
  }

  if (!done) {
    return jsonError(502, "NO_REPLY", "模型没有返回内容，请重试");
  }

  // 3) 合成回复语音（若 DeepSeek TTS 失败，客户端会自动用本地 TTS 播放 reply 文本）
  const tts = parsed.wantTts
    ? await synthesizeAudioWithDeepSeek(done.assistantText, parsed.characterId)
    : null;

  return NextResponse.json({
    emptyTranscript: false,
    sessionId: done.sessionId,
    userTranscript: transcript,
    reply: done.assistantText,
    replyAudioBase64: tts?.audioBase64 ?? null,
    replyAudioMimeType: tts?.mimeType ?? null,
    ttsProvider: tts?.provider ?? null,
    corrections: done.corrections ?? [],
    newWords: done.newWords ?? [],
    asrProvider
  });
}
