import { readFile } from "node:fs/promises";
import { existsSync } from "node:fs";
import test from "node:test";
import assert from "node:assert/strict";

const readText = (path) => readFile(path, "utf8");

test("WEB-004 subtitle route exists and fetches YouTube timedtext", async () => {
  const routePath = "src/app/api/subtitle/route.ts";
  assert.ok(existsSync(routePath), `${routePath} should exist`);

  const route = await readText(routePath);
  const pkg = JSON.parse(await readText("package.json"));

  assert.match(route, /export\s+async\s+function\s+GET/);
  assert.match(route, /YoutubeTranscript/);
  assert.match(route, /fetchTranscript/);
  assert.match(route, /offset\s*\/\s*1000/);
  assert.match(route, /duration\s*\/\s*1000/);
  assert.match(route, /\[subtitle\] fetched/);
  assert.match(route, /\[subtitle\] youtube-transcript failed/);
  assert.match(route, /24\s*\*\s*60\s*\*\s*60/);
  assert.ok(pkg.dependencies["youtube-transcript"]);
});

test("WEB-004 subtitle panel exists and contains player sync plus translate hooks", async () => {
  const panelPath = "src/app/watch/SubtitlePanel.tsx";
  assert.ok(existsSync(panelPath), `${panelPath} should exist`);

  const panel = await readText(panelPath);

  assert.match(panel, /getCurrentTime/);
  assert.match(panel, /setInterval/);
  assert.match(panel, /\/api\/translate/);
  assert.match(panel, /origin:\s*window\.location\.origin/);
  assert.doesNotMatch(panel, /vercel\.app/);
  assert.match(panel, /text-white\/75/);
});
