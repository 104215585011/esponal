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

    /**
     * 发布脚本是"先建 release,再传 apk",这中间有几秒到几十秒的空窗。
     * 如果这期间有人点了「检查更新」,assets 还是空的,会缓存一个 downloadUrl:null,
     * App 端点了下载就报"没有下载地址"。这里按约定文件名兜一个直链出来。
     */
    const tag = candidate.tag_name ?? "";
    const fallbackUrl = `https://github.com/${REPO}/releases/download/${tag}/esponal-v${version}.apk`;

    return {
      latestVersion: version,
      downloadUrl: apk?.browser_download_url ?? fallbackUrl,
      notes: (candidate.body ?? candidate.name ?? "").trim().slice(0, 500),
      publishedAt: candidate.published_at ?? null,
      releaseUrl: candidate.html_url ?? null
    };
  } catch {
    return null;
  }
}

/**
 * 版本号必须是最新的,所以显式禁掉 Next / Vercel 的边缘缓存。
 * 之前只靠 `redis.set(..., "EX", 300)` 兜:一旦 EX 没生效(或边缘缓存按 must-revalidate
 * 仍给旧响应),就会出现「新版本已经发布了,App 检查更新永远看到上一版」——
 * 用户点下载装的还是旧包,这种问题从表面完全看不出来。
 */
export const dynamic = "force-dynamic";
export const revalidate = 0;

const NO_STORE = { "Cache-Control": "no-store, max-age=0, must-revalidate" };

export async function GET() {
  // 1. 先看缓存(缓存值自带写入时间,超过 TTL 就当没有——不依赖 Redis 的 EX 语义)
  try {
    const cached = await redis.get(CACHE_KEY);
    if (typeof cached === "string") {
      const entry = JSON.parse(cached) as { at?: number; payload?: VersionPayload };
      const age = Date.now() - (entry.at ?? 0);
      if (entry.payload && age >= 0 && age < CACHE_TTL_SEC * 1000) {
        return NextResponse.json(entry.payload, {
          headers: { ...NO_STORE, "X-Version-Source": "cache" }
        });
      }
    }
  } catch {
    // Redis 异常不阻断
  }

  // 2. 读 GitHub
  const fromGithub = await fetchFromGitHub();

  if (fromGithub) {
    try {
      await redis.set(
        CACHE_KEY,
        JSON.stringify({ at: Date.now(), payload: fromGithub }),
        "EX",
        CACHE_TTL_SEC
      );
    } catch {
      // 写入失败不影响返回
    }

    return NextResponse.json(fromGithub, {
      headers: { ...NO_STORE, "X-Version-Source": "github" }
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
    { headers: { ...NO_STORE, "X-Version-Source": "fallback" } }
  );
}
