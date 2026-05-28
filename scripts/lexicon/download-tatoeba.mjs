#!/usr/bin/env node
// Timestamp: 2026-05-28 16:24
import { createReadStream, createWriteStream } from "node:fs";
import { mkdir, stat, unlink } from "node:fs/promises";
import { dirname, join } from "node:path";
import { pipeline } from "node:stream/promises";
import { spawn } from "node:child_process";
import readline from "node:readline";

const DATA_DIR = "data/tatoeba";
const FILES = [
  {
    name: "sentences.csv",
    archive: "sentences.csv.bz2",
    url: "https://downloads.tatoeba.org/exports/sentences.csv.bz2",
    minBytes: 50_000_000
  },
  {
    name: "links.csv",
    archive: "links.csv.bz2",
    url: "https://downloads.tatoeba.org/exports/links.csv.bz2",
    minBytes: 10_000_000
  }
];

function hasFlag(flag) {
  return process.argv.includes(flag);
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

function createBunzip(sourcePath, destinationPath) {
  const code = [
    "import bz2, shutil, sys",
    "source, destination = sys.argv[1], sys.argv[2]",
    "with bz2.open(source, 'rb') as src, open(destination, 'wb') as dst:",
    "    shutil.copyfileobj(src, dst)"
  ].join("\n");

  return new Promise((resolve, reject) => {
    const child = spawn("python", ["-c", code, sourcePath, destinationPath], {
      stdio: "inherit"
    });
    child.on("error", reject);
    child.on("exit", (code) => {
      if (code === 0) resolve();
      else reject(new Error(`bunzip failed for ${sourcePath} with exit code ${code}`));
    });
  });
}

async function countLines(path) {
  const input = createReadStream(path);
  const rl = readline.createInterface({ input, crlfDelay: Infinity });
  let count = 0;
  for await (const _line of rl) count += 1;
  return count;
}

async function main() {
  const skipIfExists = hasFlag("--skip-if-exists");
  await mkdir(DATA_DIR, { recursive: true });

  for (const file of FILES) {
    const archivePath = join(DATA_DIR, file.archive);
    const csvPath = join(DATA_DIR, file.name);
    const existingCsv = await exists(csvPath);

    if (skipIfExists && existingCsv && existingCsv.size >= file.minBytes) {
      const lines = await countLines(csvPath);
      console.log(`${file.name}: exists, ${existingCsv.size} bytes, ${lines} lines`);
      continue;
    }

    console.log(`Downloading ${file.archive}...`);
    await downloadFile(file.url, archivePath);

    console.log(`Extracting ${file.archive}...`);
    await createBunzip(archivePath, csvPath);

    const csvStat = await stat(csvPath);
    if (csvStat.size < file.minBytes) {
      throw new Error(`${file.name} looks incomplete: ${csvStat.size} bytes`);
    }

    const lines = await countLines(csvPath);
    console.log(`${file.name}: ${csvStat.size} bytes, ${lines} lines`);
    await unlink(archivePath).catch(() => {});
  }
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});

