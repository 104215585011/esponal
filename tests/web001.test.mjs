import { readFile } from "node:fs/promises";
import { existsSync } from "node:fs";
import test from "node:test";
import assert from "node:assert/strict";

const readText = (path) => readFile(path, "utf8");

test("WEB-001 homepage is rewritten away from the INFRA placeholder and reads channel data", async () => {
  const pagePath = "src/app/page.tsx";
  assert.ok(existsSync(pagePath), `${pagePath} should exist`);

  const page = await readText(pagePath);

  assert.doesNotMatch(page, /INFRA-001 ready/);
  assert.match(page, /SiteHeader/);
  assert.match(page, /channels|curatedChannels/);
  assert.match(page, /api\/youtube\/channel/);
});
