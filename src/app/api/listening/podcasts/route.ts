// Timestamp: 2026-11-17 15:05
import { NextResponse } from "next/server";
import { getOptionalUserId } from "@/lib/api-auth";
import { normalizeLanguage } from "@/lib/languages";
import { CURATED_PODCASTS, fetchPodcastEpisodes } from "@/lib/podcasts";

/**
 * GET /api/listening/podcasts
 *
 * 按学习语种返回精选播客节目单与真实 MP3 单集（供移动端播客精听播放器使用）。
 */
export async function GET(request: Request) {
  await getOptionalUserId(request);
  const { searchParams } = new URL(request.url);
  const forceRefresh = searchParams.get("refresh") === "1";
  const langParam = searchParams.get("lang") ?? searchParams.get("language");
  const filterLang = normalizeLanguage(langParam);

  const episodes = await fetchPodcastEpisodes(forceRefresh, filterLang).catch(() => []);
  const shows = CURATED_PODCASTS.filter((show) => show.language === filterLang);
  return NextResponse.json({
    language: filterLang,
    shows,
    episodes,
    total: episodes.length,
  });
}
