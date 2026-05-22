import { readFile } from "node:fs/promises";
import assert from "node:assert/strict";
import test from "node:test";

const readText = (filePath) => readFile(filePath, "utf8");

test("WEB-015 exposes an app-shell max width design token", async () => {
  const source = await readText("tailwind.config.ts");

  assert.match(source, /maxWidth:\s*\{/);
  assert.match(source, /['"]app-shell['"]:\s*['"]96rem['"]/);
});

test("WEB-015 app shell surfaces use max-w-app-shell instead of max-w-screen-xl", async () => {
  const files = [
    "src/app/components/web/SiteHeader.tsx",
    "src/app/page.tsx",
    "src/app/learn/page.tsx",
    "src/app/learn/[slug]/page.tsx",
    "src/app/lectura/page.tsx",
    "src/app/extension/page.tsx"
  ];

  for (const filePath of files) {
    const source = await readText(filePath);
    assert.match(source, /max-w-app-shell/, filePath);
    assert.doesNotMatch(source, /max-w-screen-xl/, filePath);
  }
});

test("WEB-015 watch keeps the outer main full-screen and constrains only the inner two-column shell", async () => {
  const source = await readText("src/app/watch/page.tsx");
  const mainLine = source
    .split(/\r?\n/)
    .find((line) => line.includes("<main className="));
  const innerShellLine = source
    .split(/\r?\n/)
    .find((line) => line.includes("lg:flex-row"));

  assert.ok(mainLine, "watch page should have an outer main");
  assert.ok(innerShellLine, "watch page should have an inner lg:flex-row shell");
  assert.doesNotMatch(mainLine, /max-w-app-shell/);
  assert.doesNotMatch(mainLine, /max-w-screen-xl/);
  assert.match(innerShellLine, /mx-auto/);
  assert.match(innerShellLine, /w-full/);
  assert.match(innerShellLine, /max-w-app-shell/);
});

test("WEB-015 watch caps the player width inside the wider app shell", async () => {
  const source = await readText("src/app/watch/page.tsx");
  const playerShellLine = source
    .split(/\r?\n/)
    .find((line) => line.includes("shadow-elevated"));

  assert.ok(playerShellLine, "watch page should have a player shell");
  assert.match(playerShellLine, /lg:max-w-\[48rem\]/);
  assert.match(source, /<div className="aspect-video w-full">/);
});

test("WEB-015 reading-focused narrow pages keep their intentional max widths", async () => {
  const cases = [
    ["src/app/grammar/page.tsx", /max-w-5xl/],
    ["src/app/grammar/[slug]/page.tsx", /max-w-5xl/],
    ["src/app/lectura/[slug]/page.tsx", /max-w-3xl/],
    ["src/app/learn/phase-1/page.tsx", /max-w-3xl/]
  ];

  for (const [filePath, expectedWidth] of cases) {
    const source = await readText(filePath);
    assert.match(source, expectedWidth, filePath);
    assert.doesNotMatch(source, /max-w-app-shell/, filePath);
  }
});
