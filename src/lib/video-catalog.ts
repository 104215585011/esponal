// Timestamp: 2026-11-18 10:15
import spanishSeedRaw from "@/data/spanish-video-catalog.json";
import type { PoolLanguage, CatalogRawVideoInput } from "@/lib/video-pool-logic";
import { parseIsoDurationSeconds } from "@/lib/video-pool-logic";
import type { VideoLevel } from "@/lib/youtube-shared";

export type SeedCatalogRecord = {
  videoId: string;
  language: PoolLanguage;
  sourceType: "channel" | "playlist" | "curated";
  sourceId: string;
  sourceLabel?: string | null;
  channelId: string;
  channelTitle: string;
  title: string;
  thumbnail: string;
  duration: string;
  durationSec?: number | null;
  publishedAt?: string;
  topic?: string | null;
  level?: VideoLevel | null;
  levelSource?: "curated" | "inferred" | null;
  subtitleStatus: "ready";
  subtitleSource?: string | null;
  subtitleCueCount?: number | null;
  subtitleSampleEs?: string | null;
};

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

/**
 * 校验取到的西语字幕是否真正可用（至少 6 条有效对白、含足够西语高频词，排除纯音效或非西语轨道）。
 */
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

/**
 * 结合明确分级线索与真实字幕语速（WPM）判定单条视频难度；依据不足时返回 null。
 */
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

export function getSpanishSeedCatalog(): SeedCatalogRecord[] {
  return (spanishSeedRaw as SeedCatalogRecord[]).filter(
    (item) => Boolean(item.videoId) && item.subtitleStatus === "ready"
  );
}

let seedSyncedForEs = false;

async function getPrismaSafe() {
  try {
    const { prisma } = await import("@/lib/prisma");
    return prisma;
  } catch {
    return null;
  }
}

export async function ensureSpanishCatalogSeeded(): Promise<void> {
  if (seedSyncedForEs) return;
  const prisma = await getPrismaSafe();
  if (!prisma) return;

  try {
    const seeds = getSpanishSeedCatalog();
    if (seeds.length === 0) return;

    const existingCount = await prisma.videoCatalog.count({
      where: { language: "es", subtitleStatus: "ready" }
    });
    if (existingCount >= seeds.length) {
      seedSyncedForEs = true;
      return;
    }

    const now = new Date();
    for (const item of seeds) {
      await prisma.videoCatalog.upsert({
        where: { videoId: item.videoId },
        create: {
          videoId: item.videoId,
          language: "es",
          sourceType: item.sourceType,
          sourceId: item.sourceId,
          sourceLabel: item.sourceLabel ?? null,
          channelId: item.channelId,
          channelTitle: item.channelTitle,
          title: item.title,
          thumbnail: item.thumbnail,
          duration: item.duration ?? "",
          durationSec: item.durationSec ?? parseIsoDurationSeconds(item.duration ?? ""),
          publishedAt: item.publishedAt ?? "",
          topic: item.topic ?? null,
          level: item.level ?? null,
          levelSource: item.levelSource ?? null,
          subtitleStatus: "ready",
          subtitleSource: item.subtitleSource ?? "supadata",
          subtitleCueCount: item.subtitleCueCount ?? null,
          subtitleSampleEs: item.subtitleSampleEs ?? null,
          subtitleCheckedAt: now,
          embeddable: true,
          isActive: true
        },
        update: {
          subtitleStatus: "ready",
          subtitleSource: item.subtitleSource ?? undefined,
          subtitleCueCount: item.subtitleCueCount ?? undefined,
          subtitleSampleEs: item.subtitleSampleEs ?? undefined,
          subtitleCheckedAt: now,
          topic: item.topic ?? undefined,
          level: item.level ?? null,
          levelSource: item.levelSource ?? null,
          sourceLabel: item.sourceLabel ?? undefined,
          isActive: true
        }
      });
    }
    seedSyncedForEs = true;
  } catch (error) {
    console.warn("[video-catalog] seed sync skipped:", error instanceof Error ? error.message : error);
  }
}

