import { NextResponse } from "next/server";
import {
  checkRateLimit,
  getRetryAfterSec,
  searchLimiter
} from "@/lib/ratelimit";
import {
  clampMaxResults,
  fetchYouTubeJson,
  getCachedJsonWithMeta,
  isQuotaExceededError,
  mapVideoDetailsById,
  normalizeVideoPayload,
  type YouTubeVideoPayload
} from "@/lib/youtube";
import {
  buildSearchCacheInput,
  isFreshRequested,
  normalizePageToken,
  normalizeRegionCode,
  normalizeSearchOrder,
  type SearchOrder
} from "@/lib/youtube-search-params";

export const dynamic = "force-dynamic";

// search.list costs 100 quota units; cache aggressively (24h). Results are
// reused across users and rarely change within a day.
const SEARCH_CACHE_TTL_SECONDS = 60 * 60 * 24;

function getConfiguredSearchTtl() {
  const configured = Number.parseInt(
    process.env.YOUTUBE_SEARCH_CACHE_TTL_SECONDS ?? "",
    10
  );

  return Number.isFinite(configured) && configured > 0
    ? configured
    : SEARCH_CACHE_TTL_SECONDS;
}

type SearchResponse = {
  items?: Array<{
    id?: {
      videoId?: string;
    };
    snippet?: {
      title?: string;
      publishedAt?: string;
      channelTitle?: string;
      thumbnails?: {
        default?: { url?: string };
        medium?: { url?: string };
        high?: { url?: string };
        standard?: { url?: string };
        maxres?: { url?: string };
      };
    };
  }>;
  nextPageToken?: string;
  prevPageToken?: string;
};

type VideosResponse = {
  items?: Array<{
    id?: string;
    contentDetails?: {
      duration?: string;
    };
    status?: {
      embeddable?: boolean;
    };
  }>;
};

export type SearchPayload = {
  videos: YouTubeVideoPayload[];
  nextPageToken: string;
  prevPageToken: string;
};

type SearchOptions = {
  order: SearchOrder;
  region: string;
  pageToken: string;
};

async function fetchSearchVideos(
  query: string,
  maxResults: number,
  options: SearchOptions
): Promise<SearchPayload> {
  const params: Record<string, string> = {
    part: "snippet",
    q: query,
    type: "video",
    relevanceLanguage: "es",
    // Only ask for videos we can actually show in the iframe player. The old
    // flow fetched 20 and then silently dropped non-embeddable ones, so the
    // page could show far fewer than 20 while the videos ranked 21+ (which
    // might have been embeddable) never got a chance.
    videoEmbeddable: "true",
    maxResults: String(maxResults)
  };

  if (options.order !== "relevance") {
    params.order = options.order;
  }
  if (options.region) {
    params.regionCode = options.region;
  }
  if (options.pageToken) {
    params.pageToken = options.pageToken;
  }

  const searchResponse = await fetchYouTubeJson<SearchResponse>(
    "search",
    params
  );

  // A non-default `order` can loosen `type=video` filtering per the API docs,
  // so never trust an item without a real videoId.
  const videoIds = (searchResponse.items ?? [])
    .map((item) => item.id?.videoId ?? "")
    .filter(Boolean);

  if (videoIds.length === 0) {
    return {
      videos: [],
      nextPageToken: searchResponse.nextPageToken ?? "",
      prevPageToken: searchResponse.prevPageToken ?? ""
    };
  }

  const videosResponse = await fetchYouTubeJson<VideosResponse>("videos", {
    part: "contentDetails,status",
    id: videoIds.join(",")
  });
  const durationById = mapVideoDetailsById(
    (videosResponse.items ?? [])
      .filter((item): item is { id: string; contentDetails?: { duration?: string } } =>
        typeof item.id === "string"
      )
      .map((item) => ({
        id: item.id,
        duration: item.contentDetails?.duration ?? ""
      }))
  );

  const embeddableById = new Map<string, boolean>();
  for (const item of videosResponse.items ?? []) {
    if (item.id) {
      embeddableById.set(item.id, item.status?.embeddable ?? true);
    }
  }

  const results: YouTubeVideoPayload[] = [];
  for (const item of searchResponse.items ?? []) {
    if (!item.id?.videoId || !item.snippet) {
      continue;
    }
    const videoId = item.id.videoId;
    // Defence in depth: videoEmbeddable=true should already guarantee this,
    // but keep the explicit check so a partial videos.list response cannot
    // leak a non-playable video into the UI.
    if (embeddableById.get(videoId) === false) {
      continue;
    }
    results.push(
      normalizeVideoPayload({
        id: videoId,
        title: item.snippet.title ?? "",
        thumbnails: item.snippet.thumbnails,
        duration: durationById.get(videoId) ?? "",
        channelTitle: item.snippet.channelTitle ?? "",
        publishedAt: item.snippet.publishedAt ?? ""
      })
    );
  }

  return {
    videos: results,
    nextPageToken: searchResponse.nextPageToken ?? "",
    prevPageToken: searchResponse.prevPageToken ?? ""
  };
}

