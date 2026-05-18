import assert from "node:assert/strict";
import { existsSync } from "node:fs";
import { readFile } from "node:fs/promises";
import test from "node:test";

const readText = (path) => readFile(path, "utf8");
const readJson = async (path) => JSON.parse(await readText(path));
const removedTokenName = ["EXT", "INGEST", "TOKEN"].join("_");
const removedTokenHeader = ["X", "Esponal", "Ingest", "Token"].join("-");

test("EXT-006 parses YouTube json3 subtitle events into clean cues", async () => {
  const parserPath = "extension/parseJson3.js";
  assert.ok(existsSync(parserPath), `${parserPath} should exist`);

  const { parseJson3ToCues } = await import(`../${parserPath}`);
  const cues = parseJson3ToCues({
    events: [
      {
        tStartMs: 1240,
        dDurationMs: 2800,
        segs: [{ utf8: "Hola &amp; " }, { utf8: "bienvenidos" }]
      },
      { tStartMs: 5000, dDurationMs: 0, segs: [{ utf8: "skip" }] },
      { tStartMs: 6200, dDurationMs: 1400, segs: [{ utf8: "&#39;vamos&#39;" }] },
      { tStartMs: 8000, dDurationMs: 1000, segs: [] }
    ]
  });

  assert.deepEqual(cues, [
    { start: 1.24, dur: 2.8, text: "Hola & bienvenidos" },
    { start: 6.2, dur: 1.4, text: "'vamos'" }
  ]);
});

test("EXT-006 harvest script bridges ytInitialPlayerResponse and posts Spanish cues", async () => {
  const harvestPath = "extension/harvest.js";
  assert.ok(existsSync(harvestPath), `${harvestPath} should exist`);

  const harvest = await readText(harvestPath);

  assert.match(harvest, /ytInitialPlayerResponse[\s\S]*playerCaptionsTracklistRenderer[\s\S]*captionTracks/);
  assert.match(harvest, /window\.postMessage/);
  assert.match(harvest, /languageCode[\s\S]*startsWith\("es"\)/);
  assert.match(harvest, /credentials:\s*"include"/);
  assert.match(harvest, /parseJson3ToCues/);
  assert.match(harvest, /\/api\/subtitle\/ingest/);
  assert.doesNotMatch(harvest, new RegExp(removedTokenHeader));
  assert.doesNotMatch(harvest, new RegExp(removedTokenName));
  assert.match(harvest, /chrome\.storage\.local\.set[\s\S]*lastSubtitleHarvest/);
});

test("EXT-006 manifest and build include the harvester", async () => {
  const manifest = await readJson("extension/manifest.json");
  const packageJson = await readJson("extension/package.json");
  const packageScript = await readText("extension/scripts/package.mjs");

  const harvestScript = manifest.content_scripts.find((script) =>
    script.js.some((entry) => entry.includes("harvest"))
  );

  assert.ok(harvestScript, "manifest should register a harvest content script");
  assert.deepEqual(harvestScript.matches, ["https://www.youtube.com/watch*"]);
  assert.equal(harvestScript.run_at, "document_idle");
  assert.ok(harvestScript.js.some((entry) => entry.includes("harvest.js")));
  assert.match(packageJson.scripts.build, /scripts\/build\.mjs/);
  assert.match(packageScript, /dist\/harvest\.js/);
});

test("EXT-006 ingest route enforces limits, write-once, and 30 day TTL", async () => {
  const routePath = "src/app/api/subtitle/ingest/route.ts";
  assert.ok(existsSync(routePath), `${routePath} should exist`);

  const route = await readText(routePath);

  assert.doesNotMatch(route, new RegExp(removedTokenName));
  assert.doesNotMatch(route, /x-esponal-ingest-token/i);
  assert.doesNotMatch(route, /status:\s*401/);
  assert.match(route, /ingestLimiter/);
  assert.match(route, /MAX_PAYLOAD_BYTES\s*=\s*500_000/);
  assert.match(route, /MAX_CUES\s*=\s*5000/);
  assert.match(route, /MIN_CUES\s*=\s*5/);
  assert.match(route, /status:\s*413/);
  assert.match(route, /status:\s*400/);
  assert.match(route, /subtitle:\$\{body\.videoId\}:\$\{body\.lang\}/);
  assert.match(route, /redis\.get/);
  assert.match(route, /status:\s*"exists"/);
  assert.match(route, /SUBTITLE_CACHE_TTL\s*=\s*86400 \* 30/);
  assert.match(route, /redis\.set[\s\S]*"EX"[\s\S]*SUBTITLE_CACHE_TTL/);
});

test("EXT-006 environment, popup, and rate limiter are wired", async () => {
  const envExample = await readText(".env.example");
  const popupHtml = await readText("extension/popup.html");
  const popupJs = await readText("extension/popup.js");
  const ratelimit = await readText("src/lib/ratelimit.ts");

  assert.doesNotMatch(envExample, new RegExp(removedTokenName));
  assert.match(envExample, /ESPONAL_APP_ORIGIN/);
  assert.match(popupHtml, /lastHarvest/);
  assert.match(popupJs, /lastSubtitleHarvest/);
  assert.match(popupJs, /videoId/);
  assert.match(ratelimit, /export const ingestLimiter\b/);
  assert.match(ratelimit, /createLimiter\(30,\s*"rl:ingest"\)/);
});
