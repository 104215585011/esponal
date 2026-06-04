import { readFile } from "node:fs/promises";
import test from "node:test";
import assert from "node:assert/strict";

const readText = (path) => readFile(path, "utf8");

test("root layout uses the standardized Plus Jakarta Sans + Noto Sans SC font pair", async () => {
  const layout = await readText("src/app/layout.tsx");

  assert.match(layout, /Plus_Jakarta_Sans/);
  assert.match(layout, /Noto_Sans_SC/);
  assert.match(layout, /--font-plus-jakarta/);
  assert.match(layout, /--font-noto-sc/);
  assert.doesNotMatch(layout, /\bInter\b/);
  assert.doesNotMatch(layout, /\bOutfit\b/);
});

test("tailwind font tokens point to the new font variables", async () => {
  const tailwind = await readText("tailwind.config.ts");

  assert.match(tailwind, /sans:\s*\["var\(--font-plus-jakarta\)",\s*"var\(--font-noto-sc\)"/);
  assert.match(tailwind, /display:\s*\["var\(--font-plus-jakarta\)",\s*"var\(--font-noto-sc\)"/);
  assert.doesNotMatch(tailwind, /font-inter/);
  assert.doesNotMatch(tailwind, /font-outfit/);
});

test("global styles no longer import or reference Inter and route helpers use the shared stack", async () => {
  const globals = await readText("src/app/globals.css");
  const foundation = await readText("src/app/learn/phase-1/page.tsx");

  assert.doesNotMatch(globals, /fonts\.googleapis/);
  assert.doesNotMatch(globals, /font-inter/);
  assert.doesNotMatch(globals, /"Inter"/);
  assert.doesNotMatch(globals, /Playfair Display/);
  assert.doesNotMatch(globals, /EB Garamond/);
  assert.match(globals, /var\(--font-plus-jakarta\)/);
  assert.match(globals, /var\(--font-noto-sc\)/);
  assert.doesNotMatch(foundation, /PingFang SC/);
});
