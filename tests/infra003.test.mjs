import assert from "node:assert/strict";
import fs from "node:fs";
import test from "node:test";

function read(path) {
  return fs.readFileSync(path, "utf8");
}

test("INFRA-003 Playwright dependency and config exist", () => {
  const pkg = JSON.parse(read("package.json"));
  assert.ok(
    pkg.devDependencies?.["@playwright/test"] || pkg.dependencies?.["@playwright/test"],
    "@playwright/test missing"
  );
  assert.ok(pkg.scripts["test:e2e"], "test:e2e script missing");
  assert.match(pkg.scripts["test:e2e"], /playwright/);

  assert.equal(fs.existsSync("playwright.config.ts"), true, "playwright.config.ts missing");
  const config = read("playwright.config.ts");
  assert.match(config, /defineConfig/);
  assert.match(config, /testDir.*tests\/e2e/);
  assert.match(config, /webServer/);
});

test("INFRA-003 three critical-path specs exist", () => {
  const specs = [
    "tests/e2e/anon-home-to-watch.spec.ts",
    "tests/e2e/login-lookup-save.spec.ts",
    "tests/e2e/anon-save-prompts-login.spec.ts"
  ];

  for (const spec of specs) {
    assert.equal(fs.existsSync(spec), true, `${spec} missing`);
    const src = read(spec);
    assert.match(src, /@playwright\/test/);
    assert.match(src, /test\(/);
  }
});

test("INFRA-003 seed script exists and creates the e2e user", () => {
  const path = "scripts/seed-e2e-user.mjs";
  assert.equal(fs.existsSync(path), true, `${path} missing`);
  const src = read(path);
  assert.match(src, /PrismaClient/);
  assert.match(src, /bcrypt/);
  assert.match(src, /upsert/);
});

test("INFRA-003 key UI components expose data-testid hooks", () => {
  const expectations = [
    ["src/app/components/web/VideoCard.tsx", "video-card"],
    ["src/app/watch/TranscriptPanel.tsx", "transcript-cue"],
    ["src/app/watch/LookupCard.tsx", "lookup-card"],
    ["src/app/components/vocab/VocabAccordion.tsx", "vocab-word"]
  ];

  for (const [path, testid] of expectations) {
    const src = read(path);
    assert.match(
      src,
      new RegExp(`data-testid=["']${testid}["']`),
      `${path} missing data-testid="${testid}"`
    );
  }
});

test("INFRA-003 environment example documents E2E variables", () => {
  const env = read(".env.example");
  assert.match(env, /^E2E_USER_EMAIL=/m);
  assert.match(env, /^E2E_USER_PASSWORD=/m);
  assert.match(env, /^E2E_TEST_VIDEO_ID=/m);
});
