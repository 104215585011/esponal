// Timestamp: 2026-11-18 10:58
import { meteredFetch } from "@/lib/api-usage";
import type { ChatMessageForModel } from "./model-client";
import { isConfiguredSecret } from "./env";
import {
  parseOmniAnalysisJson,
  wrapPcm24kMonoToWav,
  type OmniAnalysisNotes
} from "./omni-helpers";

export { parseOmniAnalysisJson, wrapPcm24kMonoToWav, type OmniAnalysisNotes };

const DASHSCOPE_COMPAT_URL = "https://dashscope.aliyuncs.com/compatible-mode/v1/chat/completions";
const OMNI_MODEL = process.env.DASHSCOPE_OMNI_MODEL?.trim() || "qwen3-omni-flash";

const MALE_CHARACTERS = new Set(["carlos", "jake", "kenji"]);

const CHARACTER_TARGET_LANG: Record<string, string> = {
  carlos: "Spanish (Español)",
  emma: "British English",
  jake: "American English",
  sophie: "French (Français)",
  kenji: "Japanese (日本語)"
};

export function hasDashScopeOmni(): boolean {
  return isConfiguredSecret(process.env.DASHSCOPE_API_KEY);
}

async function callQwenOmniStream(input: {
  apiKey: string;
  modalities: Array<"text" | "audio">;
  voice?: "Cherry" | "Ethan";
  messages: Array<{ role: "system" | "user" | "assistant"; content: unknown }>;
  maxTokens?: number;
  timeoutMs?: number;
}): Promise<{ text: string; wavAudioBuffer: Buffer | null }> {
  const response = await meteredFetch({ provider: "dashscope", feature: "talk", unit: "tokens" }, DASHSCOPE_COMPAT_URL, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${input.apiKey}`,
      "Content-Type": "application/json"
    },
    body: JSON.stringify({
      model: OMNI_MODEL,
      modalities: input.modalities,
      ...(input.maxTokens ? { max_tokens: input.maxTokens } : {}),
      ...(input.modalities.includes("audio")
        ? { audio: { voice: input.voice ?? "Cherry", format: "wav" } }
        : {}),
      stream: true,
      messages: input.messages
    }),
    signal: AbortSignal.timeout(input.timeoutMs ?? 28_000)
  }, true);

  if (!response.ok) {
    const errText = await response.text().catch(() => "");
    throw new Error(`qwen_omni_${response.status}:${errText.slice(0, 160)}`);
  }

  const sse = await response.text();
  let text = "";
  const pcmChunks: Buffer[] = [];

  for (const line of sse.split(/\r?\n/)) {
    if (!line.startsWith("data: ") || line.includes("[DONE]")) continue;
    try {
      const payload = JSON.parse(line.slice(6)) as {
        choices?: Array<{
          delta?: {
            content?: string;
            audio?: { data?: string; transcript?: string };
          };
        }>;
      };
      const delta = payload.choices?.[0]?.delta;
      if (typeof delta?.content === "string") {
        text += delta.content;
      }
      if (typeof delta?.audio?.transcript === "string") {
        text += delta.audio.transcript;
      }
      if (typeof delta?.audio?.data === "string" && delta.audio.data.length > 0) {
        pcmChunks.push(Buffer.from(delta.audio.data, "base64"));
      }
    } catch {
      // 忽略单行残缺 chunk
    }
  }

  const wavAudioBuffer =
    pcmChunks.length > 0 ? wrapPcm24kMonoToWav(Buffer.concat(pcmChunks)) : null;

  return { text: text.trim(), wavAudioBuffer };
}

export type DirectVoiceOmniResult =
  | {
      ok: true;
      emptyTranscript: boolean;
      userTranscript: string;
      reply: string;
      replyAudioBase64: string | null;
      replyAudioMimeType: string | null;
      corrections: string[];
      newWords: string[];
      provider: "qwen-omni";
    }
  | { ok: false; reason: string };

/**
 * 原生多模态语音直聊：直接把录音波形输入 Qwen3-Omni-Flash（不经过文字转录中转），
 * 同时获取自然语音回复（WAV）+ 面向学习者的精准外语听写与纠错笔记。
 */
export async function talkDirectWithQwenOmni(input: {
  characterId: string;
  systemPrompt: string;
  historyMessages: ChatMessageForModel[];
  audioBuffer: Buffer;
  audioFormat: "wav" | "mp3" | "ogg";
  wantAudio: boolean;
}): Promise<DirectVoiceOmniResult> {
  const apiKey = process.env.DASHSCOPE_API_KEY?.trim();
  if (!isConfiguredSecret(apiKey) || !apiKey) {
    return { ok: false, reason: "missing_dashscope_key" };
  }

  const targetLanguage = CHARACTER_TARGET_LANG[input.characterId] ?? "Spanish (Español)";
  const voice: "Cherry" | "Ethan" = MALE_CHARACTERS.has(input.characterId) ? "Ethan" : "Cherry";
  const dataUri = `data:;base64,${input.audioBuffer.toString("base64")}`;

  const directSystem = `${input.systemPrompt}

Direct Voice Conversation Rules:
- You are a real person having a relaxed spoken conversation in ${targetLanguage}, NOT a teacher or assistant.
- Even if the learner's pronunciation has a Chinese accent or hesitations, understand what they meant in ${targetLanguage}.
- Reply naturally in 1-2 short everyday spoken sentences (around 8-30 words), no markdown, no JSON, no bullet points, no unsolicited grammar lectures.`;

  const chatMessages: Array<{ role: "system" | "user" | "assistant"; content: unknown }> = [
    { role: "system", content: directSystem },
    ...input.historyMessages.slice(-10).map((m) => ({
      role: m.role,
      content: m.content
    })),
    {
      role: "user",
      content: [
        {
          type: "input_audio",
          input_audio: { data: dataUri, format: input.audioFormat }
        },
        {
          type: "text",
          text: `Listen to my ${targetLanguage} audio and reply briefly and naturally in ${targetLanguage} like a real friend.`
        }
      ]
    }
  ];

  const analysisMessages: Array<{ role: "system" | "user" | "assistant"; content: unknown }> = [
    {
      role: "system",
      content: `Transcribe the learner's raw ${targetLanguage} audio accurately (never turn accented ${targetLanguage} into Chinese characters; if pure silence/noise, set "userTranscript": ""). Keep notes minimal: 0-1 brief tip in Chinese only if there is a clear mistake ("原表达 → 建议表达 · 简短说明"), and 0-2 key words only if helpful; leave arrays [] for normal clear speech.
Return ONLY valid JSON: {"userTranscript":"...","corrections":[],"newWords":[]}`
    },
    {
      role: "user",
      content: [
        {
          type: "input_audio",
          input_audio: { data: dataUri, format: input.audioFormat }
        }
      ]
    }
  ];

  try {
    const [chatRes, analysisRes] = await Promise.all([
      callQwenOmniStream({
        apiKey,
        modalities: input.wantAudio ? ["text", "audio"] : ["text"],
        voice,
        messages: chatMessages,
        maxTokens: 160,
        timeoutMs: 28_000
      }),
      callQwenOmniStream({
        apiKey,
        modalities: ["text"],
        messages: analysisMessages,
        maxTokens: 140,
        timeoutMs: 18_000
      }).catch(() => ({ text: "", wavAudioBuffer: null }))
    ]);

    const notes = parseOmniAnalysisJson(analysisRes.text);
    const hasAudioReply = Boolean(chatRes.wavAudioBuffer && chatRes.wavAudioBuffer.length > 44);

    if (!chatRes.text && !hasAudioReply) {
      return { ok: false, reason: "qwen_omni_empty_reply" };
    }

    // 仅当听写分析明确判为空且模型回复也像没听清时才算空语音
    if (!notes.userTranscript && chatRes.text.length < 4 && !hasAudioReply) {
      return {
        ok: true,
        emptyTranscript: true,
        userTranscript: "",
        reply: "",
        replyAudioBase64: null,
        replyAudioMimeType: null,
        corrections: [],
        newWords: [],
        provider: "qwen-omni"
      };
    }

    return {
      ok: true,
      emptyTranscript: false,
      userTranscript: notes.userTranscript || "🎙️ 语音输入",
      reply: chatRes.text,
      replyAudioBase64:
        hasAudioReply && chatRes.wavAudioBuffer
          ? chatRes.wavAudioBuffer.toString("base64")
          : null,
      replyAudioMimeType: hasAudioReply ? "audio/wav" : null,
      corrections: notes.corrections,
      newWords: notes.newWords,
      provider: "qwen-omni"
    };
  } catch (error) {
    return {
      ok: false,
      reason: error instanceof Error ? error.message : "qwen_omni_failed"
    };
  }
}
