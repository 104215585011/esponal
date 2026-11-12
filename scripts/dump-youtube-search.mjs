// Diagnose why Esponal search results differ from what youtube.com shows.
//
//   node scripts/dump-youtube-search.mjs "comida española"
//   node scripts/dump-youtube-search.mjs "comida" --order date --region ES
//   node scripts/dump-youtube-search.mjs "comida" --base https://your-site.vercel.app
//
// It prints four layers side by side:
//   1. raw search.list without videoEmbeddable (the unfiltered candidate set)
//   2. which of those would be dropped by the embeddable filter
//   3. the shared Redis cache entry for this exact query
//   4. what /api/youtube/search actually returns to the page
//
// Cost: one search.list call (100 quota units) + one cheap videos.list call.

import { createHash } from "node:crypto";
import { readFile } from "node:fs/promises";
import { existsSync } from "node:fs";
import { fileURLToPath } from "node:url";
import path from "node:path";
import Redis from "ioredis";
import {
  buildSearchCacheInput,
  normalizePageToken,
  normalizeRegionCode,
  normalizeSearchOrder
} from "../src/lib/youtube-search-params.ts";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");

async function loadDotEnv() {
  const envPath = path.join(root, ".env");

  if (!existsSync(envPath)) {
    return;
  }

  const text = await readFile(envPath, "utf8");

  for (const line of text.split(/\r?\n/)) {
    const match = line.match(/^\s*([A-Za-z_][A-Za-z0-9_]*)\s*=\s*(.*)\s*$/);
    if (!match) continue;

    const key = match[1];
    let value = match[2].trim();

    if (
      (value.startsWith('"') && value.endsWith('"')) ||
      (value.startsWith("'") && value.endsWith("'"))
    ) {
      value = value.slice(1, -1);
    }

    if (process.env[key] === undefined) {
      process.env[key] = value;
    }
  }
}

function parseArgs(argv) {
  const positional = [];
  const flags = {};

  for (let i = 0; i < argv.length; i += 1) {
    const arg = argv[i];

    if (arg.startsWith("--")) {
      const key = arg.slice(2);
      const next = argv[i + 1];

      if (next === undefined || next.startsWith("--")) {
        flags[key] = "1";
      } else {
        flags[key] = next;
        i += 1;
      }
    } else {
      positional.push(arg);
    }
  }

  return { query: positional.join(" ").trim(), flags };
}

function shortTitle(title, max = 42) {
  const clean = (title ?? "").replace(/\s+/g, " ").trim();

  return clean.length > max ? `${clean.slice(0, max - 1)}…` : clean;
}

function printList(label, videos, note = "") {
  console.log(`\n${label}${note ? `  ${note}` : ""}`);

  if (!videos.length) {
    console.log("  (空)");
    return;
  }

  videos.forEach((video, index) => {
    const mark = video.dropped ? "✘" : " ";
    console.log(
      `  ${mark} ${String(index + 1).padStart(2)}. ${video.id}  ${shortTitle(video.title)}`
    );
  });
}

function idsOf(videos) {
  return videos.map((video) => video.id);
}

function diffSummary(a, b, labelA, labelB) {
  const setB = new Set(idsOf(b));
  const onlyInA = idsOf(a).filter((id) => !setB.has(id));

  console.log(
    `  ${labelA} 有 ${a.length} 条，${labelB} 有 ${b.length} 条；` +
      `仅 ${labelA} 出现 ${onlyInA.length} 条` +
      (onlyInA.length ? ` (${onlyInA.slice(0, 5).join(", ")}${onlyInA.length > 5 ? "…" : ""})` : "")
  );
}

