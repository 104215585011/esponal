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

export async function getCachedJson<T>(
  namespace: string,
  cacheInput: string,
  ttlSeconds: number,
  resolver: () => Promise<T>
) {
  const cacheKey = buildCacheKey(namespace, cacheInput);
  const cached = await safeCacheGet(cacheKey);

  if (cached) {
    return JSON.parse(cached) as T;
  }

  const value = await resolver();
  await safeCacheSet(cacheKey, JSON.stringify(value), ttlSeconds);

  return value;
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
