import { NextResponse } from "next/server";
import {
  checkRateLimit,
  getRetryAfterSec,
  searchLimiter
} from "@/lib/ratelimit";
import {
  clampMaxResults,
  fetchYouTubeJson,
  getCachedJson,
  mapVideoDetailsById,
  normalizeVideoPayload,
  type YouTubeVideoPayload
} from "@/lib/youtube";

export const dynamic = "force-dynamic";

// search.list costs 100 quota units; cache aggressively (24h). Results are
// reused across users and rarely change within a day.
const SEARCH_CACHE_TTL_SECONDS = 60 * 60 * 24;

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

async function fetchSearchVideos(query: string, maxResults: number) {
  const searchResponse = await fetchYouTubeJson<SearchResponse>("search", {
    part: "snippet",
    q: query,
    type: "video",
    relevanceLanguage: "es",
    maxResults: String(maxResults)
  });
  const videoIds = (searchResponse.items ?? [])
    .map((item) => item.id?.videoId ?? "")
    .filter(Boolean);

  if (videoIds.length === 0) {
    return [] as YouTubeVideoPayload[];
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
  return results;
}

export async function GET(request: Request) {
  try {
    const rateLimit = await checkRateLimit(searchLimiter, request, null);

    if (!rateLimit.allowed) {
      const retryAfterSec = getRetryAfterSec(rateLimit.reset);

      return NextResponse.json(
        { error: "rate limited", retryAfterSec },
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

    const videos = await getCachedJson(
      "youtube:v2:search",
      `${query}:${maxResults}`,
      SEARCH_CACHE_TTL_SECONDS,
      () => fetchSearchVideos(query, maxResults)
    );

    return NextResponse.json(videos);
  } catch (error) {
    console.error("YouTube search failed", error);

    return NextResponse.json({ error: "youtube search failed" }, { status: 500 });
  }
}
