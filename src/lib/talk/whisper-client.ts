type WhisperSegment = {
  start?: number;
  end?: number;
  text?: string;
  avg_logprob?: number;
};

type WhisperInput = {
  audioBase64: string;
  language: string;
  mimeType: string;
};

type WhisperResult = {
  language: string;
  provider: "whisper" | "unavailable";
  segments?: WhisperSegment[];
  transcript: string;
  unavailableReason?: "missing_env" | "timeout" | "fetch_failed" | "invalid_response" | `http_${number}`;
};

function getAudioSuffix(mimeType: string) {
  if (mimeType.includes("mp4")) return ".mp4";
  if (mimeType.includes("mpeg") || mimeType.includes("mp3")) return ".mp3";
  if (mimeType.includes("ogg")) return ".ogg";
  if (mimeType.includes("wav")) return ".wav";
  return ".webm";
}

function getWhisperUrl() {
  const baseUrl = process.env.WHISPER_TUNNEL_URL?.trim();
  if (!baseUrl) return null;
  return `${baseUrl.replace(/\/+$/, "")}/transcribe`;
}

export async function transcribeViaWhisperTunnel(input: WhisperInput): Promise<WhisperResult> {
  const url = getWhisperUrl();
  if (!url) {
    return {
      language: input.language,
      provider: "unavailable",
      transcript: "",
      unavailableReason: "missing_env"
    };
  }

  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), 20_000);

  try {
    const response = await fetch(url, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({
        audio_base64: input.audioBase64,
        language: input.language.split("-")[0] ?? "es",
        suffix: getAudioSuffix(input.mimeType)
      }),
      signal: controller.signal
    });

    if (!response.ok) {
      return {
        language: input.language,
        provider: "unavailable",
        transcript: "",
        unavailableReason: `http_${response.status}`
      };
    }

    const payload = (await response.json().catch(() => null)) as {
      text?: unknown;
      segments?: unknown;
    } | null;
    if (!payload) {
      return {
        language: input.language,
        provider: "unavailable",
        transcript: "",
        unavailableReason: "invalid_response"
      };
    }
    const transcript = typeof payload.text === "string" ? payload.text.trim() : "";
    const segments = Array.isArray(payload.segments)
      ? payload.segments.filter((segment): segment is WhisperSegment => {
          return typeof segment === "object" && segment !== null;
        })
      : undefined;

    return {
      language: input.language,
      provider: "whisper",
      segments,
      transcript
    };
  } catch (error) {
    const unavailableReason = error instanceof DOMException && error.name === "AbortError"
      ? "timeout"
      : "fetch_failed";
    return { language: input.language, provider: "unavailable", transcript: "", unavailableReason };
  } finally {
    clearTimeout(timer);
  }
}
