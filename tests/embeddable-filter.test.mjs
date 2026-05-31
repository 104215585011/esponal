import { readFile } from "node:fs/promises";
import { existsSync } from "node:fs";
import test from "node:test";
import assert from "node:assert/strict";

const readText = (path) => readFile(path, "utf8");

test("Embeddable video filter in channel route", async () => {
  const routePath = "src/app/api/youtube/channel/route.ts";
  assert.ok(existsSync(routePath), `${routePath} should exist`);

  const code = await readText(routePath);

  // Asserting key elements from embeddable filter implementation
  assert.match(code, /part:\s*["']contentDetails,status["']/);
  assert.match(code, /status\?:/);
  assert.match(code, /embeddable\?:/);
  assert.match(code, /embeddableById\.get\(videoId\)\s*===\s*false/);
});

test("Embeddable video filter in search route", async () => {
  const routePath = "src/app/api/youtube/search/route.ts";
  assert.ok(existsSync(routePath), `${routePath} should exist`);

  const code = await readText(routePath);

  // Asserting key elements from embeddable filter implementation
  assert.match(code, /part:\s*["']contentDetails,status["']/);
  assert.match(code, /status\?:/);
  assert.match(code, /embeddable\?:/);
  assert.match(code, /embeddableById\.get\(videoId\)\s*===\s*false/);
});
