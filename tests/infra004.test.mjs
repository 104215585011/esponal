import assert from "node:assert/strict";
import fs from "node:fs";
import test from "node:test";

const CI_PATH = ".github/workflows/ci.yml";

function read(path) {
  return fs.readFileSync(path, "utf8");
}

test("INFRA-004 GitHub Actions workflow file exists", () => {
  assert.equal(fs.existsSync(CI_PATH), true, `${CI_PATH} missing`);
});

test("INFRA-004 workflow triggers on PR and push to main", () => {
  const yml = read(CI_PATH);
  assert.match(yml, /pull_request/);
  assert.match(yml, /push:/);
  assert.match(yml, /branches:\s*\[\s*main\s*\]/);
});

test("INFRA-004 workflow runs the test and build steps", () => {
  const yml = read(CI_PATH);
  assert.match(yml, /actions\/setup-node/);
  assert.match(yml, /npm ci/);
  assert.match(yml, /npm test/);
  assert.match(yml, /npm run build/);
});

test("INFRA-004 workflow runs the encoding lint", () => {
  const yml = read(CI_PATH);
  assert.match(yml, /npm run lint:encoding/);
});

test("INFRA-004 package.json exposes ci:local script", () => {
  const pkg = JSON.parse(read("package.json"));
  assert.ok(pkg.scripts["ci:local"], "ci:local script missing");
  assert.match(pkg.scripts["ci:local"], /npm test/);
  assert.match(pkg.scripts["ci:local"], /npm run build/);
});
