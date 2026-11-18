// Timestamp: 2026-11-18 17:30
import type { PodcastCue } from "./listening-audio.ts";
import { stripHtmlToText } from "./rss-extract.ts";
import { translateTextToZh } from "./translate.ts";

const PAYWALL_PATTERNS = [
  /solo est[aá]n? disponibles? para (?:los )?suscriptores premium/i,
  /el resto de la transcripci[oó]n/i,
  /hazte suscriptor premium/i,
  /contrata nuestra suscripci[oó]n/i
];

const BOILERPLATE_PATTERNS = [
  /men[uú]\s+clases\s+con\s+profesores/i,
  /utilizamos cookies/i,
  /nombre de usuario o correo/i,
  /privacy policy|all copyrights reserved/i,
  /inscr[ií]bete a nuestra newsletter/i,
  /this site uses akismet/i,
  /podcast:\s*play in new window/i,
  /subscribe:\s*rss/i,
  /powerpress_links/i
];

export function parseId3v2Size(header: Uint8Array | Buffer): number {
  if (header.length < 10) return 0;
  if (header[0] !== 0x49 || header[1] !== 0x44 || header[2] !== 0x33) {
    return 0;
  }
  const flags = header[5] ?? 0;
  const footer = (flags & 0x10) !== 0 ? 10 : 0;
  const tagSize =
    ((header[6] & 0x7f) << 21) |
    ((header[7] & 0x7f) << 14) |
    ((header[8] & 0x7f) << 7) |
    (header[9] & 0x7f);
  return tagSize > 0 ? 10 + tagSize + footer : 0;
}

export type ExtractedTranscript = {
  sentences: string[];
  coveredUntilSec: number;
  partialPaywalled: boolean;
};

