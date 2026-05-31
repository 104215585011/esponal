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

const CHANNEL_CACHE_TTL_SECONDS = 60 * 60 * 12;

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
    status?: {
      embeddable?: boolean;
    };
  }>;
};

function decodeXmlText(value: string) {
  return value
    .replaceAll("&amp;", "&")
    .replaceAll("&lt;", "<")
    .replaceAll("&gt;", ">")
    .replaceAll("&quot;", "\"")
    .replaceAll("&#39;", "'");
}

function matchXmlTag(block: string, tagName: string) {
  const escapedTagName = tagName.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  const match = block.match(new RegExp(`<${escapedTagName}>([\\s\\S]*?)</${escapedTagName}>`));

  return match?.[1]?.trim() ?? "";
}

function matchXmlAttribute(block: string, tagName: string, attributeName: string) {
  const escapedTagName = tagName.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  const escapedAttributeName = attributeName.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  const match = block.match(
    new RegExp(`<${escapedTagName}[^>]*${escapedAttributeName}="([^"]+)"`, "i")
  );

  return match?.[1]?.trim() ?? "";
}

function parseChannelFeed(xml: string, maxResults: number) {
  const channelTitle = decodeXmlText(matchXmlTag(xml, "title")) || "YouTube Channel";

  return Array.from(xml.matchAll(/<entry>([\s\S]*?)<\/entry>/g))
    .slice(0, maxResults)
    .map((match) => match[1])
    .map((entryXml) => {
      const videoId = matchXmlTag(entryXml, "yt:videoId");

      if (!videoId) {
        return null;
      }

      const title =
        decodeXmlText(matchXmlTag(entryXml, "media:title")) ||
        decodeXmlText(matchXmlTag(entryXml, "title")) ||
        "YouTube 视频";
      const thumbnail = matchXmlAttribute(entryXml, "media:thumbnail", "url");
      const publishedAt = matchXmlTag(entryXml, "published");

      return {
        id: videoId,
        title,
        thumbnail,
        duration: "",
        channelTitle,
        publishedAt
      } satisfies YouTubeVideoPayload;
    })
    .filter((video): video is YouTubeVideoPayload => Boolean(video));
}

async function fetchUploadPlaylistId(channelId: string) {
  const response = await fetchYouTubeJson<ChannelsResponse>("channels", {
    part: "contentDetails",
    id: channelId
  });

  return response.items?.[0]?.contentDetails?.relatedPlaylists?.uploads ?? "";
}

async function fetchChannelVideosFromApi(channelId: string, maxResults: number) {
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

  const videos: YouTubeVideoPayload[] = [];

  for (const item of playlistResponse.items ?? []) {
    const snippet = item.snippet;
    const videoId = snippet?.resourceId?.videoId;

    if (!snippet || !videoId) {
      continue;
    }

    if (embeddableById.get(videoId) === false) {
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

async function fetchChannelVideosFromFeed(channelId: string, maxResults: number) {
  const response = await fetch(
    `https://www.youtube.com/feeds/videos.xml?channel_id=${encodeURIComponent(channelId)}`,
    {
      cache: "no-store"
    }
  );

  if (!response.ok) {
    throw new Error(`YouTube channel feed request failed: ${response.status}`);
  }

  const xml = await response.text();

  return parseChannelFeed(xml, maxResults);
}

async function fetchChannelVideos(channelId: string, maxResults: number) {
  try {
    return await fetchChannelVideosFromApi(channelId, maxResults);
  } catch (error) {
    console.warn("YouTube channel API fetch failed, falling back to feed", error);
    return fetchChannelVideosFromFeed(channelId, maxResults);
  }
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
