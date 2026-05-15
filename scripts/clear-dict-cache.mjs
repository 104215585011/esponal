/**
 * Clears all lemma dictionary cache entries from Redis.
 * Run with: node scripts/clear-dict-cache.mjs
 */

import { readFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const root = path.join(__dirname, "..");

async function loadEnv() {
  const envText = await readFile(path.join(root, ".env"), "utf8");
  const env = {};
  for (const line of envText.split("\n")) {
    const m = line.match(/^([A-Z_]+)\s*=\s*"?([^"]+)"?/);
    if (m) env[m[1]] = m[2].trim();
  }
  return env;
}

async function main() {
  const env = await loadEnv();
  const redisUrl = env.REDIS_URL;
  if (!redisUrl) {
    console.error("❌ REDIS_URL not found in .env");
    process.exit(1);
  }

  // Use Upstash REST API to scan and delete keys
  const baseUrl = redisUrl.replace("rediss://", "https://").replace(/^https:\/\/[^@]+@/, "https://");
  const [, credentials] = redisUrl.match(/rediss:\/\/([^@]+)@/) ?? [];
  const [, password] = (credentials ?? "").split(":");
  const host = redisUrl.replace(/rediss:\/\/[^@]+@/, "").replace(/:6379$/, "");
  const upstashUrl = `https://${host}`;

  const headers = {
    Authorization: `Bearer ${password}`,
    "Content-Type": "application/json",
  };

  // SCAN for lemma:dict:* keys
  let cursor = 0;
  let deleted = 0;

  console.log("🔍 扫描 lemma:dict:* 缓存...");

  do {
    const res = await fetch(`${upstashUrl}/scan/${cursor}?match=lemma:dict:*&count=100`, {
      headers,
    });
    const data = await res.json();
    const [nextCursor, keys] = data.result;
    cursor = parseInt(nextCursor, 10);

    if (keys.length > 0) {
      // Delete in batch
      const delRes = await fetch(`${upstashUrl}/del/${keys.join("/")}`, { headers });
      const delData = await delRes.json();
      deleted += delData.result ?? 0;
      console.log(`  🗑  删除 ${keys.length} 个 key: ${keys.slice(0, 3).join(", ")}${keys.length > 3 ? "..." : ""}`);
    }
  } while (cursor !== 0);

  // Also clear the Baidu access token so it refreshes
  const tokenRes = await fetch(`${upstashUrl}/del/baidu:mt:access_token`, { headers });
  await tokenRes.json();

  console.log(`\n✅ 完成，共删除 ${deleted} 个词典缓存条目`);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
