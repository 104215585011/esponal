// Timestamp: 2026-11-17 16:18
import { NextResponse } from "next/server";
import { getOptionalUserId } from "@/lib/api-auth";
import { getUnifiedVideoFeed } from "@/lib/video-feed";

export const dynamic = "force-dynamic";

/**
 * GET /api/videos/feed
 *
 * Android 与 Web 共用的跨频道混排视频池 API：
 * - 频道仅作内容来源，难度标记在单条视频上；
 * - 默认按语种跨频道混排推荐；
 * - 支持 `?level=A1|A2|B1`、?channelId=...（单独追某频道）、?seed=<num>（会话内稳定/主动刷新换批）；
 * - 某个级别内容不足时，如实返回少量结果并附带 nearbyLevel + nearbyVideos（「相近难度」推荐）。
 */
export async function GET(request: Request) {
  await getOptionalUserId(request);
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
      seed
    });
    return NextResponse.json(payload);
  } catch (error) {
    console.error("Unified video feed failed", error);
    return NextResponse.json({ error: "video_feed_failed" }, { status: 500 });
  }
}
