#!/usr/bin/env node
// Timestamp: 2026-05-28 16:44
import { createReadStream, createWriteStream } from "node:fs";
import { mkdir } from "node:fs/promises";
import { dirname } from "node:path";
import readline from "node:readline";

const SPANISH_PATH = "data/tatoeba/spa_sentences.tsv";
const CHINESE_PATH = "data/tatoeba/cmn_sentences.tsv";
const LINKS_PATH = "data/tatoeba/links.csv";
const OUTPUT_PATH = "data/tatoeba-es-zh.jsonl";
const PROGRESS_INTERVAL = 100000;

function hasFlag(flag) {
  return process.argv.includes(flag);
}

function printUsage() {
  console.log(`Usage: node scripts/lexicon/parse-tatoeba.mjs [--write]

Parses data/tatoeba/spa_sentences.tsv, cmn_sentences.tsv, and links.csv into
data/tatoeba-es-zh.jsonl.

Options:
  --write      Actually write the jsonl output. Omit for a dry-run scan.
  --help, -h   Show this help text.`);
}

function parseTsv(line) {
  return line.split("\t");
}

async function readSentenceFile(path, expectedLang) {
  const sentences = new Map();
  const input = createReadStream(path);
  const rl = readline.createInterface({ input, crlfDelay: Infinity });
  let rows = 0;

  for await (const line of rl) {
    rows += 1;
    if (rows % PROGRESS_INTERVAL === 0) {
      console.log(`${path} rows=${rows} kept=${sentences.size}`);
    }

    const [id, langOrText, maybeText] = parseTsv(line);
    const lang = maybeText === undefined ? expectedLang : langOrText;
    const text = maybeText === undefined ? langOrText : maybeText;
    if (!id || !text || lang !== expectedLang) continue;
    sentences.set(id, text);
  }

  console.log(`${path} done rows=${rows} kept=${sentences.size}`);
  return sentences;
}

async function writePairs(spanish, chinese, write) {
  const output = write ? createWriteStream(OUTPUT_PATH) : null;
  if (write) await mkdir(dirname(OUTPUT_PATH), { recursive: true });

  const input = createReadStream(LINKS_PATH);
  const rl = readline.createInterface({ input, crlfDelay: Infinity });
  let rows = 0;
  let matched = 0;
  const seen = new Set();

  for await (const line of rl) {
    rows += 1;
    if (rows % PROGRESS_INTERVAL === 0) {
      console.log(`links.csv rows=${rows} pairs=${matched}`);
    }

    const [left, right] = parseTsv(line);
    const leftEs = spanish.get(left);
    const rightEs = spanish.get(right);
    const leftZh = chinese.get(left);
    const rightZh = chinese.get(right);

    const pair = leftEs && rightZh
      ? { es: leftEs, zh: rightZh, esId: Number(left), zhId: Number(right) }
      : rightEs && leftZh
        ? { es: rightEs, zh: leftZh, esId: Number(right), zhId: Number(left) }
        : null;

    if (!pair) continue;
    const key = `${pair.esId}:${pair.zhId}`;
    if (seen.has(key)) continue;
    seen.add(key);
    matched += 1;
    if (output) output.write(`${JSON.stringify(pair)}\n`);
  }

  if (output) await new Promise((resolve) => output.end(resolve));
  console.log(`links.csv done rows=${rows} pairs=${matched} output=${write ? OUTPUT_PATH : "[dry-run]"}`);
}

async function main() {
  if (hasFlag("--help") || hasFlag("-h")) {
    printUsage();
    return;
  }

  const write = hasFlag("--write");
  if (!write) console.log("[dry-run] scanning inputs without writing jsonl");
  const spanish = await readSentenceFile(SPANISH_PATH, "spa");
  const chinese = await readSentenceFile(CHINESE_PATH, "cmn");
  await writePairs(spanish, chinese, write);
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
