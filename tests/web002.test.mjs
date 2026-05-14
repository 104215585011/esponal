import { readFile } from "node:fs/promises";
import { existsSync } from "node:fs";
import test from "node:test";
import assert from "node:assert/strict";

const readText = (path) => readFile(path, "utf8");

test("WEB-002 channel route exists and uses YouTube playlistItems plus Redis caching", async () => {
  const routePath = "src/app/api/youtube/channel/route.ts";
  assert.ok(existsSync(routePath), `${routePath} should exist`);

  const route = await readText(routePath);
  const youtubeLib = await readText("src/lib/youtube.ts");

  assert.match(route, /export\s+async\s+function\s+GET/);
  assert.match(route, /playlistItems/);
  assert.match(route, /maxResults/);
  assert.match(route, /NextResponse\.json\(videos\)/);
  assert.match(route, /60\s*\*\s*60/);
  assert.match(route, /duration/);
  assert.match(route, /channelTitle/);
  assert.match(youtubeLib, /YOUTUBE_API_KEY/);
  assert.match(youtubeLib, /redis\.get/);
  assert.match(youtubeLib, /redis\.set/);
});

test("WEB-002 search route exists and uses YouTube search with Spanish relevance plus Redis caching", async () => {
  const routePath = "src/app/api/youtube/search/route.ts";
  assert.ok(existsSync(routePath), `${routePath} should exist`);

  const route = await readText(routePath);
  const youtubeLib = await readText("src/lib/youtube.ts");

  assert.match(route, /export\s+async\s+function\s+GET/);
  assert.match(route, /search/);
  assert.match(route, /type["']?\s*:\s*["']video["']/);
  assert.match(route, /relevanceLanguage["']?\s*:\s*["']es["']/);
  assert.match(route, /NextResponse\.json\(videos\)/);
  assert.match(route, /60\s*\*\s*15/);
  assert.match(youtubeLib, /YOUTUBE_API_KEY/);
  assert.match(youtubeLib, /redis\.get/);
  assert.match(youtubeLib, /redis\.set/);
});

test("WEB-002 curated channel list exists with at least three starter channels", async () => {
  const channelsPath = "src/lib/channels.ts";
  assert.ok(existsSync(channelsPath), `${channelsPath} should exist`);

  const channels = await readText(channelsPath);

  assert.match(channels, /Dreaming Spanish/);
  assert.match(channels, /Spanish Okay/);
  assert.match(channels, /Easy Spanish/);
  assert.match(channels, /UCouyFdE9-Lrjo3M_2idKq1A/);
  assert.match(channels, /UCW1FQuVy10_biDAxAj1iTEQ/);
  assert.match(channels, /UCAL4AMMMXKxHDu3FqZV6CbQ/);
});
