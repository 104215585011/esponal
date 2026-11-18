// Timestamp: 2026-11-18 11:02
import type { VideoLevel } from "./youtube-shared.ts";

const SPANISH_STOPWORDS = new Set([
  "el", "la", "los", "las", "un", "una", "de", "del", "en", "y", "que", "es",
  "se", "no", "a", "por", "para", "con", "su", "al", "lo", "como", "más",
  "pero", "si", "sí", "yo", "tú", "hola", "bueno", "muy", "está", "son", "hay",
  "vamos", "hoy", "aquí", "este", "esta", "eso", "todo", "todos", "bien", "mi"
]);

export type SubtitleAnalysisResult = {
  ok: boolean;
  reason?: string;
  cueCount: number;
  wordCount: number;
  wpm: number | null;
  sample: string;
};

export function analyzeSpanishSubtitleCues(
  cues: Array<{ text?: string }>,
  durationSec = 0
): SubtitleAnalysisResult {
  const cleanedLines = (cues ?? [])
    .map((cue) => (cue.text ?? "").replace(/\[[^\]]+\]/g, " ").replace(/\s+/g, " ").trim())
    .filter((line) => line.length >= 2);

  if (cleanedLines.length < 6) {
    return { ok: false, reason: "few_cues", cueCount: cleanedLines.length, wordCount: 0, wpm: null, sample: "" };
  }

  const words = cleanedLines
    .join(" ")
    .toLowerCase()
    .split(/[^a-záéíóúüñ]+/i)
    .filter(Boolean);

  if (words.length < 25) {
    return { ok: false, reason: "too_few_words", cueCount: cleanedLines.length, wordCount: words.length, wpm: null, sample: "" };
  }

  const stopMatches = words.filter((w) => SPANISH_STOPWORDS.has(w)).length;
  const stopRatio = stopMatches / words.length;
  if (stopRatio < 0.08) {
    return {
      ok: false,
      reason: `low_es_ratio:${stopRatio.toFixed(2)}`,
      cueCount: cleanedLines.length,
      wordCount: words.length,
      wpm: null,
      sample: ""
    };
  }

  const wpm = durationSec >= 20 ? Math.round((words.length / durationSec) * 60) : null;
  const sample = cleanedLines.find((l) => l.length >= 14 && l.length <= 120) ?? cleanedLines[0] ?? "";
  return {
    ok: true,
    cueCount: cleanedLines.length,
    wordCount: words.length,
    wpm,
    sample
  };
}

export function inferSpanishVideoTopic(title: string, sourceLabel?: string | null, hintTopic?: string): string {
  const text = `${title} ${sourceLabel ?? ""}`.toLowerCase();
  if (/\b(viaj|viajando|colombia|españa|madrid|barcelona|ciudad|aeropuerto|hotel|tren|pueblo|barrio|tokyo|trip|travel|hiking)\b/.test(text)) {
    return "旅行探索";
  }
  if (/\b(desayuno|desayunos|comida|cocina|cocinar|caf[eé]|tapa|tapas|restaurante|mercado|receta|street food|food|panader[ií]a)\b/.test(text)) {
    return "美食文化";
  }
  if (/\b(calle|street|interview|entrevista|gente)\b/.test(text)) {
    return "街头采访";
  }
  if (/\b(slow|superbeginner|absolute beginner|chats|dialog|diálogo|conversación|conversation|podcast)\b/.test(text)) {
    return "慢速对话";
  }
  if (/\b(vida|vlog|día|rutina|morning|casa|compras|shopping|work|daily|familia|amigos|amiga|friend|estudiar)\b/.test(text)) {
    return "日常生活";
  }
  return hintTopic || "文化故事";
}

export function assessSpanishVideoLevel(params: {
  title: string;
  hintLevel?: VideoLevel | null;
  durationSec: number;
  wpm: number | null;
}): { level: VideoLevel | null; levelSource: "curated" | "inferred" | null } {
  const { title, hintLevel, durationSec, wpm } = params;
  if (/\bA1\b|superbeginner|absolute beginner/i.test(title) || hintLevel === "A1") {
    if (wpm && wpm > 155) return { level: null, levelSource: null };
    return { level: "A1", levelSource: hintLevel === "A1" ? "curated" : "inferred" };
  }
  if (/\bA2\b|\bNivel 1\b|\bNivel 2\b|Slow Spanish/i.test(title) || hintLevel === "A2") {
    if (wpm && wpm <= 92 && /slow|beginner/i.test(title)) {
      return { level: "A1", levelSource: "inferred" };
    }
    if (wpm && wpm > 175) return { level: null, levelSource: null };
    return { level: "A2", levelSource: hintLevel === "A2" ? "curated" : "inferred" };
  }
  if (/\bB1\b|\bNivel 3\b|Intermediate/i.test(title) || hintLevel === "B1") {
    return { level: "B1", levelSource: hintLevel === "B1" ? "curated" : "inferred" };
  }

  if (wpm && durationSec >= 75) {
    if (wpm <= 95) return { level: "A2", levelSource: "inferred" };
    if (wpm >= 165 && durationSec >= 180) return { level: "B1", levelSource: "inferred" };
  }
  return { level: null, levelSource: null };
}
