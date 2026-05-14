import { NextResponse } from "next/server";
import {
  clampMaxResults,
  fetchYouTubeJson,
  getCachedJson,
  mapVideoDetailsById,
  normalizeVideoPayload,
  type YouTubeVideoPayload
} from "@/lib/youtube";

export const dynamic = "force-dynamic";

const SEARCH_CACHE_TTL_SECONDS = 60 * 15;

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
    part: "contentDetails",
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

  return (searchResponse.items ?? [])
    .filter(
      (
        item
      ): item is NonNullable<SearchResponse["items"]>[number] & {
        id: { videoId: string };
        snippet: NonNullable<SearchResponse["items"]>[number]["snippet"];
      } => Boolean(item.id?.videoId && item.snippet)
    )
    .map((item) =>
      normalizeVideoPayload({
        id: item.id.videoId,
        title: item.snippet?.title ?? "",
        thumbnails: item.snippet?.thumbnails,
        duration: durationById.get(item.id.videoId) ?? "",
        channelTitle: item.snippet?.channelTitle ?? "",
        publishedAt: item.snippet?.publishedAt ?? ""
      })
    );
}

export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
    const query = searchParams.get("q")?.trim() ?? "";
    const maxResults = clampMaxResults(searchParams.get("maxResults"), 20);

    if (!query) {
      return NextResponse.json({ error: "q is required" }, { status: 400 });
    }

    const videos = await getCachedJson(
      "youtube:search",
      `${query}:${maxResults}`,
      SEARCH_CACHE_TTL_SECONDS,
      () => fetchSearchVideos(query, maxResults)
    );

    return NextResponse.json({ videos });
  } catch (error) {
    console.error("YouTube search failed", error);

    return NextResponse.json({ error: "youtube search failed" }, { status: 500 });
  }
}
