// Timestamp: 2026-11-17 15:02
import { NextResponse } from "next/server";
import { getCuratedChannelsByLanguage } from "@/lib/channels";
import { normalizeLanguage } from "@/lib/languages";

/**
 * GET /api/youtube/channels?lang=es|de
 * 返回对应学习语种的精选 YouTube 频道列表（含语言隔离）。
 */
export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const language = normalizeLanguage(searchParams.get("lang") ?? searchParams.get("language"));
  const channels = getCuratedChannelsByLanguage(language);
  return NextResponse.json({ language, channels });
}
