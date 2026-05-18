import { chromium } from "@playwright/test";
import { mkdir, readFile, writeFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { curatedChannels } from "../src/lib/channels.ts";

const repoRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const USER_DATA_DIR = path.resolve(repoRoot, ".cache/harvest-chrome-profile");
const EXTENSION_PATH = path.resolve(repoRoot, "extension/dist");
const FAILURE_LOG = path.resolve(repoRoot, ".cache/harvest-failures.log");
const DEFAULT_RECENT = 20;
const DEFAULT_DELAY_MS = 3000;
const DEFAULT_APP_ORIGIN = "http://localhost:3000";

function parseArgs(argv) {
  const args = {};

  for (const arg of argv) {
    if (!arg.startsWith("--")) continue;

    const [key, ...valueParts] = arg.slice(2).split("=");
    args[key] = valueParts.length > 0 ? valueParts.join("=") : "true";
  }

  return args;
}

function parsePositiveInt(value, fallback) {
  const parsed = Number.parseInt(value ?? "", 10);
  return Number.isFinite(parsed) && parsed > 0 ? parsed : fallback;
}

function normalizeVideoIds(values) {
  return Array.from(
    new Set(
      values
        .map((value) => value.trim())
        .filter((value) => /^[\w-]{6,32}$/.test(value))
    )
  );
}

async function readVideoIdsFromFile(filePath) {
  const contents = await readFile(path.resolve(repoRoot, filePath), "utf8");
  return normalizeVideoIds(contents.split(/\r?\n/));
}

async function fetchChannelVideoIds(channelId, recent, appOrigin) {
  const url = new URL("/api/youtube/channel", appOrigin);
  url.searchParams.set("id", channelId);
  url.searchParams.set("maxResults", String(recent));

  const response = await fetch(url);

  if (!response.ok) {
    throw new Error(`Channel fetch failed for ${channelId}: ${response.status}`);
  }

  const videos = await response.json();

  if (!Array.isArray(videos)) {
    return [];
  }

  return normalizeVideoIds(
    videos.map((video) => (typeof video?.id === "string" ? video.id : ""))
  );
}

async function resolveVideoList(args) {
  const recent = parsePositiveInt(args.recent, DEFAULT_RECENT);
  const appOrigin = args["app-origin"] || process.env.ESPONAL_APP_ORIGIN || DEFAULT_APP_ORIGIN;
  const videoIds = [];

  if (args.videos) {
    videoIds.push(...normalizeVideoIds(args.videos.split(",")));
  }

  if (args["videos-from-file"]) {
    videoIds.push(...(await readVideoIdsFromFile(args["videos-from-file"])));
  }

  if (args.channels === "all") {
    for (const channel of curatedChannels) {
      videoIds.push(...(await fetchChannelVideoIds(channel.id, recent, appOrigin)));
    }
  }

  if (args.channel) {
    videoIds.push(...(await fetchChannelVideoIds(args.channel, recent, appOrigin)));
  }

  return normalizeVideoIds(videoIds);
}

async function ensureYouTubeLogin(page) {
  await page.goto("https://www.youtube.com/", {
    waitUntil: "domcontentloaded",
    timeout: 60_000
  });

  const accountMenu = "button[aria-label*='Account menu'], button[aria-label*='Account']";
  const loggedIn = await page.locator(accountMenu).first().isVisible({ timeout: 5000 }).catch(() => false);

  if (loggedIn) {
    return;
  }

  console.log("Please log into YouTube manually in the opened browser window.");
  console.log("The script will wait here and reuse this profile next time.");
  await page.waitForSelector(accountMenu, { timeout: 0 });
  console.log("Logged in. Session saved to .cache/harvest-chrome-profile.");
}

async function writeFailures(videoIds) {
  if (videoIds.length === 0) {
    await writeFile(FAILURE_LOG, "", "utf8").catch(() => {});
    return;
  }

  await mkdir(path.dirname(FAILURE_LOG), { recursive: true });
  await writeFile(FAILURE_LOG, `${videoIds.join("\n")}\n`, "utf8");
}

async function main() {
  const args = parseArgs(process.argv.slice(2));
  const delayMs = parsePositiveInt(args["delay-ms"], DEFAULT_DELAY_MS);
  const videoIds = await resolveVideoList(args);

  if (videoIds.length === 0) {
    console.error(
      "No videos resolved. Use --channels=all, --channel=CHANNEL_ID, --videos=a,b, or --videos-from-file=path."
    );
    process.exitCode = 1;
    return;
  }

  const browser = await chromium.launchPersistentContext(USER_DATA_DIR, {
    headless: false,
    args: [
      `--disable-extensions-except=${EXTENSION_PATH}`,
      `--load-extension=${EXTENSION_PATH}`
    ]
  });

  const failed = [];
  const page = await browser.newPage();

  try {
    await ensureYouTubeLogin(page);
    console.log(`Harvesting ${videoIds.length} videos...`);

    for (const [index, videoId] of videoIds.entries()) {
      const label = `[${index + 1}/${videoIds.length}] ${videoId}`;

      try {
        await page.goto(`https://www.youtube.com/watch?v=${videoId}`, {
          waitUntil: "domcontentloaded",
          timeout: 30_000
        });
        await page.waitForTimeout(delayMs);
        console.log(`${label} ok`);
      } catch (error) {
        failed.push(videoId);
        console.log(`${label} failed: ${error instanceof Error ? error.message : String(error)}`);
      }
    }

    await page.waitForTimeout(5000);
  } finally {
    await browser.close();
  }

  await writeFailures(failed);
  console.log(`Done. Success: ${videoIds.length - failed.length}. Failed: ${failed.length}.`);
  console.log('Verify with: redis-cli -u "$REDIS_URL" --scan --pattern "subtitle:*" | head -n 10');

  if (failed.length > 0) {
    console.log(`Failed video ids written to ${path.relative(repoRoot, FAILURE_LOG)}.`);
  }
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
