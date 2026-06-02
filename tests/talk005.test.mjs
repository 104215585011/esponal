import { readFile } from "node:fs/promises";
import assert from "node:assert/strict";
import test from "node:test";

const readText = (filePath) => readFile(filePath, "utf8");

test("TALK-005 clamps talk lookup popovers away from sidebar and viewport edges", async () => {
  const spanishText = await readText("src/app/components/vocab/SpanishText.tsx");

  assert.match(spanishText, /SIDEBAR_W_LG\s*=\s*260/);
  assert.match(spanishText, /LOOKUP_CARD_W\s*=\s*320/);
  assert.match(spanishText, /LOOKUP_PADDING\s*=\s*8/);
  assert.match(spanishText, /source\?\.type === "talk"/);
  assert.match(spanishText, /window\.innerWidth >= 1024/);
  assert.match(spanishText, /SIDEBAR_W_LG \+ LOOKUP_PADDING/);
  assert.match(spanishText, /window\.innerWidth - LOOKUP_CARD_W - LOOKUP_PADDING/);
  assert.match(spanishText, /Math\.max\(minLeft,\s*Math\.min\(anchorX - LOOKUP_CARD_W \/ 2,\s*maxLeft\)\)/);
  assert.match(spanishText, /getLookupViewportLeft/);
});

test("TALK-005 keeps non-talk lookup pages on the normal 8px viewport lower bound", async () => {
  const spanishText = await readText("src/app/components/vocab/SpanishText.tsx");

  assert.match(spanishText, /isTalkDesktop/);
  assert.match(spanishText, /isTalkDesktop\s*\?\s*SIDEBAR_W_LG \+ LOOKUP_PADDING\s*:\s*LOOKUP_PADDING/);
  assert.doesNotMatch(spanishText, /source\?\.type !== "talk"[\s\S]*SIDEBAR_W_LG \+ LOOKUP_PADDING/);
});
