// Timestamp: 2026-11-18 11:04
import spanishSeedRaw from "@/data/spanish-video-catalog.json";
import {
  analyzeSpanishSubtitleCues,
  assessSpanishVideoLevel,
  inferSpanishVideoTopic,
  type SubtitleAnalysisResult
} from "@/lib/video-catalog-logic";
import type { PoolLanguage, CatalogRawVideoInput } from "@/lib/video-pool-logic";
import { parseIsoDurationSeconds } from "@/lib/video-pool-logic";
import type { VideoLevel } from "@/lib/youtube-shared";

export {
  analyzeSpanishSubtitleCues,
  assessSpanishVideoLevel,
  inferSpanishVideoTopic,
  type SubtitleAnalysisResult
};

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
