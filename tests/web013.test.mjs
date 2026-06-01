import { readFile } from "node:fs/promises";
import { existsSync } from "node:fs";
import test from "node:test";
import assert from "node:assert/strict";

const readText = (path) => readFile(path, "utf8");

test("WEB-013 mobile nav component exists and wires the required behavior", async () => {
  const path = "src/app/components/web/MobileNav.tsx";
  assert.equal(existsSync(path), true, `${path} missing`);
  const source = await readText(path);

  assert.match(source, /"use client"/);
  assert.match(source, /useState/);
  assert.match(source, /document\.addEventListener\("keydown"/);
  assert.match(source, /setOpen\(false\)/);
  assert.match(source, /href:\s*"\/"/);
  assert.match(source, /href:\s*"\/learn"/);
  assert.match(source, /href:\s*"\/lectura"/);
  assert.match(source, /href:\s*"\/grammar"/);
  assert.match(source, /activeHref:\s*"\/vocab"/);
  assert.doesNotMatch(source, /useSession/);
  assert.match(source, /session\?:/);
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
  assert.doesNotMatch(source, /MobileNav/);
  assert.match(source, /className="hidden lg:flex/);
});
