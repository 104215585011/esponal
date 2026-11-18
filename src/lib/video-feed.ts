// Timestamp: 2026-11-18 10:15
import { getCuratedChannelsByLanguage } from "@/lib/channels";
import { normalizeLanguage } from "@/lib/languages";
import { prisma } from "@/lib/prisma";
import { loadReadyCatalogByChannel } from "@/lib/video-catalog";
import { fetchChannelVideosCached } from "@/lib/youtube-channel";
import {
  buildVideoFeedPayload,
  type ChannelSourceInfo,
  type PoolLanguage,
  type VideoFeedResponsePayload
} from "@/lib/video-pool-logic";

export type {
  ChannelSourceInfo,
  PoolLanguage,
  TaggedVideoItem,
  VideoFeedResponsePayload
} from "@/lib/video-pool-logic";

async function loadViewedVideoIds(userId: string | null | undefined, language: PoolLanguage) {
  if (!userId) return new Set<string>();
  try {
    const rows = await prisma.videoView.findMany({
      where: { userId, language },
      select: { videoId: true },
      orderBy: { viewedAt: "desc" },
      take: 250
    });
    return new Set(rows.map((r) => r.videoId));
  } catch {
    return new Set<string>();
  }
}

export async function getUnifiedVideoFeed(options?: {
  language?: string | null;
  level?: string | null;
  channelId?: string | null;
  seed?: number | null;
  perChannelLimit?: number;
  userId?: string | null;
}): Promise<VideoFeedResponsePayload> {
  const norm = normalizeLanguage(options?.language);
  const poolLang: PoolLanguage =
    norm === "de" || norm === "en" || norm === "fr" || norm === "ja" ? norm : "es";
  const channels = getCuratedChannelsByLanguage(poolLang);
  const perChannelLimit = Math.min(20, Math.max(4, options?.perChannelLimit ?? 12));

  const sourceInfos: ChannelSourceInfo[] = channels.map((ch) => ({
    id: ch.id,
    title: ch.title,
    language: poolLang,
    tag: ch.tag,
    description: ch.description
  }));

  const viewedVideoIds = await loadViewedVideoIds(options?.userId, poolLang);

  // 西语首版优先走已预检西语字幕的共享视频库（仅 subtitleStatus=ready 入池）
  if (poolLang === "es") {
    const catalogByChannel = await loadReadyCatalogByChannel("es");
    if (catalogByChannel.length > 0) {
      return buildVideoFeedPayload({
        language: "es",
        channels: sourceInfos,
        rawByChannel: catalogByChannel,
        level: options?.level,
        channelId: options?.channelId,
        seed: options?.seed,
        viewedVideoIds,
        skipCuratedFallback: true
      });
    }
  }

  const settled = await Promise.allSettled(
    channels.map(async (ch) => ({
      channelId: ch.id,
      videos: await fetchChannelVideosCached(ch.id, perChannelLimit)
    }))
  );

  const rawByChannel = settled
    .filter(
      (res): res is PromiseFulfilledResult<{ channelId: string; videos: Awaited<ReturnType<typeof fetchChannelVideosCached>> }> =>
        res.status === "fulfilled"
    )
    .map((res) => res.value);

  return buildVideoFeedPayload({
    language: poolLang,
    channels: sourceInfos,
    rawByChannel,
    level: options?.level,
    channelId: options?.channelId,
    seed: options?.seed,
    viewedVideoIds
  });
}
