import { readFile } from "node:fs/promises";
import test from "node:test";
import assert from "node:assert/strict";

const readText = (path) => readFile(path, "utf8");

test("VOCAB-003 buildVideoJumpHref appends integer timestamp to watch URLs", async () => {
  const utilPath = "src/app/components/vocab/videoHref.ts";
  const util = await readText(utilPath);

  assert.match(util, /export function buildVideoJumpHref/);
  assert.match(util, /sourceUrl\.includes\("\?"\)/);
  assert.match(util, /timestampSec/);

  const { buildVideoJumpHref } = await import(
    new URL("../src/app/components/vocab/videoHref.ts", import.meta.url)
  );

  assert.equal(
    buildVideoJumpHref("https://www.youtube.com/watch?v=abc123", 42),
    "https://www.youtube.com/watch?v=abc123&t=42"
  );

  assert.equal(
    buildVideoJumpHref("https://www.youtube.com/watch?v=abc123&list=xyz", 135),
    "https://www.youtube.com/watch?v=abc123&list=xyz&t=135"
  );

  assert.equal(
    buildVideoJumpHref("https://www.youtube.com/watch?v=abc123", 9.9),
    "https://www.youtube.com/watch?v=abc123&t=9"
  );
});
