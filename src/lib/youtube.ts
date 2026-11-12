import { createHash } from "node:crypto";
import { redis } from "@/lib/redis";

const YOUTUBE_API_BASE_URL = "https://www.googleapis.com/youtube/v3";

// A structured error so callers can distinguish "our daily quota is gone"
// from "the upstream call broke for some other reason". The old code turned
// both into the same 500, which the search page then rendered as "no results".
export class YouTubeApiError extends Error {
  constructor(
    message: string,
    readonly status: number,
    readonly reason: string
  ) {
    super(message);
    this.name = "YouTubeApiError";
  }
}

const QUOTA_EXCEEDED_REASONS = new Set([
  "quotaExceeded",
  "dailyLimitExceeded",
  "rateLimitExceeded",
  "userRateLimitExceeded"
]);

export function isQuotaExceededError(error: unknown): boolean {
  if (!(error instanceof YouTubeApiError)) {
    return false;
  }

  return error.status === 429 || QUOTA_EXCEEDED_REASONS.has(error.reason);
}

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

// How old a cached payload may be before we refuse to serve it as a fallback.
// The Redis TTL above keeps bytes around for 7 days, but a week-old search
// result is worse than an honest error. Defaults to one day and is tunable.
const DEFAULT_MAX_STALE_AGE_SECONDS = 60 * 60 * 24;

function getMaxStaleAgeSeconds() {
  const configured = Number.parseInt(
    process.env.YOUTUBE_STALE_MAX_AGE_SECONDS ?? "",
    10
  );

  return Number.isFinite(configured) && configured > 0
    ? configured
    : DEFAULT_MAX_STALE_AGE_SECONDS;
}

export type CachedResult<T> = {
  data: T;
  stale: boolean;
  fetchedAt: number;
  fromCache: boolean;
};

export async function getCachedJsonWithMeta<T>(
  namespace: string,
  cacheInput: string,
  ttlSeconds: number,
  resolver: () => Promise<T>,
  options: { forceFresh?: boolean } = {}
): Promise<CachedResult<T>> {
  const cacheKey = buildCacheKey(namespace, cacheInput);
  const cached = options.forceFresh ? null : await safeCacheGet(cacheKey);

  let staleData: T | null = null;
  let staleFetchedAt = 0;

  if (cached) {
    try {
      const parsed = JSON.parse(cached) as { data: T; ts: number } | T;
      const envelope =
        parsed && typeof (parsed as { ts?: number }).ts === "number"
          ? (parsed as { data: T; ts: number })
          : { data: parsed as T, ts: 0 };
      staleData = envelope.data;
      staleFetchedAt = envelope.ts;

      if (!options.forceFresh && Date.now() - envelope.ts < ttlSeconds * 1000) {
        return {
          data: envelope.data,
          stale: false,
          fetchedAt: envelope.ts,
          fromCache: true
        };
      }
    } catch {
      // Corrupt cache entry — ignore and refetch.
    }
  }

  try {
    const value = await resolver();
    const fetchedAt = Date.now();

    await safeCacheSet(
      cacheKey,
      JSON.stringify({ data: value, ts: fetchedAt }),
      Math.max(ttlSeconds, STALE_FALLBACK_TTL_SECONDS)
    );

    return { data: value, stale: false, fetchedAt, fromCache: false };
  } catch (error) {
    const canUseStale =
      staleData !== null &&
      staleFetchedAt > 0 &&
      Date.now() - staleFetchedAt <= getMaxStaleAgeSeconds() * 1000;

    if (canUseStale) {
      console.warn("YouTube fetch failed; serving stale cache", error);

      return {
        data: staleData as T,
        stale: true,
        fetchedAt: staleFetchedAt,
        fromCache: true
      };
    }

    throw error;
  }
}

// Existing callers (channel route, older consumers) keep the plain-T contract.
export async function getCachedJson<T>(
  namespace: string,
  cacheInput: string,
  ttlSeconds: number,
  resolver: () => Promise<T>
): Promise<T> {
  return (
    await getCachedJsonWithMeta(namespace, cacheInput, ttlSeconds, resolver)
  ).data;
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
    const bodyText = await response.text().catch(() => "");
    let reason = "";

    try {
      const body = JSON.parse(bodyText) as {
        error?: { errors?: Array<{ reason?: string }> };
      };
      reason = body.error?.errors?.[0]?.reason ?? "";
    } catch {
      // Non-JSON error body — the status code is still enough to classify.
    }

    throw new YouTubeApiError(
      `YouTube ${resource} request failed: ${response.status}`,
      response.status,
      reason
    );
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
