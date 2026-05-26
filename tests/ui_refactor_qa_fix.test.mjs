import { readFile } from "node:fs/promises";
import test from "node:test";
import assert from "node:assert/strict";

const readText = (path) => readFile(path, "utf8");

test("UI-REFACTOR-QA fix keeps the closed mobile drawer from widening the document", async () => {
  const mobileNav = await readText("src/app/components/web/MobileNav.tsx");

  assert.match(mobileNav, /fixed inset-0 z-50/);
  assert.match(mobileNav, /overflow-hidden/);
  assert.match(mobileNav, /translate-x-full/);
});

test("UI-REFACTOR-QA fix keeps design-preview styles out of render text", async () => {
  const page = await readText("src/app/design-preview/page.tsx");
  const globals = await readText("src/app/globals.css");

  assert.doesNotMatch(page, /<style>/);
  assert.match(globals, /\.ed-display/);
  assert.match(globals, /@keyframes ed-reveal/);
  assert.match(globals, /\.ed-flip-inner\.flipped/);
});
