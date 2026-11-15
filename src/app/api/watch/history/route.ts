// Timestamp: 2026-11-15 08:12
import { NextResponse } from "next/server";
import { getAuthedUserId } from "@/lib/api-auth";
import { addLimiter, checkRateLimit, getRetryAfterSec } from "@/lib/ratelimit";
import { getVideoViewsByUser, upsertVideoView } from "@/lib/corpus";
import { resolveRequestLanguage } from "@/lib/languages";
import { readWatchProgress } from "@/lib/watch-progress";

type WatchHistoryBody = {
  language?: unknown;
  videoId?: unknown;
  title?: unknown;
  channelTitle?: unknown;
  thumbnail?: unknown;
};

async function checkUserRateLimit(request: Request, userId: string) {
  const rateLimit = await checkRateLimit(addLimiter, request, userId);

  if (rateLimit.allowed) {
    return null;
  }

  const retryAfterSec = getRetryAfterSec(rateLimit.reset);
  return NextResponse.json(
    { error: "rate limited", retryAfterSec },
    {
      status: 429,
      headers: { "Retry-After": String(retryAfterSec) }
    }
  );
}

export async function POST(request: Request) {
  const userId = await getAuthedUserId(request);

  if (!userId) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }

  const limitedResponse = await checkUserRateLimit(request, userId);
  if (limitedResponse) return limitedResponse;

  try {
    const body = (await request.json()) as WatchHistoryBody;
    const videoId = typeof body.videoId === "string" ? body.videoId.trim() : "";
    const title = typeof body.title === "string" ? body.title.trim() : "";
    const channelTitle =
      typeof body.channelTitle === "string" ? body.channelTitle.trim() : "";
    const thumbnail = typeof body.thumbnail === "string" ? body.thumbnail.trim() : null;

    if (!videoId || !title || !channelTitle) {
      return NextResponse.json({ error: "missing required fields" }, { status: 400 });
    }

    const language = await resolveRequestLanguage(request, body.language, userId);

    const view = await upsertVideoView({
      userId,
      language,
      videoId,
      title,
      channelTitle,
      thumbnail
    });

    return NextResponse.json({
      ok: true,
      view: {
        id: view.id,
        videoId: view.videoId,
        title: view.title,
        channelTitle: view.channelTitle,
        thumbnail: view.thumbnail,
        viewedAt: view.viewedAt.toISOString()
      }
    });
  } catch (error) {
    console.error("Watch history save failed", error);
    return NextResponse.json({ error: "history save failed" }, { status: 500 });
  }
}

export async function GET(request: Request) {
  const userId = await getAuthedUserId(request);

  if (!userId) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }

  const limitedResponse = await checkUserRateLimit(request, userId);
  if (limitedResponse) return limitedResponse;

  const { searchParams } = new URL(request.url);
  const limitValue = Number.parseInt(searchParams.get("limit") ?? "100", 10);
  const language = await resolveRequestLanguage(
    request,
    searchParams.get("lang") ?? searchParams.get("language"),
    userId
  );
  const views = await getVideoViewsByUser(
    userId,
    Number.isFinite(limitValue) ? limitValue : 100,
    language
  );

  // 顺带把观看进度带上，App 首页「接着看」才能显示看到哪
  const progress = await readWatchProgress(
    userId,
    views.map((view) => view.videoId)
  );

  return NextResponse.json({
    videos: views.map((view) => ({
      id: view.id,
      videoId: view.videoId,
      title: view.title,
      channelTitle: view.channelTitle,
      thumbnail: view.thumbnail,
      viewedAt: view.viewedAt.toISOString(),
      position: progress[view.videoId]?.position ?? null,
      duration: progress[view.videoId]?.duration ?? null
    }))
  });
}
