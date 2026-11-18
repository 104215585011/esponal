// Timestamp: 2026-11-18 10:15
import { NextResponse } from "next/server";
import { getOptionalUserId } from "@/lib/api-auth";
import { getUnifiedVideoFeed } from "@/lib/video-feed";

export const dynamic = "force-dynamic";

/**
 * GET /api/videos/feed
 *
 * Android 与 Web 共用的跨来源混排视频池 API：
 * - 优先从共享视频库 VideoCatalog 读取已完成字幕检查（subtitleStatus = ready）的条目；
 * - 登录用户优先展示近期未看过的视频，再排已观看历史；
 * - 控制单个频道在首页推荐中的占比，支持 ?level=A1|A2|B1、?channelId=...、?seed=...。
 */
export async function GET(request: Request) {
  const userId = await getOptionalUserId(request);
  const { searchParams } = new URL(request.url);
  const lang = searchParams.get("lang") ?? searchParams.get("language");
  const level = searchParams.get("level");
  const channelId = searchParams.get("channelId") ?? searchParams.get("channel");
  const seedRaw = searchParams.get("seed");
  const seed = seedRaw !== null && /^\d+$/.test(seedRaw) ? Number(seedRaw) : null;

  try {
    const payload = await getUnifiedVideoFeed({
      language: lang,
      level,
      channelId,
      seed,
      userId
    });
    return NextResponse.json(payload);
  } catch (error) {
    console.error("Unified video feed failed", error);
    return NextResponse.json({ error: "video_feed_failed" }, { status: 500 });
  }
}
