import assert from "node:assert/strict";
import fs from "node:fs";
import test from "node:test";

function read(path) {
  return fs.readFileSync(path, "utf8");
}

test("OPS-002 exports shared rate limit helpers and five route limiters", () => {
  const source = read("src/lib/ratelimit.ts");
  const packageJson = JSON.parse(read("package.json"));

  assert.ok(packageJson.dependencies["@upstash/ratelimit"]);
  assert.match(source, /export const translateLimiter\b/);
  assert.match(source, /export const lookupLimiter\b/);
  assert.match(source, /export const addLimiter\b/);
  assert.match(source, /export const searchLimiter\b/);
  assert.match(source, /export const channelLimiter\b/);
  assert.match(source, /export function getClientIp\b/);
  assert.match(source, /export async function checkRateLimit\b/);
  assert.match(source, /catch\s*(?:\([^)]*\))?\s*{[\s\S]*allowed:\s*true/);
});

test("OPS-002 getClientIp prefers forwarded headers and falls back to unknown", async () => {
  const { getClientIp } = await import("../src/lib/ratelimit.ts");

  assert.equal(
    getClientIp(new Request("https://example.com", {
      headers: { "x-forwarded-for": "203.0.113.8, 10.0.0.2" }
    })),
    "203.0.113.8"
  );
  assert.equal(
    getClientIp(new Request("https://example.com", {
      headers: { "x-real-ip": "198.51.100.4" }
    })),
    "198.51.100.4"
  );
  assert.equal(getClientIp(new Request("https://example.com")), "unknown");
});

test("OPS-002 checkRateLimit blocks if either IP or user dimension exceeds quota", async () => {
  const { checkRateLimit } = await import("../src/lib/ratelimit.ts");
  const request = new Request("https://example.com", {
    headers: { "x-forwarded-for": "203.0.113.8" }
  });
  const calls = [];
  const limiter = {
    async limit(key) {
      calls.push(key);
      return key === "user:user-1"
        ? { success: false, reset: 1_800_000_000_000 }
        : { success: true, reset: 0 };
    }
  };

  const result = await checkRateLimit(limiter, request, "user-1");

  assert.deepEqual(calls, ["ip:203.0.113.8", "user:user-1"]);
  assert.equal(result.allowed, false);
  assert.equal(result.reset, 1_800_000_000_000);
});

test("OPS-002 checkRateLimit fails open when the limiter is unavailable", async () => {
  const { checkRateLimit } = await import("../src/lib/ratelimit.ts");
  const limiter = {
    async limit() {
      throw new Error("redis unavailable");
    }
  };

  const result = await checkRateLimit(limiter, new Request("https://example.com"), null);

  assert.equal(result.allowed, true);
});

test("OPS-002 protected routes call checkRateLimit and return 429 with Retry-After", () => {
  const routes = [
    ["src/app/api/translate/route.ts", "translateLimiter"],
    ["src/app/api/vocab/lookup/route.ts", "lookupLimiter"],
    ["src/app/api/vocab/add/route.ts", "addLimiter"],
    ["src/app/api/youtube/search/route.ts", "searchLimiter"],
    ["src/app/api/youtube/channel/route.ts", "channelLimiter"]
  ];

  for (const [path, limiter] of routes) {
    const source = read(path);
    assert.match(source, new RegExp(`checkRateLimit[\\s\\S]*${limiter}|${limiter}[\\s\\S]*checkRateLimit`), path);
    assert.match(source, /status:\s*429/, path);
    assert.match(source, /Retry-After/, path);
  }
});

test("OPS-002 frontend handles 429 without treating it as a normal failure", () => {
  const transcriptPanel = read("src/app/watch/TranscriptPanel.tsx");
  const lookupCard = read("src/app/watch/LookupCard.tsx");

  assert.match(transcriptPanel, /response\.status\s*===\s*429/);
  assert.match(transcriptPanel, /Retry-After/);
  assert.match(lookupCard, /response\.status\s*===\s*429/);
  assert.match(lookupCard, /查询过于频繁|鏌ヨ杩囦簬棰戠箒/);
});
