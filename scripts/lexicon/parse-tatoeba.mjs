#!/usr/bin/env node
// Timestamp: 2026-05-28 16:24
import { createReadStream, createWriteStream } from "node:fs";
import { mkdir } from "node:fs/promises";
import { dirname } from "node:path";
import readline from "node:readline";

const SENTENCES_PATH = "data/tatoeba/sentences.csv";
const LINKS_PATH = "data/tatoeba/links.csv";
const OUTPUT_PATH = "data/tatoeba-es-zh.jsonl";
const PROGRESS_INTERVAL = 100000;

function parseTsv(line) {
  return line.split("\t");
}

async function readSentences() {
  const spanish = new Map();
  const chinese = new Map();
  const input = createReadStream(SENTENCES_PATH);
  const rl = readline.createInterface({ input, crlfDelay: Infinity });
  let rows = 0;

  for await (const line of rl) {
    rows += 1;
    if (rows % PROGRESS_INTERVAL === 0) {
      console.log(`sentences.csv rows=${rows} es=${spanish.size} zh=${chinese.size}`);
    }

    const [id, lang, text] = parseTsv(line);
    if (!id || !text) continue;
    if (lang === "spa") spanish.set(id, text);
    if (lang === "cmn") chinese.set(id, text);
  }

  console.log(`sentences.csv done rows=${rows} es=${spanish.size} zh=${chinese.size}`);
  return { spanish, chinese };
}

async function writePairs(spanish, chinese) {
  await mkdir(dirname(OUTPUT_PATH), { recursive: true });
  const output = createWriteStream(OUTPUT_PATH);
  const input = createReadStream(LINKS_PATH);
  const rl = readline.createInterface({ input, crlfDelay: Infinity });
  let rows = 0;
  let written = 0;
  const seen = new Set();

  for await (const line of rl) {
    rows += 1;
    if (rows % PROGRESS_INTERVAL === 0) {
      console.log(`links.csv rows=${rows} pairs=${written}`);
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
    output.write(`${JSON.stringify(pair)}\n`);
    written += 1;
  }

  await new Promise((resolve) => output.end(resolve));
  console.log(`links.csv done rows=${rows} pairs=${written} output=${OUTPUT_PATH}`);
}

async function main() {
  const { spanish, chinese } = await readSentences();
  await writePairs(spanish, chinese);
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});

