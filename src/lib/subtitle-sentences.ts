// Timestamp: 2026-11-24 11:00
import { createHash } from "node:crypto";
import { meteredFetch } from "./api-usage.ts";

export type SubtitleCue = {
  start: number;
  dur: number;
  text: string;
};

type TimedPiece = {
  start: number;
  end: number;
  text: string;
  endsSentence: boolean;
};

type WordSpan = {
  word: string;
  norm: string;
  start: number;
  end: number;
};

const ABBREVIATIONS = new Set([
  "sr",
  "sra",
  "srta",
  "dr",
  "dra",
  "mr",
  "mrs",
  "ms",
  "prof",
  "st",
  "vs",
  "etc",
  "ej",
  "p.ej",
  "u.s",
  "u.k",
  "e.g",
  "i.e",
  "a.m",
  "p.m",
  "nr",
  "z.b",
  "bzw",
  "usw",
  "ca",
  "mme",
  "mlle",
  "av",
  "no"
]);

const LANG_NAME: Record<string, string> = {
  es: "Spanish",
  de: "German",
  en: "English",
  fr: "French",
  ja: "Japanese"
};

const SENTENCE_END_RE = /[.!?\u3002\uff01\uff1f]["'”’»)\]]*\s*$/;
const MAX_SILENCE_GAP_SEC = 2.2;
const AI_CHUNK_CUE_LIMIT = 55;
const AI_MAX_CHUNKS = 14;
const AI_CONCURRENCY = 4;

function isJapaneseLang(lang: string): boolean {
  return lang.toLowerCase().startsWith("ja");
}

function isConfiguredSecret(value: string | undefined): boolean {
  return Boolean(
    value &&
      value.trim().length > 0 &&
      !value.toLowerCase().includes("replace-with") &&
      !value.toLowerCase().includes("placeholder")
  );
}

function clampMonotonicCues(cues: SubtitleCue[]): SubtitleCue[] {
  const sorted = cues
    .filter((cue) => cue.text.trim().length > 0 && Number.isFinite(cue.start) && Number.isFinite(cue.dur) && cue.dur > 0)
    .map((cue) => ({
      start: Number(Math.max(0, cue.start).toFixed(3)),
      dur: Number(Math.max(0.15, cue.dur).toFixed(3)),
      text: cue.text.replace(/\s+/g, " ").trim()
    }))
    .sort((a, b) => a.start - b.start);

  for (let i = 0; i < sorted.length - 1; i += 1) {
    const nextStart = sorted[i + 1].start;
    const end = sorted[i].start + sorted[i].dur;
    if (end > nextStart) {
      sorted[i] = {
        ...sorted[i],
        dur: Number(Math.max(0.1, nextStart - sorted[i].start).toFixed(3))
      };
    }
  }

  return sorted;
}

function isAbbreviationBeforeDot(text: string, dotIndex: number): boolean {
  // Skip decimals like 3.5 or ellipsis ...
  if (dotIndex > 0 && /\d/.test(text[dotIndex - 1]) && /\d/.test(text[dotIndex + 1] ?? "")) {
    return true;
  }
  if (text[dotIndex + 1] === "." || text[dotIndex - 1] === ".") {
    return true;
  }
  // Extract word immediately before dot
  const before = text.slice(Math.max(0, dotIndex - 12), dotIndex);
  const match = /([A-Za-z\u00c0-\u024f]+(?:\.[A-Za-z\u00c0-\u024f]+)?)$/.exec(before);
  if (!match) return false;
  const token = match[1].toLowerCase();
  if (ABBREVIATIONS.has(token)) return true;
  // Single capital initial like "J. K. Rowling"
  if (match[1].length === 1 && /[A-Z]/.test(match[1])) return true;
  return false;
}

/**
 * Splits a single cue at internal sentence boundaries (`.`, `!`, `?`, `。`, `！`, `？`),
 * distributing timestamps proportionally by character length.
 */
function splitCueIntoTimedPieces(cue: SubtitleCue, isJa: boolean): TimedPiece[] {
  const text = cue.text.replace(/\s+/g, " ").trim();
  if (!text) return [];

  const start = cue.start;
  const end = cue.start + Math.max(0.15, cue.dur);
  const segments: Array<{ text: string; endsSentence: boolean }> = [];

  let segStart = 0;
  for (let i = 0; i < text.length; i += 1) {
    const ch = text[i];
    const isWesternTerm = ch === "." || ch === "!" || ch === "?";
    const isCjkTerm = ch === "\u3002" || ch === "\uff01" || ch === "\uff1f";
    if (!isWesternTerm && !isCjkTerm) continue;

    if (ch === "." && isAbbreviationBeforeDot(text, i)) {
      continue;
    }

    // Consume trailing repeated punctuation or closing quotes/brackets
    let splitEnd = i + 1;
    while (splitEnd < text.length && /[.!?\u3002\uff01\uff1f"'”’»)\]]/.test(text[splitEnd])) {
      splitEnd += 1;
    }

    // For Western text, require end-of-string or whitespace after punctuation
    if (!isJa && isWesternTerm && splitEnd < text.length && !/\s/.test(text[splitEnd])) {
      continue;
    }

    const piece = text.slice(segStart, splitEnd).trim();
    if (piece) {
      segments.push({ text: piece, endsSentence: true });
    }
    segStart = splitEnd;
    while (segStart < text.length && /\s/.test(text[segStart])) {
      segStart += 1;
    }
    i = segStart - 1;
  }

  if (segStart < text.length) {
    const tail = text.slice(segStart).trim();
    if (tail) {
      segments.push({ text: tail, endsSentence: SENTENCE_END_RE.test(tail) });
    }
  }

  if (segments.length <= 1) {
    return [{ start, end, text, endsSentence: SENTENCE_END_RE.test(text) }];
  }

  const totalWeight = segments.reduce((sum, seg) => sum + Math.max(1, seg.text.length), 0);
  const totalDur = Math.max(0.15, end - start);
  const timed: TimedPiece[] = [];
  let cursor = start;

  for (let i = 0; i < segments.length; i += 1) {
    const seg = segments[i];
    const weight = Math.max(1, seg.text.length);
    const pieceEnd = i === segments.length - 1 ? end : cursor + (totalDur * weight) / totalWeight;
    timed.push({
      start: cursor,
      end: Math.max(cursor + 0.1, pieceEnd),
      text: seg.text,
      endsSentence: seg.endsSentence
    });
    cursor = pieceEnd;
  }

  return timed;
}

/**
 * Deterministic sentence re-alignment: splits cues at mid-cue punctuation and
 * merges fragments across cue boundaries into complete sentences with proportional timestamps.
 */
export function segmentCuesByPunctuation(cues: SubtitleCue[], lang = "es"): SubtitleCue[] {
  if (!Array.isArray(cues) || cues.length === 0) return [];
  const isJa = isJapaneseLang(lang);
  const maxChars = isJa ? 75 : 190;
  const normalized = clampMonotonicCues(cues);

  const pieces: TimedPiece[] = [];
  for (const cue of normalized) {
    pieces.push(...splitCueIntoTimedPieces(cue, isJa));
  }

  const sentences: SubtitleCue[] = [];
  let bufText = "";
  let bufStart = 0;
  let bufEnd = 0;

  const flush = () => {
    const clean = bufText.replace(/\s+/g, " ").trim();
    if (clean) {
      sentences.push({
        start: bufStart,
        dur: Math.max(0.2, bufEnd - bufStart),
        text: clean
      });
    }
    bufText = "";
  };

  for (const piece of pieces) {
    if (!bufText) {
      bufStart = piece.start;
      bufEnd = piece.end;
      bufText = piece.text;
    } else {
      const gap = piece.start - bufEnd;
      const joiner = isJa ? "" : " ";
      const candidate = `${bufText}${joiner}${piece.text}`;
      const shouldBreakBefore = gap > MAX_SILENCE_GAP_SEC || candidate.length > maxChars;

      if (shouldBreakBefore) {
        flush();
        bufStart = piece.start;
        bufEnd = piece.end;
        bufText = piece.text;
      } else {
        bufText = candidate;
        bufEnd = Math.max(bufEnd, piece.end);
      }
    }

    if (piece.endsSentence) {
      flush();
    }
  }

  flush();
  return clampMonotonicCues(sentences);
}

/**
 * Detects whether raw cues lack reliable punctuation (typical of older YouTube ASR tracks)
 * and therefore need AI sentence boundary detection + punctuation restoration.
 */
export function needsAiSentenceSegmentation(cues: SubtitleCue[], lang = "es"): boolean {
  if (cues.length < 3) return false;
  const isJa = isJapaneseLang(lang);
  const joined = cues.map((c) => c.text.trim()).filter(Boolean).join(isJa ? "" : " ");
  if (joined.length < 80) return false;

  const terminators = (joined.match(/[.!?\u3002\uff01\uff1f]/g) ?? []).length;

  if (isJa) {
    if (terminators === 0) return true;
    return joined.length / terminators > 95;
  }

  const words = joined.split(/\s+/).filter(Boolean).length;
  if (words < 20) return false;
  if (terminators === 0) return true;
  if (words / terminators > 28) return true;

  // Also trigger AI if deterministic segmentation still leaves large unpunctuated blocks
  const det = segmentCuesByPunctuation(cues, lang);
  const unpunctuatedChars = det
    .filter((c) => !SENTENCE_END_RE.test(c.text) && c.text.length >= 130)
    .reduce((sum, c) => sum + c.text.length, 0);

  return unpunctuatedChars / Math.max(1, joined.length) >= 0.3;
}

function normalizeWordForAlign(word: string): string {
  return word
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9\u3040-\u30ff\u4e00-\u9fff]/g, "");
}

