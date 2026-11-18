// Timestamp: 2026-11-18 10:58
import { getOptionalUserId } from "@/lib/api-auth";
import { withApiUsage } from "@/lib/api-usage";
import { NextResponse } from "next/server";
import {
  channelLimiter,
  checkRateLimit,
  getRetryAfterSec
} from "@/lib/ratelimit";
import { clampMaxResults } from "@/lib/youtube";
import { fetchChannelVideosCached } from "@/lib/youtube-channel";

export const dynamic = "force-dynamic";

export async function GET(request: Request) {
  const userId = await getOptionalUserId(request);
  return withApiUsage(userId, () => handleRequest(request));
}

async function handleRequest(request: Request) {
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

    const videos = await fetchChannelVideosCached(channelId, maxResults);

    return NextResponse.json(videos);
  } catch (error) {
    console.error("YouTube channel fetch failed", error);

    return NextResponse.json({ error: "youtube channel fetch failed" }, { status: 500 });
  }
}
