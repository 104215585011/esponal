// Timestamp: 2026-11-15 14:15
/**
 * DashScope Qwen3-Omni 流式 `delta.audio.data` 返回 24kHz 16-bit 单声道无头裸 PCM；
 * 客户端 Expo AudioPlayer 需要标准 44 字节 RIFF WAV 容器头才能直接播放。
 */
export function wrapPcm24kMonoToWav(pcmBuffer: Buffer): Buffer {
  if (pcmBuffer.length >= 4 && pcmBuffer.subarray(0, 4).toString("ascii") === "RIFF") {
    return pcmBuffer;
  }
  const sampleRate = 24_000;
  const channels = 1;
  const bitsPerSample = 16;
  const byteRate = (sampleRate * channels * bitsPerSample) / 8;
  const blockAlign = (channels * bitsPerSample) / 8;
  const header = Buffer.alloc(44);
  header.write("RIFF", 0);
  header.writeUInt32LE(36 + pcmBuffer.length, 4);
  header.write("WAVE", 8);
  header.write("fmt ", 12);
  header.writeUInt32LE(16, 16);
  header.writeUInt16LE(1, 20);
  header.writeUInt16LE(channels, 22);
  header.writeUInt32LE(sampleRate, 24);
  header.writeUInt32LE(byteRate, 28);
  header.writeUInt16LE(blockAlign, 32);
  header.writeUInt16LE(bitsPerSample, 34);
  header.write("data", 36);
  header.writeUInt32LE(pcmBuffer.length, 40);
  return Buffer.concat([header, pcmBuffer]);
}

export type OmniAnalysisNotes = {
  userTranscript: string;
  corrections: string[];
  newWords: string[];
};

export function parseOmniAnalysisJson(rawText: string): OmniAnalysisNotes {
  const cleaned = rawText
    .replace(/^```(?:json)?\s*/i, "")
    .replace(/\s*```$/i, "")
    .trim();
  const jsonStart = cleaned.indexOf("{");
  const jsonEnd = cleaned.lastIndexOf("}");
  const slice = jsonStart >= 0 && jsonEnd > jsonStart ? cleaned.slice(jsonStart, jsonEnd + 1) : cleaned;

  try {
    const parsed = JSON.parse(slice) as {
      userTranscript?: unknown;
      corrections?: unknown;
      newWords?: unknown;
    };
    const userTranscript =
      typeof parsed.userTranscript === "string" ? parsed.userTranscript.trim() : "";
    const corrections = Array.isArray(parsed.corrections)
      ? parsed.corrections.filter((item): item is string => typeof item === "string" && item.trim().length > 0).slice(0, 4)
      : [];
    const newWords = Array.isArray(parsed.newWords)
      ? parsed.newWords.filter((item): item is string => typeof item === "string" && item.trim().length > 0).slice(0, 6)
      : [];
    return { userTranscript, corrections, newWords };
  } catch {
    return { userTranscript: "", corrections: [], newWords: [] };
  }
}