function parseTimestampToken(raw: string): number | null {
  const m = raw.match(/^(?:[\p{L}][\p{L} .'-]{0,39}:\s*)?\[(\d{1,2}):(\d{2})(?::(\d{2}))?\]/u);
  if (!m) return null;
  if (typeof m[3] === "string") {
    return Number(m[1]) * 3600 + Number(m[2]) * 60 + Number(m[3]);
  }
  return Number(m[1]) * 60 + Number(m[2]);
}

function splitSentences(text: string): string[] {
  const raw = text
    .replace(/\[(\d{1,2}:)?\d{2}:\d{2}\]/g, " ")
    .replace(/\s+/g, " ")
    .trim();
  if (!raw) return [];

  const parts = raw
    .split(/(?<=[.!?])\s+|(?<=[。！？])/)
    .map((s) => s.trim())
    .filter((s) => s.length >= 4);

  // 合并过短碎句、拆分过长整段，使每条字幕 40~130 字符阅读体验最好
  const normalized: string[] = [];
  let buf = "";
  for (const part of parts) {
    if (part.length > 140) {
      if (buf) {
        normalized.push(buf);
        buf = "";
      }
      const subParts = part
        .split(/(?<=[,;:])\s+/)
        .map((x) => x.trim())
        .filter(Boolean);
      let sub = "";
      for (const sp of subParts) {
        if (sub && sub.length + sp.length > 120) {
          normalized.push(sub);
          sub = sp;
        } else {
          sub = sub ? `${sub} ${sp}` : sp;
        }
      }
      if (sub) normalized.push(sub);
      continue;
    }

    if (buf && buf.length + part.length > 125) {
      normalized.push(buf);
      buf = part;
    } else {
      buf = buf ? `${buf} ${part}` : part;
    }
  }
  if (buf) normalized.push(buf);
  return normalized;
}

/**
 * 从博客/播客网页 HTML 提取免费文稿段落；
 * 若遇到「余下文本仅限付费会员」（如 Hoy Hablamos 前 45 秒开篇文稿），仅覆盖免费前缀时长，其余回落到音频 AI 识别。
 */
export function extractTranscriptFromHtml(
  html: string,
  totalDurationSec: number
): ExtractedTranscript | null {
  const cleanedHtml = html
    .replace(/<script[\s\S]*?<\/script>/gi, " ")
    .replace(/<style[\s\S]*?<\/style>/gi, " ")
    .replace(/<nav[\s\S]*?<\/nav>/gi, " ");

  const rawParagraphs = [...cleanedHtml.matchAll(/<p[^>]*>([\s\S]*?)<\/p>/gi)]
    .map((m) => stripHtmlToText(m[1]).replace(/\s+/g, " ").trim())
    .filter(Boolean);

  if (rawParagraphs.length === 0) return null;

  let hasTimestamp = false;
  let maxTimestampSec = 0;
  let partialPaywalled = false;
  const keptParagraphs: string[] = [];

  for (const para of rawParagraphs) {
    if (PAYWALL_PATTERNS.some((re) => re.test(para))) {
      // 跳过顶部提示继续往下找开篇；若正文之后出现付费截断说明则停止收集
      if (keptParagraphs.length >= 2) {
        partialPaywalled = true;
        break;
      }
      continue;
    }

    if (BOILERPLATE_PATTERNS.some((re) => re.test(para))) {
      if (keptParagraphs.length >= 2) break;
      continue;
    }

    const ts = parseTimestampToken(para);
    if (ts !== null) {
      hasTimestamp = true;
      maxTimestampSec = Math.max(maxTimestampSec, ts);
    }

    if (hasTimestamp && para.length >= 18) {
      keptParagraphs.push(para);
    }
  }

  const joined = keptParagraphs.join(" ").trim();
  if (!hasTimestamp) return null;

  const sentences = splitSentences(joined);
  if (sentences.length < 2) return null;

  const approxSpeechSec = Math.max(25, Math.round(joined.length / 13));
  const coveredUntilSec = partialPaywalled
    ? Math.max(maxTimestampSec + approxSpeechSec, 35)
    : totalDurationSec > 0
      ? totalDurationSec
      : Math.max(approxSpeechSec, 300);

  return {
    sentences,
    coveredUntilSec: Math.min(coveredUntilSec, totalDurationSec > 0 ? totalDurationSec : coveredUntilSec),
    partialPaywalled
  };
}

/**
 * 从取到的播客文稿按时间比例切出指定窗口，并批量生成中文译文。
 */
export async function sliceTranscriptWindow(input: {
  sentences: string[];
  coveredUntilSec: number;
  windowStartSec: number;
  windowSec: number;
  language?: string;
}): Promise<PodcastCue[] | null> {
  const { sentences, coveredUntilSec, windowStartSec, windowSec, language = "es" } = input;
  if (sentences.length === 0 || windowStartSec >= coveredUntilSec) {
    return null;
  }

  const totalChars = sentences.reduce((sum, s) => sum + s.length, 0);
  if (totalChars <= 0) return null;

  let cursorChar = 0;
  const timedAll = sentences.map((text) => {
    const startRatio = cursorChar / totalChars;
    cursorChar += text.length;
    const endRatio = cursorChar / totalChars;
    const start = Number((startRatio * coveredUntilSec).toFixed(1));
    const end = Number((endRatio * coveredUntilSec).toFixed(1));
    return {
      text,
      start,
      dur: Number(Math.max(2.0, end - start).toFixed(1))
    };
  });

  const windowEnd = windowStartSec + windowSec;
  const inWindow = timedAll.filter(
    (cue) => cue.start >= windowStartSec && cue.start < windowEnd
  );

  if (inWindow.length === 0) {
    return null;
  }

  // 并行用 DeepSeek 翻译当前窗内的少数几句源文稿（~0.8-1.5s），速度远快于从头 ASR
  const translations = await Promise.all(
    inWindow.map((cue) =>
      translateTextToZh(cue.text, language)
        .then((res) => res?.translation ?? "")
        .catch(() => "")
    )
  );

  return inWindow.map((cue, idx) => ({
    start: cue.start,
    dur: cue.dur,
    text: cue.text,
    zh: translations[idx] ?? ""
  }));
}
