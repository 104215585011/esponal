// Timestamp: 2026-11-16 09:05
import { NextResponse } from "next/server";
import { isAllowedPodcastAudioUrl } from "@/lib/listening-audio";

export const runtime = "nodejs";
export const maxDuration = 30;

/**
 * GET /api/listening/image?url=...
 * 代理播客与西媒文章封面图（白名单域名校验 + 24h CDN 缓存），避免国内网络/Cloudflare 拦截导致封面裂图。
 */
export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const rawUrl = searchParams.get("url")?.trim() ?? "";
  const target = isAllowedPodcastAudioUrl(rawUrl);
  if (!target) {
    return NextResponse.json({ error: "unsupported_image_url" }, { status: 400 });
  }

  let upstream: Response;
  try {
    upstream = await fetch(target.toString(), {
      headers: {
        "User-Agent":
          "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0.0.0 Safari/537.36",
        Accept: "image/avif,image/webp,image/apng,image/*,*/*;q=0.8",
        Referer: `${target.protocol}//${target.host}/`,
      },
      redirect: "follow",
      signal: AbortSignal.timeout(10_000),
    });
  } catch {
    return NextResponse.json({ error: "image_fetch_timeout" }, { status: 504 });
  }

  if (!upstream.ok || !upstream.body) {
    return NextResponse.json({ error: "image_upstream_failed" }, { status: 502 });
  }

  const contentType = upstream.headers.get("content-type") ?? "";
  if (!contentType.toLowerCase().startsWith("image/")) {
    return NextResponse.json({ error: "not_an_image" }, { status: 415 });
  }

  const headers = new Headers();
  headers.set("Content-Type", contentType);
  headers.set("Cache-Control", "public, max-age=86400, s-maxage=86400, stale-while-revalidate=604800");
  const len = upstream.headers.get("content-length");
  if (len) headers.set("Content-Length", len);

  return new NextResponse(upstream.body, { status: 200, headers });
}
