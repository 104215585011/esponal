// Timestamp: 2026-11-17 16:18
import { getCuratedChannelsByLanguage } from "@/lib/channels";
import { normalizeLanguage } from "@/lib/languages";
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

export async function getUnifiedVideoFeed(options?: {
  language?: string | null;
  level?: string | null;
  channelId?: string | null;
  seed?: number | null;
  perChannelLimit?: number;
}): Promise<VideoFeedResponsePayload> {
  const norm = normalizeLanguage(options?.language);
  const poolLang: PoolLanguage = norm === "de" ? "de" : "es";
  const channels = getCuratedChannelsByLanguage(poolLang);
  const perChannelLimit = Math.min(20, Math.max(4, options?.perChannelLimit ?? 12));

  const sourceInfos: ChannelSourceInfo[] = channels.map((ch) => ({
    id: ch.id,
    title: ch.title,
    language: poolLang,
    tag: ch.tag,
    description: ch.description
  }));

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
    seed: options?.seed
  });
}