// Cache entries written before the paging/order work stored a bare array.
// Accept both shapes so existing `youtube:v2:search` keys stay usable instead
// of forcing a costly cold rehydration of every popular query.
function coerceSearchPayload(data: unknown): SearchPayload {
  if (Array.isArray(data)) {
    return {
      videos: data as YouTubeVideoPayload[],
      nextPageToken: "",
      prevPageToken: ""
    };
  }

  const payload = (data ?? {}) as Partial<SearchPayload>;

  return {
    videos: Array.isArray(payload.videos) ? payload.videos : [],
    nextPageToken:
      typeof payload.nextPageToken === "string" ? payload.nextPageToken : "",
    prevPageToken:
      typeof payload.prevPageToken === "string" ? payload.prevPageToken : ""
  };
}

export async function GET(request: Request) {
  const rateLimit = await checkRateLimit(searchLimiter, request, null);

  if (!rateLimit.allowed) {
    const retryAfterSec = getRetryAfterSec(rateLimit.reset);

    return NextResponse.json(
      { error: "rate_limited", retryAfterSec },
      {
        status: 429,
        headers: { "Retry-After": String(retryAfterSec) }
      }
    );
  }

  const { searchParams } = new URL(request.url);
  const query = searchParams.get("q")?.trim() ?? "";
  const maxResults = clampMaxResults(searchParams.get("maxResults"), 20);

  if (!query) {
    return NextResponse.json({ error: "q is required" }, { status: 400 });
  }

  const order = normalizeSearchOrder(searchParams.get("order"));
  const configuredRegion = normalizeRegionCode(process.env.YOUTUBE_REGION_CODE);
  const region =
    normalizeRegionCode(searchParams.get("region")) || configuredRegion;
  const pageToken = normalizePageToken(searchParams.get("page"));

  // Bypassing a shared cache spends 100 quota units every time. Keep the
  // escape hatch for local diagnosis only; production ignores it.
  const forceFresh =
    process.env.NODE_ENV !== "production" &&
    isFreshRequested(searchParams.get("fresh"));

  try {
    const cacheTtlSeconds = getConfiguredSearchTtl();
    const cached = await getCachedJsonWithMeta<SearchPayload>(
      "youtube:v2:search",
      buildSearchCacheInput({ query, maxResults, order, region, pageToken }),
      cacheTtlSeconds,
      () => fetchSearchVideos(query, maxResults, { order, region, pageToken }),
      { forceFresh }
    );
    const payload = coerceSearchPayload(cached.data);

    return NextResponse.json({
      ...payload,
      meta: {
        stale: cached.stale,
        fromCache: cached.fromCache,
        fetchedAt: cached.fetchedAt,
        order,
        region,
        cacheTtlSeconds
      }
    });
  } catch (error) {
    console.error("YouTube search failed", error);

    if (isQuotaExceededError(error)) {
      return NextResponse.json(
        {
          error: "quota_exceeded",
          message: "YouTube 每日搜索配额已用完，请稍后再试。"
        },
        { status: 429 }
      );
    }

    return NextResponse.json({ error: "youtube_search_failed" }, { status: 500 });
  }
}
