// Timestamp: 2026-11-15 07:48
import { NextResponse } from "next/server";
import { getOptionalUserId } from "@/lib/api-auth";
import { CURATED_PODCASTS, fetchPodcastEpisodes } from "@/lib/podcasts";

/**
 * GET /api/listening/podcasts
 *
 * 返回精选西语播客节目单与最新真实 MP3 单集（供移动端播客精听播放器使用）。
 */
export async function GET(request: Request) {
  await getOptionalUserId(request);
  const { searchParams } = new URL(request.url);
  const forceRefresh = searchParams.get("refresh") === "1";

  const episodes = await fetchPodcastEpisodes(forceRefresh).catch(() => []);
  return NextResponse.json({
    shows: CURATED_PODCASTS,
    episodes,
    total: episodes.length,
  });
}
