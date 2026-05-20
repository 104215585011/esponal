import { readFile } from "node:fs/promises";
import { existsSync } from "node:fs";
import test from "node:test";
import assert from "node:assert/strict";

const readText = (path) => readFile(path, "utf8");

test("EXT-008 extension harvests YouTube json3 subtitles through the page bridge", async () => {
  const harvestPath = "extension/harvest.js";
  const parserPath = "extension/parseJson3.js";
  const backgroundPath = "extension/background.js";

  assert.ok(existsSync(harvestPath), `${harvestPath} should exist`);
  assert.ok(existsSync(parserPath), `${parserPath} should exist`);
  assert.ok(existsSync(backgroundPath), `${backgroundPath} should exist`);

  const harvest = await readText(harvestPath);
  const background = await readText(backgroundPath);
  const parser = await import(`../${parserPath}`);

  // Content script must NOT inject inline <script> tags — YouTube's CSP +
  // Trusted Types block that. It should ask the service worker to read the
  // player response via chrome.scripting.executeScript in the MAIN world.
  assert.doesNotMatch(harvest, /createElement\(\s*["']script["']\s*\)/);
  assert.doesNotMatch(harvest, /script\.textContent/);
  assert.match(harvest, /chrome\.runtime\.sendMessage/);
  assert.match(harvest, /esponal-get-player-tracks/);
  assert.match(harvest, /fmt=json3/);
  assert.match(harvest, /credentials:\s*["']include["']/);
  assert.match(harvest, /\/api\/subtitle\/ingest/);
  assert.match(harvest, /chrome\.storage\.local\.set/);
  assert.match(harvest, /document\.title\.replace\(\s*\/ - YouTube\$\/,\s*["']["']\s*\)/);
  assert.match(harvest, /durationSec/);
  assert.doesNotMatch(harvest, /cueCount/);

  // Service worker owns reading window.ytInitialPlayerResponse via the
  // scripting API with world: "MAIN".
  assert.match(background, /esponal-get-player-tracks/);
  assert.match(background, /chrome\.scripting\s*\.\s*executeScript/);
  assert.match(background, /world:\s*["']MAIN["']/);
  assert.match(background, /ytInitialPlayerResponse/);

  assert.equal(typeof parser.parseJson3ToCues, "function");
  const cues = parser.parseJson3ToCues({
    events: [
      { tStartMs: 1200, dDurationMs: 800, segs: [{ utf8: "Hola " }, { utf8: "mundo" }] },
      { tStartMs: 2500, dDurationMs: 500, segs: [{ utf8: "&lt;gracias&gt;" }] }
    ]
  });

  assert.deepEqual(cues, [
    { start: 1.2, dur: 0.8, text: "Hola mundo" },
    { start: 2.5, dur: 0.5, text: "<gracias>" }
  ]);
});

test("EXT-008 manifest and build package the harvester without page UI feedback", async () => {
  const manifest = JSON.parse(await readText("extension/manifest.json"));
  const build = await readText("extension/scripts/build.mjs");
  const packageScript = await readText("extension/scripts/package.mjs");
  const background = await readText("extension/background.js");

  assert.ok(
    manifest.content_scripts.some(
      (script) =>
        script.matches?.includes("https://www.youtube.com/watch*") &&
        script.js?.includes("dist/harvest.js")
    )
  );
  assert.ok(
    manifest.content_scripts.some(
      (script) =>
        script.matches?.includes("http://localhost:3000/*") &&
        script.matches?.includes("https://*.vercel.app/*") &&
        script.js?.some((file) => /esponal/i.test(file))
    )
  );
  assert.ok(manifest.host_permissions.includes("https://*.vercel.app/*"));
  assert.match(JSON.stringify(manifest), /data-esponal-ext|esponal-site/);

  assert.match(build, /esbuild/);
  assert.match(build, /EXT_INGEST_TOKEN/);
  assert.match(build, /ESPONAL_APP_ORIGIN/);
  assert.match(build, /harvest\.js/);
  assert.match(build, /parseJson3\.js/);

  assert.match(packageScript, /dist\/harvest\.js/);
  assert.match(packageScript, /dist\/esponal-site\.js/);
  assert.match(background, /chrome\.action\.setBadgeText\(\{\s*text:\s*["']✓["']/);
  assert.match(background, /setTimeout\(\(\)\s*=>\s*chrome\.action\.setBadgeText\(\{\s*text:\s*["']["']/);
});

test("EXT-008 popup shows compact recent harvest without implementation IDs", async () => {
  const html = await readText("extension/popup.html");
  const popup = await readText("extension/popup.js");

  assert.match(html, /recent-harvest/);
  assert.match(popup, /lastSubtitleHarvest/);
  assert.match(popup, /Intl\.RelativeTimeFormat\(["']zh-CN["']/);
  assert.match(popup, /Math\.round\(durationSec\s*\/\s*60\)/);
  assert.match(popup, /不到 1 分钟字幕/);
  assert.doesNotMatch(popup, /videoId/);
  assert.doesNotMatch(popup, /cueCount/);
  assert.doesNotMatch(popup, /\blang\b/);
});

test("EXT-008 server ingest route validates token, limits, payload, and preserves existing subtitles", async () => {
  const routePath = "src/app/api/subtitle/ingest/route.ts";
  assert.ok(existsSync(routePath), `${routePath} should exist`);

  const route = await readText(routePath);
  const ratelimit = await readText("src/lib/ratelimit.ts");

  assert.match(route, /X-Esponal-Ingest-Token|x-esponal-ingest-token/);
  assert.match(route, /process\.env\.EXT_INGEST_TOKEN/);
  assert.match(route, /ingestLimiter/);
  assert.match(route, /MAX_PAYLOAD_BYTES\s*=\s*500_000/);
  assert.match(route, /MAX_CUES\s*=\s*5000/);
  assert.match(route, /MIN_CUES\s*=\s*5/);
  assert.match(route, /subtitle:v4:\$\{.*videoId.*\}:\$\{.*lang.*\}:auto/);
  assert.match(route, /redis\.get/);
  assert.match(route, /written:\s*false/);
  assert.match(route, /written:\s*true/);
  assert.match(route, /cueCount/);
  assert.match(ratelimit, /ingestLimiter/);
});

test("EXT-008 subtitle API returns a no_subtitle hint when fallback sources are empty", async () => {
  const route = await readText("src/app/api/subtitle/route.ts");

  assert.match(route, /hint/);
  assert.match(route, /no_subtitle/);
  assert.match(route, /cues/);
  assert.match(route, /subtitle:v4:/);
});

test("EXT-008 EmptyState supports external and secondary actions", async () => {
  const emptyState = await readText("src/app/components/ui/EmptyState.tsx");

  assert.match(emptyState, /external\?:\s*boolean/);
  assert.match(emptyState, /secondaryAction\?:/);
  assert.match(emptyState, /target=.*_blank/);
  assert.match(emptyState, /noopener noreferrer/);
});

test("EXT-008 TranscriptPanel guides users differently depending on extension install state", async () => {
  const panel = await readText("src/app/watch/TranscriptPanel.tsx");

  assert.match(panel, /dataset\.esponalExt/);
  assert.match(panel, /这个视频暂时没有高质量字幕/);
  assert.match(panel, /扩展会自动采集回来/);
  assert.match(panel, /装上 Esponal 扩展后/);
  assert.match(panel, /在 YouTube 打开/);
  assert.match(panel, /安装扩展/);
  assert.match(panel, /先去 YouTube 看/);
});

test("EXT-008 env example documents ingest configuration", async () => {
  const envExample = await readText(".env.example");

  assert.match(envExample, /EXT_INGEST_TOKEN=/);
  assert.match(envExample, /ESPONAL_APP_ORIGIN=/);
});
