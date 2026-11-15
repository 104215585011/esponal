// Timestamp: 2026-11-15 14:35
import { NextResponse } from "next/server";
import { isAllowedPodcastAudioUrl } from "@/lib/listening-audio";

export const runtime = "nodejs";
export const maxDuration = 60;

/**
 * GET /api/listening/audio?url=...
 * 播客 MP3 服务器代理（支持 Range 断点拖拽，解决海外播客 CDN 国内直连超时的痛点）。
 */
export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const rawUrl = searchParams.get("url")?.trim() ?? "";
  const target = isAllowedPodcastAudioUrl(rawUrl);

  if (!target) {
    return NextResponse.json({ error: "unsupported_audio_url" }, { status: 400 });
  }

  const forwardHeaders: Record<string, string> = {
    "User-Agent": "EsponalPodcastProxy/1.0 (+https://www.pcmuz.cn)",
    Accept: "audio/*,*/*;q=0.8"
  };

  const range = request.headers.get("range");
  if (range) {
    forwardHeaders.Range = range;
  }

  try {
    const upstream = await fetch(target.toString(), {
      headers: forwardHeaders,
      redirect: "follow",
      signal: AbortSignal.timeout(25_000)
    });

    if (!upstream.ok && upstream.status !== 206) {
      return NextResponse.json(
        { error: "audio_upstream_error", status: upstream.status },
        { status: 502 }
      );
    }

    const headers = new Headers();
    headers.set("Content-Type", upstream.headers.get("content-type") || "audio/mpeg");
    headers.set("Accept-Ranges", upstream.headers.get("accept-ranges") || "bytes");
    headers.set("Cache-Control", "public, max-age=3600");
    headers.set("Access-Control-Allow-Origin", "*");

    const contentLength = upstream.headers.get("content-length");
    if (contentLength) headers.set("Content-Length", contentLength);

    const contentRange = upstream.headers.get("content-range");
    if (contentRange) headers.set("Content-Range", contentRange);

    return new NextResponse(upstream.body, {
      status: upstream.status,
      headers
    });
  } catch (error) {
    return NextResponse.json(
      { error: "audio_proxy_failed", detail: error instanceof Error ? error.message : "timeout" },
      { status: 502 }
    );
  }
}
