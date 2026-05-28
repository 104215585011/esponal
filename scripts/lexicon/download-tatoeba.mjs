#!/usr/bin/env node
// Timestamp: 2026-05-28 16:44
import { createReadStream, createWriteStream } from "node:fs";
import { mkdir, stat, unlink } from "node:fs/promises";
import { dirname, join } from "node:path";
import { pipeline } from "node:stream/promises";
import { spawn } from "node:child_process";
import readline from "node:readline";

const DATA_DIR = "data/tatoeba";
const FILES = [
  {
    name: "spa_sentences.tsv",
    archive: "spa_sentences.tsv.bz2",
    url: "https://downloads.tatoeba.org/exports/per_language/spa/spa_sentences.tsv.bz2",
    minBytes: 1_000_000,
    kind: "bz2"
  },
  {
    name: "cmn_sentences.tsv",
    archive: "cmn_sentences.tsv.bz2",
    url: "https://downloads.tatoeba.org/exports/per_language/cmn/cmn_sentences.tsv.bz2",
    minBytes: 1_000_000,
    kind: "bz2"
  },
  {
    name: "links.csv",
    archive: "links.tar.bz2",
    url: "https://downloads.tatoeba.org/exports/links.tar.bz2",
    minBytes: 10_000_000,
    kind: "tar.bz2"
  }
];

function hasFlag(flag) {
  return process.argv.includes(flag);
}

function printUsage() {
  console.log(`Usage: node scripts/lexicon/download-tatoeba.mjs [--write] [--skip-if-exists]

Downloads Tatoeba Spanish, Chinese, and links exports into data/tatoeba/.

Options:
  --write            Actually download files. Omit for a dry-run preview.
  --skip-if-exists   Reuse existing extracted files that pass the size check.
  --help, -h         Show this help text.`);
}

async function exists(path) {
  try {
    return await stat(path);
  } catch {
    return null;
  }
}

async function downloadFile(url, destination) {
  const response = await fetch(url);
  if (!response.ok || !response.body) {
    throw new Error(`Download failed ${response.status}: ${url}`);
  }

  await mkdir(dirname(destination), { recursive: true });
  await pipeline(response.body, createWriteStream(destination));
}

function runPython(code, args) {
  return new Promise((resolve, reject) => {
    const child = spawn("python", ["-c", code, ...args], {
      stdio: "inherit"
    });
    child.on("error", reject);
    child.on("exit", (code) => {
      if (code === 0) resolve();
      else reject(new Error(`python extraction failed with exit code ${code}`));
    });
  });
}

function createBunzip(sourcePath, destinationPath) {
  const code = [
    "import bz2, shutil, sys",
    "source, destination = sys.argv[1], sys.argv[2]",
    "with bz2.open(source, 'rb') as src, open(destination, 'wb') as dst:",
    "    shutil.copyfileobj(src, dst)"
  ].join("\n");

  return runPython(code, [sourcePath, destinationPath]);
}

function extractTarBz2(sourcePath, destinationDir, memberName) {
  const code = [
    "import os, shutil, sys, tarfile",
    "source, destination_dir, member_name = sys.argv[1], sys.argv[2], sys.argv[3]",
    "with tarfile.open(source, 'r:bz2') as archive:",
    "    member = next((item for item in archive.getmembers() if os.path.basename(item.name) == member_name), None)",
    "    if member is None:",
    "        raise SystemExit(f'missing member {member_name}')",
    "    extracted = archive.extractfile(member)",
    "    if extracted is None:",
    "        raise SystemExit(f'cannot extract {member_name}')",
    "    with open(os.path.join(destination_dir, member_name), 'wb') as output:",
    "        shutil.copyfileobj(extracted, output)"
  ].join("\n");

  return runPython(code, [sourcePath, destinationDir, memberName]);
}

async function countLines(path) {
  const input = createReadStream(path);
  const rl = readline.createInterface({ input, crlfDelay: Infinity });
  let count = 0;
  for await (const _line of rl) count += 1;
  return count;
}

async function main() {
  if (hasFlag("--help") || hasFlag("-h")) {
    printUsage();
    return;
  }

  const write = hasFlag("--write");
  const skipIfExists = hasFlag("--skip-if-exists");
  await mkdir(DATA_DIR, { recursive: true });

  for (const file of FILES) {
    const archivePath = join(DATA_DIR, file.archive);
    const outputPath = join(DATA_DIR, file.name);
    const existingOutput = await exists(outputPath);

    if (skipIfExists && existingOutput && existingOutput.size >= file.minBytes) {
      const lines = await countLines(outputPath);
      console.log(`${file.name}: exists, ${existingOutput.size} bytes, ${lines} lines`);
      continue;
    }

    if (!write) {
      console.log(`[dry-run] would download ${file.url} -> ${outputPath}`);
      continue;
    }

    console.log(`Downloading ${file.archive}...`);
    await downloadFile(file.url, archivePath);

    console.log(`Extracting ${file.archive}...`);
    if (file.kind === "tar.bz2") await extractTarBz2(archivePath, DATA_DIR, file.name);
    else await createBunzip(archivePath, outputPath);

    const outputStat = await stat(outputPath);
    if (outputStat.size < file.minBytes) {
      throw new Error(`${file.name} looks incomplete: ${outputStat.size} bytes`);
    }

    const lines = await countLines(outputPath);
    console.log(`${file.name}: ${outputStat.size} bytes, ${lines} lines`);
    await unlink(archivePath).catch(() => {});
  }
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
