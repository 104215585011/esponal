import assert from "node:assert/strict";
import test from "node:test";
import { readFile } from "node:fs/promises";

const readText = (path) => readFile(path, "utf8");

test("WEB-019 watch related videos use channel uploads instead of search", async () => {
  const page = await readText("src/app/watch/page.tsx");

  assert.match(page, /channelId\?: string/);
  assert.match(page, /part:\s*"snippet"/);
  assert.match(page, /fetchYouTubeJson<VideoListResponse>\("videos"/);
  assert.match(page, /fetchRelatedVideos\(videoInfo\.channelId,\s*videoInfo\.channelTitle,\s*videoId\)/);
  assert.match(page, /\/api\/youtube\/channel\?id=\$\{encodeURIComponent\(channelId\)\}&maxResults=12/);
  assert.match(page, /fetchSearchFallbackVideos\(channelTitle,\s*currentVideoId\)/);

  const relatedFunction = page.match(/async function fetchRelatedVideos[\s\S]*?\n}\n\nasync function fetchSearchFallbackVideos/)?.[0] ?? "";
  assert.doesNotMatch(relatedFunction, /\/api\/youtube\/search/);
});

test("WEB-019 user search page remains the only normal YouTube search consumer", async () => {
  const watchPage = await readText("src/app/watch/page.tsx");
  const searchPage = await readText("src/app/search/page.tsx");
  const searchRoute = await readText("src/app/api/youtube/search/route.ts");

  assert.match(watchPage, /fetchSearchFallbackVideos/);
  assert.match(watchPage, /\/api\/youtube\/search\?q=\$\{encodeURIComponent\(query\)\}&maxResults=8/);
  assert.match(searchPage, /\/api\/youtube\/search\?q=\$\{encodeURIComponent\(query\)\}&maxResults=20/);
  assert.match(searchRoute, /search\.list costs 100 quota units/);
  assert.match(searchRoute, /SEARCH_CACHE_TTL_SECONDS = 60 \* 60 \* 24/);
});

test("WEB-019 YouTube cache comments warn against broad cache clearing and key bumps", async () => {
  const youtubeLib = await readText("src/lib/youtube.ts");

  assert.match(youtubeLib, /do not routinely clear youtube:\*/);
  assert.match(youtubeLib, /Do not bump YouTube cache namespaces casually/);
});
