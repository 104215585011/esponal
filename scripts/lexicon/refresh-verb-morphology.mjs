#!/usr/bin/env node
// Timestamp: 2026-05-29 23:28
import { mkdir, readFile, writeFile } from "node:fs/promises";
import { dirname } from "node:path";
import { pathToFileURL } from "node:url";
import { PrismaClient } from "@prisma/client";
import { loadEnvFiles } from "./env-loader.mjs";
import { callDeepSeekLexicon, normalizeB1Payload, normalizeText, unique } from "./real-morphology.mjs";

const PROGRESS_PATH = "data/lexicon-verb-refresh-progress.json";
const DEFAULT_SKIPPED = "data/lexicon-verb-refresh-skipped.json";
const DEFAULT_CONCURRENCY = 2;
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
  console.log(`Usage: node scripts/lexicon/refresh-verb-morphology.mjs [options]

Refreshes existing verb LexiconEntry morphology/forms with real conjugations.

Safe by default: this script runs as a dry-run unless --write is provided.

Options:
  --write             Actually update LexiconEntry rows in the database.
  --dry-run           Print before/after payloads only. This is also the default.
  --lemmas a,b,c      Restrict to specific lemmas.
  --limit N           Process at most N entries.
  --resume            Skip entries recorded in data/lexicon-verb-refresh-progress.json.
  --skipped PATH      Skipped report path. Default: data/lexicon-verb-refresh-skipped.json.
  --concurrency N     DeepSeek/write concurrency. Default: 2.
  --help, -h          Show this help text.`);
}

function getPrisma() {
  prisma ??= new PrismaClient();
  return prisma;
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

async function loadVerbRows() {
  const mock = process.env.LEXICON_REFRESH_MOCK_ROWS;
  if (mock) return JSON.parse(mock);

  return await getPrisma().lexiconEntry.findMany({
    where: {
      kind: { in: ["word", "construction"] },
      OR: [
        { partOfSpeech: "verb" },
        { partOfSpeech: "v." }
      ]
    },
    orderBy: { lemma: "asc" }
  });
}

function shouldRefreshVerbRow(row) {
  const lemma = normalizeText(row.lemma);
  return lemma.length > 1;
}

function buildVerbContext(row) {
  const notes = [];
  const lemma = normalizeText(row.lemma);
  if (lemma.endsWith("se")) {
    notes.push("This is a reflexive verb. Keep canonicalLemma with the se suffix, and return a complete six-person paradigm for every tense with real Spanish reflexive conjugations.");
  }
  if (/[áéíóúü]/i.test(row.lemma)) {
    notes.push("Preserve accents and diaeresis exactly in the infinitive and conjugated forms, and do not omit uncommon persons such as nosotros or vosotros.");
  }
  return {
    existingPartOfSpeech: row.partOfSpeech,
    existingForms: row.forms,
    note: notes.join(" ")
  };
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

async function main() {
  if (hasFlag("--help") || hasFlag("-h")) {
    printUsage();
    return;
  }

  const write = hasFlag("--write");
  const dryRun = !write;
  const limit = Number(readOption("--limit", "0"));
  const skippedPath = readOption("--skipped", DEFAULT_SKIPPED);
  const concurrency = Number(readOption("--concurrency", String(DEFAULT_CONCURRENCY)));
  const explicit = readOption("--lemmas");
  const explicitSet = explicit ? new Set(explicit.split(",").map(normalizeText).filter(Boolean)) : null;
  await loadEnvFiles();

  const progress = await readProgress();
  const done = new Set(progress.done ?? []);
  let rows = (await loadVerbRows()).filter((row) => !done.has(row.lemma) && shouldRefreshVerbRow(row));
  if (explicitSet) rows = rows.filter((row) => explicitSet.has(normalizeText(row.lemma)));
  const selected = limit > 0 ? rows.slice(0, limit) : rows;
  const stats = { written: 0, dryRun: 0, skipped: 0 };
  const skipped = [];
  console.log(`Refresh verb candidates=${rows.length} selected=${selected.length} dryRun=${dryRun}`);

  await runPool(selected, Math.max(1, concurrency), async (row) => {
    try {
      const raw = await callDeepSeekLexicon(row.lemma, buildVerbContext(row));
      const payload = normalizeB1Payload(row.lemma, {
        ...raw,
        partOfSpeech: raw.partOfSpeech || "verb",
        canonicalLemma: raw.canonicalLemma || row.lemma,
        cefr: raw.cefr || row.level || "B1",
        translationZh: raw.translationZh || row.translationZh || "保持原释义"
      });
      if (payload.partOfSpeech !== "verb") throw new Error(`${row.lemma} did not return verb morphology`);
      const update = {
        forms: unique([payload.lemma, ...payload.forms]),
        morphology: payload.morphology,
        partOfSpeech: "verb"
      };

      if (dryRun) {
        console.log(JSON.stringify({
          lemma: row.lemma,
          kind: row.kind,
          beforeForms: row.forms ?? [],
          afterForms: update.forms,
          beforeMorphology: row.morphology ?? null,
          afterMorphology: update.morphology
        }));
        stats.dryRun += 1;
      } else {
        await getPrisma().lexiconEntry.update({
          where: { id: row.id },
          data: update
        });
        done.add(row.lemma);
        progress.done = [...done];
        await writeProgress(progress);
        console.log(`Refreshed verb morphology ${row.lemma}`);
        stats.written += 1;
      }
    } catch (error) {
      const reason = error instanceof Error ? error.message : String(error);
      skipped.push({ lemma: row.lemma, reason, at: new Date().toISOString() });
      stats.skipped += 1;
    }
  });

  await writeSkipped(skippedPath, skipped);
  console.log(`Refresh verb summary written=${stats.written} dryRun=${stats.dryRun} skipped=${stats.skipped}`);
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
