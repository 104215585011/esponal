import assert from "node:assert/strict";
import { existsSync } from "node:fs";
import { readFile } from "node:fs/promises";
import test from "node:test";

const readText = (path) => readFile(path, "utf8");
const readJson = async (path) => JSON.parse(await readText(path));
const removedTokenName = ["EXT", "INGEST", "TOKEN"].join("_");
const removedTokenHeader = ["X", "Esponal", "Ingest", "Token"].join("-");

test("EXT-007 removes ingest token references from implementation surfaces", async () => {
  const paths = [
    "src/app/api/subtitle/ingest/route.ts",
    "extension/harvest.js",
    "extension/scripts/build.mjs",
    "tests/ext006.test.mjs",
    ".env.example"
  ];

  for (const path of paths) {
    const source = await readText(path);
    assert.doesNotMatch(source, new RegExp(removedTokenName), path);
    assert.doesNotMatch(source, new RegExp(removedTokenHeader), path);
  }
});

test("EXT-007 bootstrap harvest script launches persistent chromium with extension", async () => {
  const scriptPath = "scripts/bootstrap-harvest.mjs";
  assert.ok(existsSync(scriptPath), `${scriptPath} should exist`);

  const script = await readText(scriptPath);

  assert.match(script, /from "@playwright\/test"/);
  assert.match(script, /launchPersistentContext/);
  assert.match(script, /headless:\s*false/);
  assert.match(script, /\.cache\/harvest-chrome-profile/);
  assert.match(script, /extension\/dist/);
  assert.match(script, /--disable-extensions-except=/);
  assert.match(script, /--load-extension=/);
  assert.match(script, /Account menu/);
  assert.match(script, /waitForSelector\(accountMenu/);
});

test("EXT-007 bootstrap harvest script supports all input modes and failure retry file", async () => {
  const script = await readText("scripts/bootstrap-harvest.mjs");

  assert.match(script, /--channels/);
  assert.match(script, /--channel/);
  assert.match(script, /--videos/);
  assert.match(script, /--videos-from-file/);
  assert.match(script, /curatedChannels/);
  assert.match(script, /\/api\/youtube\/channel/);
  assert.match(script, /\.cache\/harvest-failures\.log/);
  assert.match(script, /redis-cli/);
});

test("EXT-007 package and ignore rules expose harvest command safely", async () => {
  const packageJson = await readJson("package.json");
  const gitignore = await readText(".gitignore");

  assert.equal(packageJson.scripts.harvest, "node scripts/bootstrap-harvest.mjs");
  assert.match(gitignore, /\.cache\/harvest-chrome-profile\//);
});
