import { createHash } from "node:crypto";
import { redis } from "@/lib/redis";

const YOUTUBE_API_BASE_URL = "https://www.googleapis.com/youtube/v3";

type YouTubeThumbnailSet = {
  default?: { url?: string };
  medium?: { url?: string };
  high?: { url?: string };
  standard?: { url?: string };
  maxres?: { url?: string };
};

type YouTubeVideoDetail = {
  id: string;
  duration: string;
};

type YouTubeVideoPayload = {
  id: string;
  title: string;
  thumbnail: string;
  duration: string;
  channelTitle: string;
  publishedAt: string;
};

function buildCacheKey(namespace: string, input: string) {
  const digest = createHash("sha256").update(input).digest("hex");

  return `${namespace}:${digest}`;
}

export function clampMaxResults(value: string | null, fallback: number) {
  const parsed = Number.parseInt(value ?? "", 10);

  if (!Number.isFinite(parsed)) {
    return fallback;
  }

  return Math.min(50, Math.max(1, parsed));
}

export function getYouTubeApiKey() {
  const apiKey = process.env.YOUTUBE_API_KEY?.trim();

  if (!apiKey) {
    throw new Error("YOUTUBE_API_KEY is not configured");
  }

  return apiKey;
}

async function safeCacheGet(cacheKey: string) {
  try {
    return await redis.get(cacheKey);
  } catch (error) {
    console.warn("YouTube cache read failed", error);
    return null;
  }
}

async function safeCacheSet(cacheKey: string, value: string, ttlSeconds: number) {
  try {
    await redis.set(cacheKey, value, "EX", ttlSeconds);
  } catch (error) {
    console.warn("YouTube cache write failed", error);
  }
}

// Keep cached payloads around far longer than their freshness window so they
// can be served as a fallback when the YouTube Data API call fails (e.g. the
// daily quota is exhausted). Without this, a quota-exhausted day leaves
// channel/search sections blank instead of showing slightly stale data.
//
// Quota note: do not routinely clear youtube:* Redis keys during operations.
// Do not bump YouTube cache namespaces casually. Each broad invalidation forces
// cold rehydration and can burn through search.list quota especially quickly.
const STALE_FALLBACK_TTL_SECONDS = 60 * 60 * 24 * 7;

export async function getCachedJson<T>(
  namespace: string,
  cacheInput: string,
  ttlSeconds: number,
  resolver: () => Promise<T>
) {
  const cacheKey = buildCacheKey(namespace, cacheInput);
  const cached = await safeCacheGet(cacheKey);

  let staleData: T | null = null;
  let hasStale = false;

  if (cached) {
    try {
      const parsed = JSON.parse(cached) as { data: T; ts: number } | T;
      const envelope =
        parsed && typeof (parsed as { ts?: number }).ts === "number"
          ? (parsed as { data: T; ts: number })
          : { data: parsed as T, ts: 0 };
      staleData = envelope.data;
      hasStale = true;

      if (Date.now() - envelope.ts < ttlSeconds * 1000) {
        return envelope.data;
      }
    } catch {
      // Corrupt cache entry — ignore and refetch.
    }
  }

  try {
    const value = await resolver();
    await safeCacheSet(
      cacheKey,
      JSON.stringify({ data: value, ts: Date.now() }),
      Math.max(ttlSeconds, STALE_FALLBACK_TTL_SECONDS)
    );
    return value;
  } catch (error) {
    if (hasStale) {
      console.warn("YouTube fetch failed; serving stale cache", error);
      return staleData as T;
    }
    throw error;
  }
}

export async function fetchYouTubeJson<T>(
  resource: string,
  params: Record<string, string>
) {
  const apiKey = getYouTubeApiKey();
  const searchParams = new URLSearchParams({
    ...params,
    key: apiKey
  });
  const response = await fetch(
    `${YOUTUBE_API_BASE_URL}/${resource}?${searchParams.toString()}`,
    {
      next: { revalidate: 0 }
    }
  );

  if (!response.ok) {
    throw new Error(`YouTube ${resource} request failed: ${response.status}`);
  }

  return (await response.json()) as T;
}

export function pickThumbnailUrl(thumbnails: YouTubeThumbnailSet | undefined) {
  return (
    thumbnails?.maxres?.url ??
    thumbnails?.standard?.url ??
    thumbnails?.high?.url ??
    thumbnails?.medium?.url ??
    thumbnails?.default?.url ??
    ""
  );
}

export function mapVideoDetailsById(videoDetails: YouTubeVideoDetail[]) {
  return new Map(videoDetails.map((item) => [item.id, item.duration]));
}

export function normalizeVideoPayload(input: {
  id: string;
  title: string;
  thumbnails?: YouTubeThumbnailSet;
  duration?: string;
  channelTitle: string;
  publishedAt: string;
}): YouTubeVideoPayload {
  return {
    id: input.id,
    title: input.title,
    thumbnail: pickThumbnailUrl(input.thumbnails),
    duration: input.duration ?? "",
    channelTitle: input.channelTitle,
    publishedAt: input.publishedAt
  };
}

export type { YouTubeThumbnailSet, YouTubeVideoDetail, YouTubeVideoPayload };
