#!/usr/bin/env node

import fs from "node:fs";
import path from "node:path";
import { TextDecoder } from "node:util";

const TEXT_EXTENSIONS = new Set([".ts", ".tsx", ".js", ".mjs", ".json", ".md"]);
const IGNORED_DIRS = new Set([
  ".git",
  ".next",
  ".claude",
  ".qa",
  ".npm-cache",
  "node_modules"
]);
const ALLOWLIST = new Set([
  "claude-progress.md",
  "docs/tickets/INFRA-002.md",
  "extension/lemma-dict.json",
  "src/lib/dictionary.ts"
]);
const MOJIBAKE_HINTS = [
  "\u951f",
  "\ufffd",
  "\u95bb",
  "\u9420",
  "\u95b9",
  "\u95ba",
  "\u6fde",
  "\u95c1",
  "\u941f",
  "\u9361"
];

const decoder = new TextDecoder("utf-8", { fatal: true });
const root = process.cwd();
const args = process.argv.slice(2);

function toRepoPath(filePath) {
  return path.relative(root, path.resolve(filePath)).replaceAll(path.sep, "/");
}

function shouldCheck(filePath) {
  return TEXT_EXTENSIONS.has(path.extname(filePath));
}

function collectFiles(dir, files = []) {
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    if (IGNORED_DIRS.has(entry.name) || entry.name === ".env") {
      continue;
    }

    const fullPath = path.join(dir, entry.name);

    if (entry.isDirectory()) {
      collectFiles(fullPath, files);
      continue;
    }

    if (entry.isFile() && shouldCheck(fullPath)) {
      files.push(fullPath);
    }
  }

  return files;
}

function lineNumberForIndex(text, index) {
  return text.slice(0, index).split("\n").length;
}

function findMojibake(text) {
  for (const hint of MOJIBAKE_HINTS) {
    const index = text.indexOf(hint);

    if (index !== -1) {
      return {
        line: lineNumberForIndex(text, index),
        reason: `mojibake hint ${JSON.stringify(hint)}`
      };
    }
  }

  const suspiciousQuestion = /[\u4e00-\u9fff][^\n]{0,12}\?{3,}|\?{3,}[^\n]{0,12}[\u4e00-\u9fff]/u.exec(text);

  if (suspiciousQuestion?.index !== undefined) {
    return {
      line: lineNumberForIndex(text, suspiciousQuestion.index),
      reason: "mojibake-like question marks near Chinese text"
    };
  }

  return null;
}

function checkFile(filePath) {
  const repoPath = toRepoPath(filePath);

  if (ALLOWLIST.has(repoPath)) {
    return [];
  }

  const buffer = fs.readFileSync(filePath);
  const errors = [];

  if (buffer[0] === 0xef && buffer[1] === 0xbb && buffer[2] === 0xbf) {
    errors.push(`${repoPath}:1: UTF-8 BOM is not allowed`);
  }

  if (buffer.includes(Buffer.from([0x0d, 0x0a]))) {
    errors.push(`${repoPath}:1: CRLF line endings are not allowed`);
  }

  let text = "";

  try {
    text = decoder.decode(buffer);
  } catch {
    errors.push(`${repoPath}:1: file must be valid UTF-8`);
    return errors;
  }

  const ext = path.extname(filePath);

  if (ext === ".json") {
    try {
      JSON.parse(text);
    } catch (error) {
      errors.push(`${repoPath}:1: JSON parse failed: ${error.message}`);
    }
  }

  if (ext === ".ts" || ext === ".tsx" || ext === ".md") {
    const mojibake = findMojibake(text);

    if (mojibake) {
      errors.push(`${repoPath}:${mojibake.line}: ${mojibake.reason}`);
    }
  }

  return errors;
}

function getTargetFiles() {
  const filesFlagIndex = args.indexOf("--files");

  if (filesFlagIndex !== -1) {
    return args
      .slice(filesFlagIndex + 1)
      .filter(Boolean)
      .filter((filePath) => fs.existsSync(filePath) && shouldCheck(filePath));
  }

  return collectFiles(root);
}

const errors = getTargetFiles().flatMap(checkFile);

if (errors.length > 0) {
  console.error(errors.join("\n"));
  process.exit(1);
}

console.log("Encoding check passed");