function buildWordTimeline(cues: SubtitleCue[]): WordSpan[] {
  const spans: WordSpan[] = [];
  for (const cue of cues) {
    const words = cue.text.trim().split(/\s+/).filter(Boolean);
    if (words.length === 0) continue;
    const totalChars = words.reduce((sum, w) => sum + Math.max(1, w.length), 0);
    const dur = Math.max(0.15, cue.dur);
    let cursor = cue.start;
    for (let i = 0; i < words.length; i += 1) {
      const w = words[i];
      const next = i === words.length - 1 ? cue.start + dur : cursor + (dur * Math.max(1, w.length)) / totalChars;
      spans.push({
        word: w,
        norm: normalizeWordForAlign(w),
        start: cursor,
        end: Math.max(cursor + 0.05, next)
      });
      cursor = next;
    }
  }
  return spans;
}

/**
 * Aligns AI-punctuated sentences back onto the raw cue timeline so timestamps remain
 * faithful to the spoken audio.
 */
export function alignSentencesToCues(
  sentences: string[],
  chunkCues: SubtitleCue[],
  lang = "es"
): SubtitleCue[] | null {
  const cleanSentences = sentences
    .map((s) => s.replace(/\s+/g, " ").trim())
    .filter(Boolean);
  if (cleanSentences.length === 0 || chunkCues.length === 0) return null;

  const isJa = isJapaneseLang(lang);
  const chunkStart = chunkCues[0].start;
  const lastCue = chunkCues[chunkCues.length - 1];
  const chunkEnd = Math.max(chunkStart + 0.5, lastCue.start + lastCue.dur);

  if (isJa) {
    const rawLen = chunkCues.reduce((sum, c) => sum + c.text.replace(/\s+/g, "").length, 0);
    const outLen = cleanSentences.reduce((sum, s) => sum + s.replace(/\s+/g, "").length, 0);
    if (rawLen === 0 || outLen < rawLen * 0.7 || outLen > rawLen * 1.35) {
      return null;
    }
    const result: SubtitleCue[] = [];
    let cursor = chunkStart;
    const totalDur = chunkEnd - chunkStart;
    for (let i = 0; i < cleanSentences.length; i += 1) {
      const s = cleanSentences[i];
      const weight = Math.max(1, s.replace(/\s+/g, "").length);
      const end = i === cleanSentences.length - 1 ? chunkEnd : cursor + (totalDur * weight) / outLen;
      result.push({ start: cursor, dur: Math.max(0.2, end - cursor), text: s });
      cursor = end;
    }
    return clampMonotonicCues(result);
  }

  const timeline = buildWordTimeline(chunkCues);
  if (timeline.length === 0) return null;

  const sentenceWordCounts = cleanSentences.map((s) => s.split(/\s+/).filter(Boolean).length);
  const totalOutWords = sentenceWordCounts.reduce((a, b) => a + b, 0);
  const ratio = totalOutWords / timeline.length;
  // Reject hallucinated, truncated, or summarized AI responses
  if (ratio < 0.78 || ratio > 1.25) {
    return null;
  }

  const aligned: SubtitleCue[] = [];
  let wordCursor = 0;

  for (let i = 0; i < cleanSentences.length; i += 1) {
    const text = cleanSentences[i];
    const words = text.split(/\s+/).filter(Boolean);
    const count = words.length;
    const remainingOut = sentenceWordCounts.slice(i).reduce((a, b) => a + b, 0);
    const remainingIn = Math.max(1, timeline.length - wordCursor);
    const scaledCount =
      i === cleanSentences.length - 1
        ? remainingIn
        : Math.max(1, Math.round((count / Math.max(1, remainingOut)) * remainingIn));

    let endIdx = Math.min(timeline.length - 1, wordCursor + scaledCount - 1);

    // Fine-tune end boundary by looking ±3 words for an exact match with the sentence's last word
    const targetLast = normalizeWordForAlign(words[words.length - 1] ?? "");
    if (targetLast && i < cleanSentences.length - 1) {
      for (let delta = 0; delta <= 3; delta += 1) {
        const candPlus = endIdx + delta;
        if (candPlus < timeline.length - 1 && timeline[candPlus].norm === targetLast) {
          endIdx = candPlus;
          break;
        }
        const candMinus = endIdx - delta;
        if (candMinus >= wordCursor && timeline[candMinus].norm === targetLast) {
          endIdx = candMinus;
          break;
        }
      }
    }

    const startSpan = timeline[Math.min(wordCursor, timeline.length - 1)];
    const endSpan = timeline[Math.min(Math.max(endIdx, wordCursor), timeline.length - 1)];
    aligned.push({
      start: startSpan.start,
      dur: Math.max(0.25, endSpan.end - startSpan.start),
      text
    });
    wordCursor = Math.min(timeline.length, endIdx + 1);
  }

  return clampMonotonicCues(aligned);
}

