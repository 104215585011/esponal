// Timestamp: 2026-11-14 02:40
import { NextResponse } from "next/server";
import { redis } from "@/lib/redis";

/**
 * GET /api/mobile/app-version
 *
 * 给 App 做「检查更新」用。数据直接从 GitHub Releases 读,不做人工维护
 * ——只要发新版 release,App 就能感知到。
 *
 * GitHub 匿名 API 限流 60 次/小时,所以结果在 Redis 缓存 10 分钟。
 * GitHub 挂掉时回退到本地兜底值(宁可让用户看到旧版本号,也不要让检查更新报错)。
 */

const REPO = "104215585011/esponal";
const CACHE_KEY = "mobile:app-version";
const CACHE_TTL_SEC = 60 * 5;

type VersionPayload = {
  latestVersion: string;
  downloadUrl: string | null;
  notes: string;
  publishedAt: string | null;
  releaseUrl: string | null;
};

/** "mobile-v0.3.0" → "0.3.0" */
function parseVersion(tagName: string) {
  const match = /v?(\d+)\.(\d+)\.(\d+)/.exec(tagName);
  return match ? `${match[1]}.${match[2]}.${match[3]}` : null;
}

async function fetchFromGitHub(): Promise<VersionPayload | null> {
  try {
    const res = await fetch(
      `https://api.github.com/repos/${REPO}/releases?per_page=10`,
      {
        headers: {
          Accept: "application/vnd.github+json",
          "User-Agent": "esponal-app-version-check"
        },
        // 自己管缓存,不用 Next 的 fetch 缓存
        cache: "no-store"
      }
    );

    if (!res.ok) return null;

    const releases = (await res.json()) as Array<{
      tag_name?: string;
      name?: string;
      body?: string;
      draft?: boolean;
      published_at?: string;
      html_url?: string;
      assets?: Array<{ browser_download_url?: string; name?: string }>;
    }>;

    const candidate = releases.find(
      (release) =>
        !release.draft &&
        // 只认移动端 tag,避免将来 Web 端的 release 被误当成 App 版本
        (release.tag_name ?? "").startsWith("mobile-v") &&
        parseVersion(release.tag_name ?? "")
    );

    if (!candidate) return null;

    const version = parseVersion(candidate.tag_name ?? "");
    if (!version) return null;

    const apk = candidate.assets?.find((asset) =>
      asset.name?.toLowerCase().endsWith(".apk")
    );

    return {
      latestVersion: version,
      downloadUrl: apk?.browser_download_url ?? null,
      notes: (candidate.body ?? candidate.name ?? "").trim().slice(0, 500),
      publishedAt: candidate.published_at ?? null,
      releaseUrl: candidate.html_url ?? null
    };
  } catch {
    return null;
  }
}

export async function GET() {
  // 1. 先看缓存
  try {
    const cached = await redis.get(CACHE_KEY);
    if (typeof cached === "string") {
      return NextResponse.json(JSON.parse(cached), {
        headers: { "X-Version-Source": "cache" }
      });
    }
  } catch {
    // Redis 异常不阻断
  }

  // 2. 读 GitHub
  const fromGithub = await fetchFromGitHub();

  if (fromGithub) {
    try {
      await redis.set(CACHE_KEY, JSON.stringify(fromGithub), "EX", CACHE_TTL_SEC);
    } catch {
      // 写入失败不影响返回
    }

    return NextResponse.json(fromGithub, {
      headers: { "X-Version-Source": "github" }
    });
  }

  // 3. 兜底:GitHub 不可用时返回已知最新版,避免 App 端「检查更新」直接报错
  return NextResponse.json(
    {
      latestVersion: "0.3.0",
      downloadUrl:
        "https://github.com/104215585011/esponal/releases/download/mobile-v0.3.0/esponal-v0.3.0.apk",
      notes: "",
      publishedAt: null,
      releaseUrl: "https://github.com/104215585011/esponal/releases"
    } satisfies VersionPayload,
    { headers: { "X-Version-Source": "fallback" } }
  );
}
