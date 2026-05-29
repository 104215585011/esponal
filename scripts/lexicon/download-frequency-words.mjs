#!/usr/bin/env node
// Timestamp: 2026-05-29 20:33
import { mkdir, readFile, writeFile } from "node:fs/promises";
import { dirname } from "node:path";
import { pathToFileURL } from "node:url";

const DEFAULT_SOURCE =
  "https://raw.githubusercontent.com/hermitdave/FrequencyWords/master/content/2018/es/es_50k.txt";
const DEFAULT_OUTPUT = "data/freq-es.txt";
const DEFAULT_LICENSE = "data/freq-es.LICENSE";
const DEFAULT_COMMIT = "master";
const DEFAULT_LICENSE_CODE = "MIT";
const DEFAULT_REPO = "https://github.com/hermitdave/FrequencyWords";

function hasFlag(name) {
  return process.argv.includes(name);
}

function readOption(name, fallback = undefined) {
  const index = process.argv.indexOf(name);
  if (index === -1) return fallback;
  return process.argv[index + 1] ?? fallback;
}

function printUsage() {
  console.log(`Usage: node scripts/lexicon/download-frequency-words.mjs [options]

Downloads or copies the Spanish FrequencyWords source into data/freq-es.txt
and writes an MIT license trail into data/freq-es.LICENSE.

Safe by default: this script runs as a dry-run unless --write is provided.

Options:
  --write             Actually write the frequency file and license trail.
  --dry-run           Preview only. This is also the default.
  --source PATH|URL   Source text file or remote URL.
  --output PATH       Target frequency list path. Default: data/freq-es.txt.
  --license PATH      License trail path. Default: data/freq-es.LICENSE.
  --commit HASH       Source commit marker. Default: master.
  --help, -h          Show this help text.`);
}

async function readSourceText(source) {
  if (/^https?:\/\//i.test(source)) {
    const response = await fetch(source);
    if (!response.ok) {
      throw new Error(`Download failed ${response.status}: ${source}`);
    }
    return await response.text();
  }

  return await readFile(source, "utf8");
}

function buildLicenseTrail({ source, commit }) {
  return [
    "LEX-002 frequency source trail",
    `source: ${source}`,
    `repo: ${DEFAULT_REPO}`,
    `commit: ${commit}`,
    `license: ${DEFAULT_LICENSE_CODE}`,
    "note: Source word-frequency list reused under MIT; lexicon meanings/examples are generated separately."
  ].join("\n") + "\n";
}

async function main() {
  if (hasFlag("--help") || hasFlag("-h")) {
    printUsage();
    return;
  }

  const write = hasFlag("--write");
  const source = readOption("--source", DEFAULT_SOURCE);
  const outputPath = readOption("--output", DEFAULT_OUTPUT);
  const licensePath = readOption("--license", DEFAULT_LICENSE);
  const commit = readOption("--commit", DEFAULT_COMMIT);

  console.log(
    `LEX-002 download dryRun=${!write} source=${source} output=${outputPath} license=${licensePath} commit=${commit}`
  );

  if (!write) {
    console.log(`[dry-run] would download ${source} -> ${outputPath}`);
    console.log(`[dry-run] would write license trail -> ${licensePath}`);
    return;
  }

  const text = await readSourceText(source);
  await mkdir(dirname(outputPath), { recursive: true });
  await mkdir(dirname(licensePath), { recursive: true });
  await writeFile(outputPath, text, "utf8");
  await writeFile(licensePath, buildLicenseTrail({ source, commit }), "utf8");
  console.log(`Downloaded frequency list -> ${outputPath}`);
  console.log(`Wrote license trail -> ${licensePath}`);
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  main().catch((error) => {
    console.error(error);
    process.exitCode = 1;
  });
}
