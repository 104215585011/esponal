#!/usr/bin/env node
// Timestamp: 2026-05-29 23:28
import { mkdir, readFile, writeFile } from "node:fs/promises";
import { dirname } from "node:path";
import { pathToFileURL } from "node:url";
import { PrismaClient } from "@prisma/client";
import { loadEnvFiles } from "./env-loader.mjs";
import { callDeepSeekLexicon, normalizeB1Payload, normalizeText, unique } from "./real-morphology.mjs";

const DEFAULT_INPUT = "data/wordlist-b1-candidates.csv";
const DEFAULT_SKIPPED = "data/lexicon-b1-skipped.json";
const PROGRESS_PATH = "data/lexicon-b1-progress.json";
const TARGET_LEVELS = new Set(["A1", "A2", "B1", "B2", "C1"]);
const DEFAULT_CONCURRENCY = 3;
let prisma;

function readOption(name, fallback = undefined) {
  const index = process.argv.indexOf(name);
  if (index === -1) return fallback;
  return process.argv[index + 1] ?? fallback;
}

function hasFlag(name) {
  return process.argv.includes(name);
}

function printUsage() {
  console.log(`Usage: node scripts/lexicon/seed-b1-words.mjs [options]

Seeds B1-C1 LexiconEntry word rows from data/wordlist-b1-candidates.csv.

Safe by default: this script runs as a dry-run unless --write is provided.

Options:
  --write             Actually write LexiconEntry rows to the database.
  --dry-run           Print payloads only. This is also the default.
  --input PATH        Candidate CSV path. Default: data/wordlist-b1-candidates.csv.
  --skipped PATH      Skipped report path. Default: data/lexicon-b1-skipped.json.
  --limit N           Process at most N candidates.
  --resume            Skip lemmas recorded in data/lexicon-b1-progress.json.
  --concurrency N     DeepSeek/write concurrency. Default: 3.
  --help, -h          Show this help text.`);
}

function getPrisma() {
  prisma ??= new PrismaClient();
  return prisma;
}

function parseCsv(text) {
  const lines = String(text).trim().split(/\r?\n/).filter(Boolean);
  return lines.slice(1).map((line) => {
    const [lemma, freqRank, rawFreq, sourceForms, sourceCount] = line.split(",");
    return {
      lemma: normalizeText(lemma),
      frequency: Number(freqRank),
      rawFreq: Number(rawFreq),
      sourceForms: String(sourceForms ?? "").split("|").map(normalizeText).filter(Boolean),
      sourceCount: Number(sourceCount)
    };
  }).filter((row) => row.lemma);
}

async function readProgress() {
  if (!hasFlag("--resume")) return { done: [] };
  try {
    return JSON.parse(await readFile(PROGRESS_PATH, "utf8"));
  } catch {
    return { done: [] };
  }
}

async function writeProgress(progress) {
  await mkdir(dirname(PROGRESS_PATH), { recursive: true });
  await writeFile(PROGRESS_PATH, `${JSON.stringify(progress, null, 2)}\n`, "utf8");
}

async function writeSkipped(path, skipped) {
  await mkdir(dirname(path), { recursive: true });
  await writeFile(path, `${JSON.stringify({ updatedAt: new Date().toISOString(), skipped }, null, 2)}\n`, "utf8");
}

async function runPool(items, concurrency, worker) {
  let cursor = 0;
  const workers = Array.from({ length: concurrency }, async () => {
    while (cursor < items.length) {
      const item = items[cursor];
      cursor += 1;
      await worker(item);
    }
  });
  await Promise.all(workers);
}

function assertSeedable(payload) {
  if (!payload.isSpanishWord) throw new Error(payload.skipReason || "not Spanish");
  if (payload.isProperNoun) throw new Error(payload.skipReason || "proper noun");
  if (!TARGET_LEVELS.has(payload.level)) throw new Error(payload.skipReason || `outside target CEFR: ${payload.level || "unknown"}`);
  if (!payload.partOfSpeech) throw new Error("missing normalized partOfSpeech");
  if (!payload.translationZh) throw new Error("missing translationZh");
  if (payload.examples.length === 0) throw new Error("missing examples");
}

async function upsertLexiconEntry(input) {
  return getPrisma().lexiconEntry.upsert({
    where: { kind_lemma: { kind: "word", lemma: input.lemma } },
    create: { kind: "word", ...input },
    update: input
  });
}

async function main() {
  if (hasFlag("--help") || hasFlag("-h")) {
    printUsage();
    return;
  }

  const write = hasFlag("--write");
  const dryRun = !write;
  const inputPath = readOption("--input", DEFAULT_INPUT);
  const skippedPath = readOption("--skipped", DEFAULT_SKIPPED);
  const limit = Number(readOption("--limit", "0"));
  const concurrency = Number(readOption("--concurrency", String(DEFAULT_CONCURRENCY)));
  await loadEnvFiles();

  const progress = await readProgress();
  const done = new Set(progress.done ?? []);
  const candidates = parseCsv(await readFile(inputPath, "utf8")).filter((row) => !done.has(row.lemma));
  const selected = limit > 0 ? candidates.slice(0, limit) : candidates;
  const stats = { written: 0, dryRun: 0, skipped: 0 };
  const skipped = [];
  console.log(`B1 seed candidates=${candidates.length} selected=${selected.length} dryRun=${dryRun}`);

  await runPool(selected, Math.max(1, concurrency), async (candidate) => {
    try {
      const raw = await callDeepSeekLexicon(candidate.lemma, {
        frequencyRank: candidate.frequency,
        sourceForms: candidate.sourceForms
      });
      const payload = normalizeB1Payload(candidate.lemma, raw);
      assertSeedable(payload);
      const input = {
        lemma: payload.lemma,
        displayForm: payload.displayForm,
        forms: unique([...payload.forms, ...candidate.sourceForms]),
        partOfSpeech: payload.partOfSpeech,
        level: payload.level,
        frequency: candidate.frequency,
        ipa: payload.ipa,
        translationZh: payload.translationZh,
        translationEn: payload.translationEn,
        explanationZh: payload.explanationZh,
        examples: payload.examples,
        morphology: payload.morphology,
        collocations: [],
        sources: unique(["frequencywords-mit", "llm-deepseek", ...payload.examples.map((example) => example.source)]),
        licenseCode: "MIT-FrequencyWords+LLM",
        qualityScore: 1
      };

      if (dryRun) {
        console.log(JSON.stringify(input));
        stats.dryRun += 1;
      } else {
        await upsertLexiconEntry(input);
        done.add(candidate.lemma);
        progress.done = [...done];
        await writeProgress(progress);
        console.log(`Wrote B1 LexiconEntry ${payload.lemma}`);
        stats.written += 1;
      }
    } catch (error) {
      const reason = error instanceof Error ? error.message : String(error);
      skipped.push({ lemma: candidate.lemma, reason, at: new Date().toISOString() });
      stats.skipped += 1;
    }
  });

  await writeSkipped(skippedPath, skipped);
  console.log(`Seed B1 summary written=${stats.written} dryRun=${stats.dryRun} skipped=${stats.skipped}`);
  if (skipped.length > 0) console.log(`Skipped report: ${skippedPath}`);
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  main().catch((error) => {
    console.error(error);
    process.exitCode = 1;
  }).finally(async () => {
    if (prisma) await prisma.$disconnect();
  });
}
