import { readFile } from "node:fs/promises";
import test from "node:test";
import assert from "node:assert/strict";

const readText = (path) => readFile(path, "utf8");

test("MOBILE-009 search overlay uses readable Chinese copy", async () => {
  const source = await readText("src/app/components/web/GlobalSearchOverlay.tsx");

  assert.match(source, /aria-label="\u641c\u7d22"/u);
  assert.match(source, /placeholder="\u641c\u7d22\u5185\u5bb9\.\.\."/u);
  assert.match(source, />\s*\u53d6\u6d88\s*</u);
  assert.match(source, /\u641c\u7d22\u89c6\u9891\u3001\u8bfe\u7a0b\u3001\u9605\u8bfb\u548c\u8bed\u6599\u5e93\u5185\u5bb9/u);
  assert.doesNotMatch(source, /閹|鎼|鏉|鐠|绉|鍌|鍙|潒/u);
});
