import { readFile } from "node:fs/promises";
import { existsSync } from "node:fs";
import test from "node:test";
import assert from "node:assert/strict";

const readText = (path) => readFile(path, "utf8");

test("EXT-004 highlight route exists and returns reviewed status categories", async () => {
  const routePath = "src/app/api/vocab/highlight/route.ts";
  assert.ok(existsSync(routePath), `${routePath} should exist`);

  const route = await readText(routePath);

  assert.match(route, /export\s+async\s+function\s+POST/);
  assert.match(route, /course|saved|unknown/);
  assert.match(route, /phase1-words\.json/);
  assert.match(route, /getServerSession\(getAuthOptions\(\)\)/);
  assert.match(route, /NextResponse\.json/);
});

test("EXT-004 content script includes reviewed highlight colors and status wiring", async () => {
  const content = await readText("extension/content.js");

  assert.match(content, /api\/vocab\/highlight/);
  assert.match(content, /#86EFAC/);
  assert.match(content, /#93C5FD/);
  assert.match(content, /data-status/);
});
