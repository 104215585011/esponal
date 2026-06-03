import { readFile } from "node:fs/promises";
import { existsSync } from "node:fs";
import test from "node:test";
import assert from "node:assert/strict";

const readText = (path) => readFile(path, "utf8");

test("WEB-013 mobile nav component exists and wires drawer behavior", async () => {
  const path = "src/app/components/web/MobileNav.tsx";
  assert.equal(existsSync(path), true, `${path} missing`);
  const source = await readText(path);
  const navItemsBlock = source.match(/const navItems:[\s\S]*?\];/)?.[0] ?? "";

  assert.match(source, /"use client"/);
  assert.match(source, /useState/);
  assert.match(source, /document\.addEventListener\("keydown"/);
  assert.match(source, /setOpen\(false\)/);
  assert.match(source, /session\?:/);
  assert.doesNotMatch(source, /useSession/);

  assert.match(navItemsBlock, /href:\s*"\/phonics"/);
  assert.match(navItemsBlock, /href:\s*"\/talk"/);
  assert.match(navItemsBlock, /href:\s*"\/grammar"/);
  assert.match(navItemsBlock, /href:\s*"\/dissect"/);
  assert.doesNotMatch(navItemsBlock, /href:\s*"\/"/);
  assert.doesNotMatch(navItemsBlock, /href:\s*"\/learn"/);
  assert.doesNotMatch(navItemsBlock, /href:\s*"\/lectura"/);
  assert.doesNotMatch(navItemsBlock, /activeHref:\s*"\/vocab"/);
});

test("WEB-013 SiteNav keeps desktop nav and exposes a mobile branch", async () => {
  const path = "src/app/components/web/SiteNav.tsx";
  assert.equal(existsSync(path), true, `${path} missing`);
  const source = await readText(path);

  assert.match(source, /hidden lg:flex/);
  assert.match(source, /MobileNav/);
  assert.match(source, /session\?:/);
  assert.match(source, /<MobileNav vocabHref=\{vocabHref\} session=\{session\}/);
  assert.match(source, /lg:hidden/);
});

test("WEB-013 SiteHeader keeps SiteNav and hides desktop search on small screens", async () => {
  const path = "src/app/components/web/SiteHeader.tsx";
  assert.equal(existsSync(path), true, `${path} missing`);
  const source = await readText(path);

  assert.match(source, /SiteNav/);
  assert.match(source, /<SiteNav vocabHref=\{vocabHref\} session=\{session\}/);
  assert.match(source, /MobileTopBar/);
  assert.match(source, /className="hidden lg:flex/);
});
