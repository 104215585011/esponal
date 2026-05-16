import { NextResponse } from "next/server";
import {
  channelLimiter,
  checkRateLimit,
  getRetryAfterSec
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

const CHANNEL_CACHE_TTL_SECONDS = 60 * 60;

type ChannelsResponse = {
  items?: Array<{
    contentDetails?: {
      relatedPlaylists?: {
        uploads?: string;
      };
    };
  }>;
};

type PlaylistItemsResponse = {
  items?: Array<{
    snippet?: {
      title?: string;
      publishedAt?: string;
      channelTitle?: string;
      resourceId?: {
        videoId?: string;
      };
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

async function fetchUploadPlaylistId(channelId: string) {
  const response = await fetchYouTubeJson<ChannelsResponse>("channels", {
    part: "contentDetails",
    id: channelId
  });

  return response.items?.[0]?.contentDetails?.relatedPlaylists?.uploads ?? "";
}

async function fetchChannelVideos(channelId: string, maxResults: number) {
  const uploadsPlaylistId = await fetchUploadPlaylistId(channelId);

  if (!uploadsPlaylistId) {
    throw new Error("YouTube channel uploads playlist not found");
  }

  const playlistResponse = await fetchYouTubeJson<PlaylistItemsResponse>("playlistItems", {
    part: "snippet",
    playlistId: uploadsPlaylistId,
    maxResults: String(maxResults)
  });
  const videoIds = (playlistResponse.items ?? [])
    .map((item) => item.snippet?.resourceId?.videoId ?? "")
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

  const videos: YouTubeVideoPayload[] = [];

  for (const item of playlistResponse.items ?? []) {
    const snippet = item.snippet;
    const videoId = snippet?.resourceId?.videoId;

    if (!snippet || !videoId) {
      continue;
    }

    videos.push(
      normalizeVideoPayload({
        id: videoId,
        title: snippet.title ?? "",
        thumbnails: snippet.thumbnails,
        duration: durationById.get(videoId) ?? "",
        channelTitle: snippet.channelTitle ?? "",
        publishedAt: snippet.publishedAt ?? ""
      })
    );
  }

  return videos;
}

export async function GET(request: Request) {
  try {
    const rateLimit = await checkRateLimit(channelLimiter, request, null);

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
    const channelId = searchParams.get("id")?.trim() ?? "";
    const maxResults = clampMaxResults(searchParams.get("maxResults"), 12);

    if (!channelId) {
      return NextResponse.json({ error: "id is required" }, { status: 400 });
    }

    const videos = await getCachedJson(
      "youtube:channel",
      `${channelId}:${maxResults}`,
      CHANNEL_CACHE_TTL_SECONDS,
      () => fetchChannelVideos(channelId, maxResults)
    );

    return NextResponse.json(videos);
  } catch (error) {
    console.error("YouTube channel fetch failed", error);

    return NextResponse.json({ error: "youtube channel fetch failed" }, { status: 500 });
  }
}
