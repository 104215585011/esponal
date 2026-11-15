// Timestamp: 2026-11-15 08:05
import { getDeepseekConfig, isConfiguredSecret } from "./env";

export type DeepSeekAsrResult =
  | { ok: true; transcript: string; durationMs: number | null; provider: "deepseek-asr" }
  | { ok: false; reason: string };

export type DeepSeekTtsResult = {
  audioBase64: string;
  mimeType: string;
  provider: "deepseek-tts";
};

const MALE_VOICE_CHARACTERS = new Set(["carlos", "jake", "kenji"]);

/**
 * 调用 DeepSeek 原生 ASR 工具接口 (`POST /v1/tools/asr`)。
 * DeepSeek 文档要求格式为 16-bit PCM WAV 或 Ogg Opus，≤ 8 MiB、≤ 120 秒。
 */
export async function transcribeAudioWithDeepSeek(input: {
  audioBuffer: Buffer;
  filename?: string;
  mimeType?: string;
}): Promise<DeepSeekAsrResult> {
  const { apiKey, baseUrl } = getDeepseekConfig();
  if (!isConfiguredSecret(apiKey)) {
    return { ok: false, reason: "missing_deepseek_key" };
  }

  const form = new FormData();
  const mimeType = input.mimeType || "audio/wav";
  const filename = input.filename || "speech.wav";
  form.append("file", new Blob([new Uint8Array(input.audioBuffer)], { type: mimeType }), filename);

  try {
    const response = await fetch(`${baseUrl}/v1/tools/asr`, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${apiKey}`
      },
      body: form,
      signal: AbortSignal.timeout(25_000)
    });

    if (!response.ok) {
      const detail = await response.text().catch(() => "");
      return {
        ok: false,
        reason: `deepseek_asr_${response.status}:${detail.slice(0, 120)}`
      };
    }

    const payload = (await response.json().catch(() => null)) as {
      text?: unknown;
      duration_ms?: unknown;
    } | null;

    const transcript = typeof payload?.text === "string" ? payload.text.trim() : "";
    const durationMs =
      typeof payload?.duration_ms === "number" ? Math.round(payload.duration_ms) : null;

    return {
      ok: true,
      transcript,
      durationMs,
      provider: "deepseek-asr"
    };
  } catch (error) {
    return {
      ok: false,
      reason: error instanceof Error ? error.message : "deepseek_asr_network_error"
    };
  }
}

/**
 * 调用 DeepSeek 原生 TTS (`POST /v1/tools/tts`) 返回 WAV 语音流。
 * 失败时静默返回 null，由客户端退回系统端 TTS (`speakAuto`) 保证通话不中断。
 */
export async function synthesizeAudioWithDeepSeek(
  text: string,
  characterId: string
): Promise<DeepSeekTtsResult | null> {
  const { apiKey, baseUrl } = getDeepseekConfig();
  if (!isConfiguredSecret(apiKey)) return null;

  const trimmed = text.trim();
  if (!trimmed || trimmed.length > 4000) return null;

  const voiceId = MALE_VOICE_CHARACTERS.has(characterId) ? "tide" : "stella";

  try {
    const response = await fetch(`${baseUrl}/v1/tools/tts`, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${apiKey}`,
        "Content-Type": "application/json"
      },
      body: JSON.stringify({
        text: trimmed,
        voice_id: voiceId,
        format: "wav",
        filter_markdown: true
      }),
      signal: AbortSignal.timeout(20_000)
    });

    if (!response.ok) return null;

    const buf = Buffer.from(await response.arrayBuffer());
    if (buf.length < 44) return null;

    return {
      audioBase64: buf.toString("base64"),
      mimeType: "audio/wav",
      provider: "deepseek-tts"
    };
  } catch {
    return null;
  }
}
