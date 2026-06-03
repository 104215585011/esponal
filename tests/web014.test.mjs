import { existsSync } from "node:fs";
import { readFile } from "node:fs/promises";
import assert from "node:assert/strict";
import test from "node:test";

const readText = (filePath) => readFile(filePath, "utf8");

test("WEB-014 BackLink component exists with the reviewed contract", async () => {
  assert.ok(existsSync("src/app/components/web/BackLink.tsx"));

  const source = await readText("src/app/components/web/BackLink.tsx");

  assert.match(source, /import Link from "next\/link"/);
  assert.match(source, /export function BackLink/);
  assert.match(source, /href: string/);
  assert.match(source, /label: string/);
  assert.match(source, /data-testid="back-link"/);
  assert.match(source, /min-h-\[44px\]/);
  assert.match(source, /text-gray-600/);
  assert.match(source, /hover:text-gray-900/);
  assert.match(source, /focus-visible:ring-2/);
  assert.match(source, /aria-label=\{`返回\$\{label\}`\}/);
});

test("WEB-014 detail pages import BackLink and use the exact destinations", async () => {
  const cases = [
    ["src/app/lectura/[slug]/page.tsx", /<BackLink href="\/lectura" label="阅读" \/>/],
    ["src/app/learn/[slug]/page.tsx", /<BackLink href="\/learn" label="课程" \/>/],
    ["src/app/watch/page.tsx", /<BackLink href="\/" label="视频" \/>/],
    ["src/app/vocab/review/page.tsx", /<BackLink href="\/vocab" label="语料库" \/>/],
    ["src/app/grammar/[slug]/page.tsx", /<BackLink href="\/grammar" label="语法" \/>/]
  ];

  for (const [filePath, usagePattern] of cases) {
    const source = await readText(filePath);
    assert.match(source, /import \{ BackLink \} from "@\/app\/components\/web\/BackLink"/, filePath);
    assert.match(source, usagePattern, filePath);
  }
});

test("WEB-014 top-level list pages do not import BackLink", async () => {
  const listPages = [
    "src/app/vocab/page.tsx",
    "src/app/learn/page.tsx",
    "src/app/lectura/page.tsx",
    "src/app/grammar/page.tsx"
  ];

  for (const filePath of listPages) {
    const source = await readText(filePath);
    assert.doesNotMatch(source, /BackLink/, filePath);
  }
});

test("WEB-014 labels match SiteNav and watch uses video label", async () => {
  const siteNav = await readText("src/app/components/web/SiteNav.tsx");
  const watch = await readText("src/app/watch/page.tsx");

  for (const label of ["视频", "课程", "阅读", "语法", "语料库"]) {
    assert.match(siteNav, new RegExp(`label: "${label}"`));
  }

  assert.match(watch, /<BackLink href="\/" label="视频" \/>/);
  assert.doesNotMatch(watch, /label="首页"/);
  assert.doesNotMatch(watch, /label="搜索"/);
});

test("WEB-014 lectura and grammar legacy return links are removed", async () => {
  const lectura = await readText("src/app/lectura/[slug]/page.tsx");
  const grammar = await readText("src/app/grammar/[slug]/page.tsx");

  assert.doesNotMatch(lectura, /返回 Lectura/);
  assert.doesNotMatch(lectura, /hover:text-brand-600/);
  assert.doesNotMatch(grammar, /返回语法话题/);
  assert.doesNotMatch(grammar, /text-brand-600" href="\/grammar"/);
});

test("WEB-014 BackLink is positioned before each detail header", async () => {
  const cases = [
    ["src/app/lectura/[slug]/page.tsx", "<h1"],
    ["src/app/learn/[slug]/page.tsx", "<section"],
    ["src/app/watch/page.tsx", "<div className=\"w-full overflow-hidden"],
    ["src/app/vocab/review/page.tsx", "<header"],
    ["src/app/grammar/[slug]/page.tsx", "<header"]
  ];

  for (const [filePath, followingMarker] of cases) {
    const source = await readText(filePath);
    const backLinkIndex = source.indexOf("<BackLink");
    const markerIndex = source.indexOf(followingMarker);

    assert.ok(backLinkIndex >= 0, filePath);
    assert.ok(markerIndex > backLinkIndex, filePath);
  }
});