async function callAiSentenceSplitter(chunkText: string, lang: string): Promise<string[] | null> {
  const providers: Array<{ provider: string; baseUrl: string; apiKey: string; model: string }> = [];

  if (isConfiguredSecret(process.env.DEEPSEEK_API_KEY)) {
    providers.push({
      provider: "deepseek",
      baseUrl: process.env.DEEPSEEK_BASE_URL ?? "https://api.deepseek.com",
      apiKey: process.env.DEEPSEEK_API_KEY!.trim(),
      model: process.env.DEEPSEEK_MODEL ?? "deepseek-chat"
    });
  }

  if (isConfiguredSecret(process.env.DASHSCOPE_API_KEY)) {
    providers.push({
      provider: "dashscope",
      baseUrl: "https://dashscope.aliyuncs.com/compatible-mode",
      apiKey: process.env.DASHSCOPE_API_KEY!.trim(),
      model: process.env.DASHSCOPE_MODEL ?? "glm-5"
    });
  }

  if (providers.length === 0) return null;

  const langName = LANG_NAME[lang.toLowerCase().split(/[-_]/)[0]] ?? "Spanish";
  const systemPrompt = [
    `You segment raw ${langName} video transcripts into clean, natural complete sentences for language learners.`,
    "Rules:",
    "1. Keep EVERY spoken word verbatim in the original order. Do NOT translate, summarize, drop, or invent words.",
    `2. Add accurate ${langName} sentence punctuation and capitalization (e.g. periods, question marks, exclamation marks; for Spanish include ¿ and ¡ where appropriate).`,
    "3. Aim for 1 complete sentence per item (keep sentences natural, roughly 5-25 words each).",
    '4. Return valid JSON only: {"sentences": ["...", "..."]}.'
  ].join("\n");

  for (const cfg of providers) {
    try {
      const response = await meteredFetch(
        { provider: cfg.provider, feature: "subtitle_segmentation", unit: "tokens" },
        `${cfg.baseUrl.replace(/\/+$/, "")}/v1/chat/completions`,
        {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${cfg.apiKey}`
          },
          body: JSON.stringify({
            model: cfg.model,
            temperature: 0,
            response_format: { type: "json_object" },
            messages: [
              { role: "system", content: systemPrompt },
              { role: "user", content: chunkText }
            ]
          }),
          signal: AbortSignal.timeout(9500)
        },
        true
      );

      if (!response.ok) continue;

      const data = (await response.json()) as {
        choices?: Array<{ message?: { content?: string } }>;
      };
      const raw = data.choices?.[0]?.message?.content?.trim() ?? "";
      if (!raw) continue;

      const cleaned = raw.replace(/^```(?:json)?\s*/i, "").replace(/\s*```\s*$/, "");
      const parsed = JSON.parse(cleaned) as { sentences?: unknown };
      if (Array.isArray(parsed.sentences) && parsed.sentences.length > 0) {
        return parsed.sentences.filter((s): s is string => typeof s === "string" && s.trim().length > 0);
      }
    } catch {
      // try fallback provider
    }
  }

  return null;
}

export function buildSubtitleFingerprint(cues: SubtitleCue[]): string {
  if (cues.length === 0) return "empty";
  const first = cues[0];
  const mid = cues[Math.floor(cues.length / 2)];
  const last = cues[cues.length - 1];
  const raw = `${cues.length}|${first.start}:${first.text}|${mid.start}:${mid.text}|${last.start}:${last.text}`;
  return createHash("sha1").update(raw).digest("hex").slice(0, 12);
}

/**
 * Converts raw YouTube cues into clean sentence-by-sentence cues.
 * - Uses instant mid-cue punctuation re-alignment when punctuation is already present.
 * - Automatically invokes AI sentence segmentation (DeepSeek / DashScope) when captions
 *   are unpunctuated or contain large run-on blocks, preserving accurate audio timestamps.
 */
export async function segmentSubtitleCuesToSentences(
  rawCues: SubtitleCue[],
  lang = "es",
  options: { allowAi?: boolean } = {}
): Promise<{ cues: SubtitleCue[]; mode: "punctuation" | "ai" | "raw" }> {
  if (!Array.isArray(rawCues) || rawCues.length === 0) {
    return { cues: [], mode: "raw" };
  }

  const normalized = clampMonotonicCues(rawCues);
  const allowAi = options.allowAi !== false;

  if (!allowAi || !needsAiSentenceSegmentation(normalized, lang)) {
    return {
      cues: segmentCuesByPunctuation(normalized, lang),
      mode: "punctuation"
    };
  }

  const isJa = isJapaneseLang(lang);
  const chunks: SubtitleCue[][] = [];
  for (let i = 0; i < normalized.length; i += AI_CHUNK_CUE_LIMIT) {
    chunks.push(normalized.slice(i, i + AI_CHUNK_CUE_LIMIT));
  }

  if (chunks.length > AI_MAX_CHUNKS) {
    // Very long videos (e.g. 1.5h+): avoid serverless timeout by using deterministic pass
    return {
      cues: segmentCuesByPunctuation(normalized, lang),
      mode: "punctuation"
    };
  }

  const results: SubtitleCue[][] = new Array(chunks.length);
  let aiUsedCount = 0;
  let nextIdx = 0;

  async function worker() {
    while (nextIdx < chunks.length) {
      const idx = nextIdx;
      nextIdx += 1;
      const chunk = chunks[idx];
      const text = chunk.map((c) => c.text).join(isJa ? "" : " ");
      const sentences = await callAiSentenceSplitter(text, lang);
      const aligned = sentences ? alignSentencesToCues(sentences, chunk, lang) : null;
      if (aligned && aligned.length > 0) {
        results[idx] = aligned;
        aiUsedCount += 1;
      } else {
        results[idx] = segmentCuesByPunctuation(chunk, lang);
      }
    }
  }

  await Promise.all(
    Array.from({ length: Math.min(AI_CONCURRENCY, chunks.length) }, () => worker())
  );

  const merged = clampMonotonicCues(results.flat());
  return {
    cues: merged.length > 0 ? merged : segmentCuesByPunctuation(normalized, lang),
    mode: aiUsedCount > 0 ? "ai" : "punctuation"
  };
}
