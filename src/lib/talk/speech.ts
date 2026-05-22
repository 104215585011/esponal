// Fish Audio TTS (synthesize) + ASR (recognize)
// 改自 talks/src/lib/speech/speech-service.ts；Azure 备份链路移除（用户没设 Azure），保留 Fish Audio + 静默 fallback

import { isConfiguredSecret } from "./env";

type VoiceConfig = {
  characterId: string;
  label: string;
  locale: string;
  voiceId: string;
};

type SynthesizeInput = {
  characterId: string;
  text: string;
};

type SynthesizeResult = {
  contentType: string;
  provider: "fish-audio" | "local";
  stream: ReadableStream<Uint8Array>;
};

type RecognizeInput = {
  audioBase64: string;
  language: string;
  mimeType: string;
};

type RecognizeResult = {
  language: string;
  provider: "fish-audio" | "local";
  transcript: string;
};

const CHARACTER_VOICE_CONFIG: Record<string, Omit<VoiceConfig, "voiceId"> & { envKey: string }> = {
  carlos: { characterId: "carlos", envKey: "FISH_AUDIO_REFERENCE_ID_CARLOS", label: "Carlos Méndez", locale: "es-MX" },
  emma:   { characterId: "emma",   envKey: "FISH_AUDIO_REFERENCE_ID_EMMA",   label: "Emma Clarke",   locale: "en-GB" },
  jake:   { characterId: "jake",   envKey: "FISH_AUDIO_REFERENCE_ID_JAKE",   label: "Jake Wilson",   locale: "en-US" },
  kenji:  { characterId: "kenji",  envKey: "FISH_AUDIO_REFERENCE_ID_KENJI",  label: "Kenji Tanaka",  locale: "ja-JP" },
  sophie: { characterId: "sophie", envKey: "FISH_AUDIO_REFERENCE_ID_SOPHIE", label: "Sophie Dubois", locale: "fr-FR" }
};

// 极小静默 WAV，TTS 完全失败时回放，避免前端拿 500 崩
const LOCAL_WAV_BASE64 = "UklGRiQAAABXQVZFZm10IBAAAAABAAEAESsAACJWAAACABAAZGF0YQAAAAA=";
const FISH_AUDIO_DEFAULT_LATENCY = "balanced";

export function getCharacterVoiceConfig(characterId: string): VoiceConfig | null {
  const config = CHARACTER_VOICE_CONFIG[characterId];
  if (!config) return null;
  return {
    characterId: config.characterId,
    label: config.label,
    locale: config.locale,
    voiceId: process.env[config.envKey] ?? ""
  };
}

function bytesToStream(bytes: Uint8Array): ReadableStream<Uint8Array> {
  return new ReadableStream<Uint8Array>({
    start(controller) {
      controller.enqueue(bytes);
      controller.close();
    }
  });
}

function fallbackAudio(): SynthesizeResult {
  return {
    contentType: "audio/wav",
    provider: "local",
    stream: bytesToStream(Uint8Array.from(Buffer.from(LOCAL_WAV_BASE64, "base64")))
  };
}

export async function synthesizeSpeech(input: SynthesizeInput): Promise<SynthesizeResult> {
  const voice = getCharacterVoiceConfig(input.characterId);
  if (!voice) return fallbackAudio();

  const apiKey = process.env.FISH_AUDIO_API_KEY;
  if (!isConfiguredSecret(apiKey) || !isConfiguredSecret(voice.voiceId)) {
    return fallbackAudio();
  }

  const response = await fetch("https://api.fish.audio/v1/tts", {
    method: "POST",
    headers: {
      authorization: `Bearer ${apiKey}`,
      "content-type": "application/json"
    },
    body: JSON.stringify({
      chunk_length: 300,
      format: "mp3",
      latency: process.env.FISH_AUDIO_LATENCY ?? FISH_AUDIO_DEFAULT_LATENCY,
      model: process.env.FISH_AUDIO_MODEL ?? "s1",
      normalize: true,
      reference_id: voice.voiceId,
      sample_rate: 44100,
      text: input.text,
      top_p: 0.7,
      temperature: 0.7,
      prosody: { normalize_loudness: true, speed: 1, volume: 0 }
    })
  });

  if (response.ok && response.body) {
    return {
      contentType: response.headers.get("content-type") ?? "audio/mpeg",
      provider: "fish-audio",
      stream: response.body
    };
  }

  return fallbackAudio();
}

export async function recognizeSpeech(input: RecognizeInput): Promise<RecognizeResult> {
  const apiKey = process.env.FISH_AUDIO_API_KEY;
  if (!isConfiguredSecret(apiKey)) {
    return { language: input.language, provider: "local", transcript: "" };
  }

  const audioBytes = Uint8Array.from(Buffer.from(input.audioBase64, "base64"));
  const formData = new FormData();
  formData.append("audio", new Blob([audioBytes], { type: input.mimeType }), "speech.webm");
  formData.append("language", input.language.split("-")[0] ?? input.language);
  formData.append("ignore_timestamps", "true");

  const response = await fetch("https://api.fish.audio/v1/asr", {
    method: "POST",
    headers: { authorization: `Bearer ${apiKey}` },
    body: formData
  });

  if (response.ok) {
    const payload = (await response.json()) as { text?: string };
    return {
      language: input.language,
      provider: "fish-audio",
      transcript: payload.text ?? ""
    };
  }

  return { language: input.language, provider: "local", transcript: "" };
}
