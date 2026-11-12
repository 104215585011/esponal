import assert from "node:assert/strict";
import { existsSync } from "node:fs";
import { readFile } from "node:fs/promises";
import test from "node:test";

const readText = (path) => readFile(path, "utf8");

test("search errors are classified instead of collapsing into 'no results'", async () => {
  const lib = await readText("src/lib/youtube.ts");
  const route = await readText("src/app/api/youtube/search/route.ts");
  const page = await readText("src/app/search/page.tsx");

  assert.match(lib, /export class YouTubeApiError/);
  assert.match(lib, /quotaExceeded/);
  assert.match(lib, /dailyLimitExceeded/);
  assert.match(lib, /isQuotaExceededError/);
  assert.match(lib, /getCachedJsonWithMeta/);
  assert.match(lib, /YOUTUBE_STALE_MAX_AGE_SECONDS/);

  assert.match(route, /isQuotaExceededError\(error\)/);
  assert.match(route, /error:\s*"quota_exceeded"/);
  assert.match(route, /error:\s*"rate_limited"/);

  assert.match(page, /今日搜索配额已用完/);
  assert.match(page, /搜索服务暂时不可用/);
  assert.match(page, /搜索太频繁了/);
  assert.match(page, /不是没有匹配结果/);
});

test("stale fallback is bounded and visible to the user", async () => {
  const lib = await readText("src/lib/youtube.ts");
  const page = await readText("src/app/search/page.tsx");

  assert.match(lib, /Date\.now\(\) - staleFetchedAt <= getMaxStaleAgeSeconds\(\) \* 1000/);
  assert.match(page, /meta\?\.stale/);
  assert.match(page, /上游调用失败，当前为缓存的旧结果/);
  assert.match(page, /结果更新于/);
});

test("embeddable filtering happens in the API and keeps the local safety net", async () => {
  const route = await readText("src/app/api/youtube/search/route.ts");

  assert.match(route, /videoEmbeddable:\s*"true"/);
  assert.match(route, /part:\s*"contentDetails,status"/);
  assert.match(route, /embeddableById\.get\(videoId\)\s*===\s*false/);
  assert.match(route, /never trust an item without a real videoId/);
});

test("legacy bare-array cache entries are still readable", async () => {
  const route = await readText("src/app/api/youtube/search/route.ts");

  assert.match(route, /function coerceSearchPayload/);
  assert.match(route, /Array\.isArray\(data\)/);
  assert.match(route, /buildSearchCacheInput\(/);
});

test("force-refresh cannot burn production quota", async () => {
  const route = await readText("src/app/api/youtube/search/route.ts");
  const page = await readText("src/app/search/page.tsx");

  assert.match(route, /process\.env\.NODE_ENV !== "production"/);
  assert.match(route, /\{ forceFresh \}/);
  assert.match(page, /canRefresh/);
  assert.match(page, /跳过缓存刷新（仅本地可用）/);
});

test("paging and ordering reach both the API and the UI", async () => {
  const route = await readText("src/app/api/youtube/search/route.ts");
  const page = await readText("src/app/search/page.tsx");

  assert.match(route, /nextPageToken/);
  assert.match(route, /prevPageToken/);
  assert.match(route, /params\.pageToken = options\.pageToken/);
  assert.match(route, /params\.regionCode = options\.region/);
  assert.match(page, /下一页/);
  assert.match(page, /上一页/);
  assert.match(page, /返回第一页/);
  assert.match(page, /播放量/);
});

test("diagnostic script and tunable env vars ship with the change", async () => {
  assert.ok(existsSync("scripts/dump-youtube-search.mjs"));

  const script = await readText("scripts/dump-youtube-search.mjs");
  const env = await readText(".env.example");
  const pkg = await readText("package.json");

  assert.match(script, /第 1 层/);
  assert.match(script, /第 3 层/);
  assert.match(script, /第 4 层/);
  assert.match(script, /quotaExceeded/);
  assert.match(env, /YOUTUBE_REGION_CODE/);
  assert.match(env, /YOUTUBE_SEARCH_CACHE_TTL_SECONDS/);
  assert.match(env, /YOUTUBE_STALE_MAX_AGE_SECONDS/);
  assert.match(pkg, /"search:dump"/);
});