function toCatalogRawInput(row: {
  videoId: string;
  title: string;
  thumbnail: string;
  duration: string;
  channelId: string;
  channelTitle: string;
  publishedAt: string;
  language: string;
  level: string | null;
  levelSource: string | null;
  topic: string | null;
  sourceType: string;
  sourceLabel: string | null;
  subtitleSource: string | null;
  subtitleCueCount: number | null;
}): CatalogRawVideoInput {
  const validLevel: VideoLevel | null =
    row.level === "A1" || row.level === "A2" || row.level === "B1" ? row.level : null;
  const validLevelSource =
    row.levelSource === "curated" || row.levelSource === "inferred" ? row.levelSource : undefined;
  const validSourceType =
    row.sourceType === "channel" || row.sourceType === "playlist" || row.sourceType === "curated"
      ? row.sourceType
      : "playlist";

  return {
    id: row.videoId,
    title: row.title,
    thumbnail: row.thumbnail,
    duration: row.duration,
    channelId: row.channelId,
    channelTitle: row.channelTitle,
    publishedAt: row.publishedAt,
    language: "es",
    level: validLevel,
    levelSource: validLevelSource,
    topic: row.topic,
    sourceType: validSourceType,
    sourceLabel: row.sourceLabel,
    subtitleStatus: "ready",
    subtitleSource: row.subtitleSource,
    subtitleCueCount: row.subtitleCueCount
  };
}

/**
 * 读取指定语种的共享已核验视频库（按 channelId 分组返回）。
 * 仅返回 `subtitleStatus === "ready"` 且 `embeddable && isActive` 的条目。
 */
export async function loadReadyCatalogByChannel(
  language: PoolLanguage
): Promise<Array<{ channelId: string; videos: CatalogRawVideoInput[] }>> {
  if (language === "es") {
    await ensureSpanishCatalogSeeded();
  }

  const prisma = await getPrismaSafe();
  let rows: Array<ReturnType<typeof toCatalogRawInput>> = [];

  if (prisma) {
    try {
      const dbRows = await prisma.videoCatalog.findMany({
        where: {
          language,
          subtitleStatus: "ready",
          embeddable: true,
          isActive: true
        },
        orderBy: [{ updatedAt: "desc" }]
      });
      rows = dbRows.map(toCatalogRawInput);
    } catch (error) {
      console.warn("[video-catalog] DB query failed, falling back to static seed:", error instanceof Error ? error.message : error);
    }
  }

  if (rows.length === 0 && language === "es") {
    rows = getSpanishSeedCatalog().map((item) =>
      toCatalogRawInput({
        videoId: item.videoId,
        title: item.title,
        thumbnail: item.thumbnail,
        duration: item.duration,
        channelId: item.channelId,
        channelTitle: item.channelTitle,
        publishedAt: item.publishedAt ?? "",
        language: "es",
        level: item.level ?? null,
        levelSource: item.levelSource ?? null,
        topic: item.topic ?? null,
        sourceType: item.sourceType,
        sourceLabel: item.sourceLabel ?? null,
        subtitleSource: item.subtitleSource ?? null,
        subtitleCueCount: item.subtitleCueCount ?? null
      })
    );
  }

  const byChannel = new Map<string, CatalogRawVideoInput[]>();
  for (const row of rows) {
    const cid = row.channelId || "unknown";
    const bucket = byChannel.get(cid) ?? [];
    bucket.push(row);
    byChannel.set(cid, bucket);
  }

  return Array.from(byChannel.entries()).map(([channelId, videos]) => ({
    channelId,
    videos
  }));
}

/**
 * 字幕路由在实测某条视频是否能返回可用原文字幕后，回写共享视频库状态。
 * 保证无可用字幕的已有条目自动降级退出首页推荐，新核验成功的保留记录。
 */
export async function recordCatalogSubtitleVerification(params: {
  videoId: string;
  language: string;
  cues: Array<{ text?: string }>;
  source: string;
}): Promise<void> {
  const { videoId, language, cues, source } = params;
  if (!videoId || (language !== "es" && language !== "de")) return;

  const prisma = await getPrismaSafe();
  if (!prisma) return;

  try {
    const existing = await prisma.videoCatalog.findUnique({
      where: { videoId },
      select: { id: true, durationSec: true, language: true }
    });
    if (!existing) return;

    const analysis =
      language === "es"
        ? analyzeSpanishSubtitleCues(cues, existing.durationSec ?? 0)
        : {
            ok: cues.length >= 6,
            cueCount: cues.length,
            sample: cues[0]?.text?.trim() ?? ""
          };

    await prisma.videoCatalog.update({
      where: { videoId },
      data: {
        subtitleStatus: analysis.ok ? "ready" : "missing",
        subtitleSource: source,
        subtitleCueCount: analysis.cueCount,
        subtitleSampleEs: analysis.sample || undefined,
        subtitleCheckedAt: new Date()
      }
    });
  } catch {
    // Non-fatal background sync
  }
}
