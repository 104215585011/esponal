import assert from "node:assert/strict";
import { execFileSync, spawnSync } from "node:child_process";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import test from "node:test";

function read(filePath) {
  return fs.readFileSync(filePath, "utf8");
}

function runEncodingCheck(args = []) {
  return spawnSync(
    process.execPath,
    ["scripts/check-encoding.mjs", ...args],
    {
      cwd: process.cwd(),
      encoding: "utf8"
    }
  );
}

function withTempFile(name, bytes, callback) {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), "esponal-encoding-"));
  const filePath = path.join(dir, name);
  fs.writeFileSync(filePath, bytes);

  try {
    callback(filePath);
  } finally {
    fs.rmSync(dir, { force: true, recursive: true });
  }
}

test("INFRA-002 exposes encoding lint script, LF attributes, and pre-commit hook", () => {
  const packageJson = JSON.parse(read("package.json"));
  const attributes = read(".gitattributes");
  const hook = read(".githooks/pre-commit");

  assert.equal(packageJson.scripts["lint:encoding"], "node scripts/check-encoding.mjs");
  assert.equal(packageJson.scripts.prepare, "node scripts/install-git-hooks.mjs");
  assert.match(attributes, /\*\s+text=auto\s+eol=lf/);
  assert.match(hook, /npm run lint:encoding/);
  assert.match(hook, /npm test/);
});

test("INFRA-002 full repository encoding scan passes", () => {
  const result = runEncodingCheck();

  assert.equal(result.status, 0, result.stderr || result.stdout);
});

test("INFRA-002 encoding checker rejects mojibake, UTF-16, and CRLF files", () => {
  const mojibakeText = `中文${String.fromCharCode(0x951f)}坏\n`;

  withTempFile("bad-mojibake.md", Buffer.from(mojibakeText, "utf8"), (filePath) => {
    const result = runEncodingCheck(["--files", filePath]);
    assert.notEqual(result.status, 0);
    assert.match(result.stderr + result.stdout, /mojibake/i);
  });

  withTempFile(
    "bad-utf16.ts",
    Buffer.from([0xff, 0xfe, 0x63, 0x00, 0x6f, 0x00, 0x6e, 0x00, 0x73, 0x00, 0x74, 0x00]),
    (filePath) => {
      const result = runEncodingCheck(["--files", filePath]);
      assert.notEqual(result.status, 0);
      assert.match(result.stderr + result.stdout, /utf-8/i);
    }
  );

  withTempFile("bad-crlf.json", Buffer.from("{\r\n  \"ok\": true\r\n}\r\n"), (filePath) => {
    const result = runEncodingCheck(["--files", filePath]);
    assert.notEqual(result.status, 0);
    assert.match(result.stderr + result.stdout, /crlf/i);
  });
});

test("INFRA-002 git config points hooks to the versioned hook directory", () => {
  const hooksPath = execFileSync("git", ["config", "core.hooksPath"], {
    encoding: "utf8"
  }).trim();

  assert.equal(hooksPath.replaceAll("\\", "/"), ".githooks");
});
