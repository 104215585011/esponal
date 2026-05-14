import { readFile } from "node:fs/promises";
import { existsSync } from "node:fs";
import test from "node:test";
import assert from "node:assert/strict";

const readText = (path) => readFile(path, "utf8");

test("WEB-006 subtitle panel calls highlight route and defines reviewed colors", async () => {
  const panelPath = "src/app/watch/SubtitlePanel.tsx";
  assert.ok(existsSync(panelPath), `${panelPath} should exist`);

  const panel = await readText(panelPath);

  assert.match(panel, /\/api\/vocab\/highlight/);
  assert.match(panel, /#86EFAC/);
  assert.match(panel, /#93C5FD/);
  assert.match(panel, /response\.status === 401/);
});
