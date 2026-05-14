import { readFile } from "node:fs/promises";
import { existsSync } from "node:fs";
import test from "node:test";
import assert from "node:assert/strict";

const readText = (path) => readFile(path, "utf8");

test("WEB-004 subtitle route exists and fetches YouTube timedtext", async () => {
  const routePath = "src/app/api/subtitle/route.ts";
  assert.ok(existsSync(routePath), `${routePath} should exist`);

  const route = await readText(routePath);

  assert.match(route, /export\s+async\s+function\s+GET/);
  assert.match(route, /timedtext/);
  assert.match(route, /type=list/);
  assert.match(route, /User-Agent/);
  assert.match(route, /listXml\.slice\(0,\s*300\)/);
  assert.match(route, /lang_code/);
  assert.match(route, /name/);
  assert.match(route, /encodeURIComponent\(track\.name\)/);
  assert.match(route, /startsWith\(["']\{["']\)/);
  assert.match(route, /fmt=json3/);
  assert.match(route, /es-419/);
  assert.match(route, /es-MX/);
  assert.match(route, /24\s*\*\s*60\s*\*\s*60/);
});

test("WEB-004 subtitle panel exists and contains player sync plus translate hooks", async () => {
  const panelPath = "src/app/watch/SubtitlePanel.tsx";
  assert.ok(existsSync(panelPath), `${panelPath} should exist`);

  const panel = await readText(panelPath);

  assert.match(panel, /getCurrentTime/);
  assert.match(panel, /setInterval/);
  assert.match(panel, /\/api\/translate/);
  assert.match(panel, /text-white\/75/);
});
