// Timestamp: 2026-11-14 23:46
import { NextResponse } from "next/server";

import { getAuthedUserId } from "@/lib/api-auth";
import { addLimiter, checkRateLimit, getRetryAfterSec } from "@/lib/ratelimit";
import { readWatchProgress, writeWatchProgress } from "@/lib/watch-progress";

export const runtime = "nodejs";

/**
 * 视频观看进度（服务端）。
 *
 * 为什么放 Redis 而不是给 VideoView 加两列：
 *   - 进度是高频写、低价值、可丢的数据（丢了最多重看一段），不值得占业务表
 *   - 加列要动生产库迁移，收益和风险不成比例
 *
 * 代价：Redis 被驱逐或迁移时会丢。可接受——App 本地还存一份，
 * 端上是"本地优先 + 两边取更新的那份"，双写才是常态。
 */

const MAX_BATCH = 50;

async function limitOrNull(request: Request, userId: string) {
  const rateLimit = await checkRateLimit(addLimiter, request, userId);
  if (rateLimit.allowed) return null;

  const retryAfterSec = getRetryAfterSec(rateLimit.reset);
  return NextResponse.json(
    { error: "rate limited", retryAfterSec },
    { status: 429, headers: { "Retry-After": String(retryAfterSec) } }
  );
}

export async function POST(request: Request) {
  const userId = await getAuthedUserId(request);
  if (!userId) return NextResponse.json({ error: "unauthorized" }, { status: 401 });

  const limited = await limitOrNull(request, userId);
  if (limited) return limited;

  try {
    const body = (await request.json()) as {
      videoId?: unknown;
      position?: unknown;
      duration?: unknown;
    };

    const videoId = typeof body.videoId === "string" ? body.videoId.trim() : "";
    const position = typeof body.position === "number" ? body.position : NaN;
    const duration = typeof body.duration === "number" ? body.duration : 0;

    if (!videoId || !Number.isFinite(position) || position < 0) {
      return NextResponse.json({ error: "invalid payload" }, { status: 400 });
    }

    const progress = await writeWatchProgress(userId, videoId, position, duration);
    return NextResponse.json({ ok: true, progress });
  } catch (error) {
    console.error("Watch progress save failed", error);
    return NextResponse.json({ error: "progress save failed" }, { status: 500 });
  }
}

export async function GET(request: Request) {
  const userId = await getAuthedUserId(request);
  if (!userId) return NextResponse.json({ error: "unauthorized" }, { status: 401 });

  const { searchParams } = new URL(request.url);
  const videoIds = (searchParams.get("videoIds") ?? "")
    .split(",")
    .map((item) => item.trim())
    .filter(Boolean)
    .slice(0, MAX_BATCH);

  if (videoIds.length === 0) return NextResponse.json({ items: {} });

  const items = await readWatchProgress(userId, videoIds);
  return NextResponse.json({ items });
}