async function main() {
  await loadDotEnv();

  const { query, flags } = parseArgs(process.argv.slice(2));

  if (!query) {
    console.error('用法: node scripts/dump-youtube-search.mjs "关键词" [--order date] [--region ES] [--max 20] [--base http://localhost:3000]');
    process.exitCode = 1;
    return;
  }

  const apiKey = process.env.YOUTUBE_API_KEY?.trim();
  if (!apiKey) {
    console.error("缺少 YOUTUBE_API_KEY（放在 .env 或环境变量里）。没有它无法对比第 1 层原始结果。");
    process.exitCode = 1;
    return;
  }

  const maxResults = Math.min(50, Math.max(1, Number.parseInt(flags.max ?? "20", 10) || 20));
  const order = normalizeSearchOrder(flags.order);
  const region = normalizeRegionCode(flags.region) || normalizeRegionCode(process.env.YOUTUBE_REGION_CODE);
  const pageToken = normalizePageToken(flags.page);
  const base = (flags.base ?? "http://localhost:3000").replace(/\/$/, "");

  console.log(`关键词      ${query}`);
  console.log(`参数        maxResults=${maxResults} order=${order} region=${region || "(默认 US)"} page=${pageToken ? "有" : "无"}`);
  console.log("说明        ✘ = 站内会因为 embeddable=false 被丢弃的视频");

  // ---- Layer 1: raw API, deliberately without videoEmbeddable ----
  const apiParams = new URLSearchParams({
    part: "snippet",
    q: query,
    type: "video",
    relevanceLanguage: "es",
    maxResults: String(maxResults),
    key: apiKey
  });

  if (order !== "relevance") apiParams.set("order", order);
  if (region) apiParams.set("regionCode", region);
  if (pageToken) apiParams.set("pageToken", pageToken);

  let rawVideos = [];
  let rawNextPageToken = "";

  try {
    const response = await fetch(
      `https://www.googleapis.com/youtube/v3/search?${apiParams.toString()}`,
      { signal: AbortSignal.timeout(15000) }
    );
    const body = await response.json();

    if (!response.ok) {
      const reason = body?.error?.errors?.[0]?.reason ?? "unknown";
      console.error(`\nYouTube API 返回 ${response.status} (${reason})。`);
      console.error("如果 reason 是 quotaExceeded / dailyLimitExceeded，说明今天的配额已经用完。");
      process.exitCode = 1;
      return;
    }

    rawNextPageToken = body.nextPageToken ?? "";
    rawVideos = (body.items ?? [])
      .filter((item) => item.id?.videoId)
      .map((item) => ({
        id: item.id.videoId,
        title: item.snippet?.title ?? "",
        channelTitle: item.snippet?.channelTitle ?? "",
        dropped: false
      }));
  } catch (error) {
    console.error(`\n直连 YouTube API 失败: ${error.message}`);
    process.exitCode = 1;
    return;
  }

  // ---- Layer 2: which ones the embeddable filter would remove ----
  if (rawVideos.length) {
    try {
      const detailsParams = new URLSearchParams({
        part: "status",
        id: rawVideos.map((video) => video.id).join(","),
        key: apiKey
      });
      const response = await fetch(
        `https://www.googleapis.com/youtube/v3/videos?${detailsParams.toString()}`,
        { signal: AbortSignal.timeout(15000) }
      );
      const body = await response.json();
      const byId = new Map(
        (body.items ?? []).map((item) => [item.id, item.status?.embeddable ?? true])
      );

      for (const video of rawVideos) {
        video.dropped = byId.get(video.id) === false;
      }
    } catch (error) {
      console.log(`\n(embeddable 检查失败: ${error.message})`);
    }
  }

  printList("第 1 层 · YouTube API 原始结果（未加 embeddable 过滤）", rawVideos);
  console.log(`  nextPageToken: ${rawNextPageToken ? "有" : "无"}`);
  console.log(`  其中会被站内过滤掉 ${rawVideos.filter((v) => v.dropped).length} 条`);

  // ---- Layer 3: shared Redis cache ----
  const cacheInput = buildSearchCacheInput({ query, maxResults, order, region, pageToken });
  const cacheKey = `youtube:v2:search:${createHash("sha256").update(cacheInput).digest("hex")}`;
  let cachedVideos = [];

  const redis = new Redis(process.env.REDIS_URL ?? "redis://localhost:6379", {
    lazyConnect: true,
    maxRetriesPerRequest: 1,
    connectTimeout: 1500,
    enableOfflineQueue: false
  });

  try {
    await redis.connect();
    const raw = await redis.get(cacheKey);

    if (raw) {
      const parsed = JSON.parse(raw);
      const data = parsed && typeof parsed.ts === "number" ? parsed.data : parsed;
      cachedVideos = Array.isArray(data) ? data : (data?.videos ?? []);
      const ageHours = parsed?.ts
        ? Math.round(((Date.now() - parsed.ts) / 3_600_000) * 10) / 10
        : null;

      console.log(`\n第 3 层 · Redis 共享缓存  key=${cacheKey.slice(0, 34)}…  年龄=${ageHours === null ? "未知" : `${ageHours} 小时`}`);
      console.log(`  共 ${cachedVideos.length} 条`);
    } else {
      console.log("\n第 3 层 · Redis 共享缓存  (无缓存条目，下次站内搜索会冷启动)");
    }
  } catch (error) {
    console.log(`\n第 3 层 · Redis 不可用 (${error.message}) — 跳过`);
  } finally {
    redis.disconnect();
  }

  // ---- Layer 4: the site's own endpoint ----
  const siteParams = new URLSearchParams({ q: query, maxResults: String(maxResults) });
  if (order !== "relevance") siteParams.set("order", order);
  if (region) siteParams.set("region", region);
  if (pageToken) siteParams.set("page", pageToken);

  let siteVideos = [];

  try {
    const response = await fetch(
      `${base}/api/youtube/search?${siteParams.toString()}`,
      { signal: AbortSignal.timeout(15000) }
    );
    const body = await response.json().catch(() => ({}));

    if (!response.ok) {
      console.log(`\n第 4 层 · 站内接口返回 ${response.status}: ${body.error ?? "unknown"}`);
      console.log("  注意：旧版页面会把任何报错都显示成「没找到相关视频」。");
    } else {
      siteVideos = Array.isArray(body) ? body : (body.videos ?? []);
      const meta = Array.isArray(body) ? null : body.meta;

      printList("第 4 层 · 站内 /api/youtube/search 实际返回", siteVideos);
      console.log(
        `  meta: ${meta ? `stale=${meta.stale} fromCache=${meta.fromCache} fetchedAt=${new Date(meta.fetchedAt).toISOString()}` : "(旧版数组响应)"}`
      );
    }
  } catch (error) {
    console.log(`\n第 4 层 · 站内服务不可用 (${error.message})`);
    console.log("  先跑 npm run dev，或用 --base 指向已部署的站点。");
  }

  // ---- Verdict ----
  console.log("\n判定");
  const embeddableVideos = rawVideos.filter((video) => !video.dropped);
  diffSummary(rawVideos, embeddableVideos, "API 原始", "可嵌入");

  if (siteVideos.length) {
    const siteIds = new Set(idsOf(siteVideos));
    const apiOnly = embeddableVideos.filter((video) => !siteIds.has(video.id));

    if (apiOnly.length === 0 && embeddableVideos.length === siteVideos.length) {
      console.log("  站内结果与 API 原始结果一致 → 差异来自 YouTube 网页与 Data API 的排序模型不同（无个性化信号），不是 bug。");
    } else if (cachedVideos.length && idsOf(cachedVideos).join() === idsOf(siteVideos).join()) {
      console.log("  站内结果 = Redis 缓存，且与 API 原始结果不同 → 缓存陈旧。等缓存过期或用 ?fresh=1（仅本地）刷新。");
    } else {
      console.log(`  站内结果与 API 原始结果有 ${apiOnly.length} 条不一致，且不完全来自缓存 → 检查 videoEmbeddable / videos.list 过滤与配额。`);
    }
  } else {
    console.log("  站内没有返回结果 → 优先检查配额、限流和 .env 配置，而不是怀疑排序。");
  }
  console.log("");
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
