// Timestamp: 2026-06-03 10:05
import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { getAuthOptions } from "@/lib/auth";
import { addLimiter, checkRateLimit, getRetryAfterSec } from "@/lib/ratelimit";
import { getVideoViewsByUser, upsertVideoView } from "@/lib/corpus";

type WatchHistoryBody = {
  videoId?: unknown;
  title?: unknown;
  channelTitle?: unknown;
  thumbnail?: unknown;
};

function getUserId(session: unknown) {
  const maybeSession = session as { user?: { id?: unknown } } | null;

  return maybeSession?.user && typeof maybeSession.user.id === "string"
    ? maybeSession.user.id
    : null;
}

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
  const session = await getServerSession(getAuthOptions());
  const userId = getUserId(session);

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

    const view = await upsertVideoView({
      userId,
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
  const session = await getServerSession(getAuthOptions());
  const userId = getUserId(session);

  if (!userId) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }

  const limitedResponse = await checkUserRateLimit(request, userId);
  if (limitedResponse) return limitedResponse;

  const { searchParams } = new URL(request.url);
  const limitValue = Number.parseInt(searchParams.get("limit") ?? "100", 10);
  const views = await getVideoViewsByUser(
    userId,
    Number.isFinite(limitValue) ? limitValue : 100
  );

  return NextResponse.json({
    videos: views.map((view) => ({
      id: view.id,
      videoId: view.videoId,
      title: view.title,
      channelTitle: view.channelTitle,
      thumbnail: view.thumbnail,
      viewedAt: view.viewedAt.toISOString()
    }))
  });
}
