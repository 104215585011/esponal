#!/usr/bin/env node
// Timestamp: 2026-05-28 19:12
import { PrismaClient } from "@prisma/client";
import { pathToFileURL } from "node:url";
import { ALLOWED_WORD_PARTS_OF_SPEECH, normalizeLexiconPartOfSpeech } from "./pos-normalize.mjs";

let prisma;

function hasFlag(name) {
  return process.argv.includes(name);
}

function printUsage() {
  console.log(`Usage: node scripts/lexicon/normalize-lexicon-pos.mjs [options]

Normalizes LexiconEntry word partOfSpeech values to the LEX-001 whitelist.

Safe by default: this script runs as a dry-run unless --write is provided.

Options:
  --write       Update dirty LexiconEntry rows in the database.
  --dry-run     Print planned updates only. This is also the default.
  --help, -h    Show this help text.`);
}

function getPrisma() {
  prisma ??= new PrismaClient();
  return prisma;
}

export function planLexiconPosNormalization(rows) {
  const updates = [];
  const unknown = [];
  let valid = 0;

  for (const row of rows) {
    const current = String(row.partOfSpeech ?? "").trim();
    if (!current) {
      valid += 1;
      continue;
    }

    const normalized = normalizeLexiconPartOfSpeech(current);
    if (!normalized) {
      unknown.push({ id: row.id, lemma: row.lemma, partOfSpeech: current });
      continue;
    }

    if (normalized === current && ALLOWED_WORD_PARTS_OF_SPEECH.has(current)) {
      valid += 1;
      continue;
    }

    updates.push({ id: row.id, lemma: row.lemma, from: current, to: normalized });
  }

  return { updates, unknown, valid };
}

async function main() {
  if (hasFlag("--help") || hasFlag("-h")) {
    printUsage();
    return;
  }

  const write = hasFlag("--write");
  const rows = await getPrisma().lexiconEntry.findMany({
    where: { kind: "word" },
    select: { id: true, lemma: true, partOfSpeech: true },
    orderBy: { lemma: "asc" }
  });
  const plan = planLexiconPosNormalization(rows);

  console.log(
    `Lexicon POS normalization rows=${rows.length} valid=${plan.valid} updates=${plan.updates.length} unknown=${plan.unknown.length} dryRun=${!write}`
  );
  for (const update of plan.updates) {
    console.log(`${update.lemma}: ${update.from} -> ${update.to}`);
  }
  for (const item of plan.unknown) {
    console.warn(`[unknown] ${item.lemma}: ${item.partOfSpeech}`);
  }

  if (!write) return;

  for (const update of plan.updates) {
    await getPrisma().lexiconEntry.update({
      where: { id: update.id },
      data: { partOfSpeech: update.to }
    });
  }
  console.log(`Updated ${plan.updates.length} LexiconEntry rows`);
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  main().catch((error) => {
    console.error(error);
    process.exitCode = 1;
  }).finally(async () => {
    if (prisma) await prisma.$disconnect();
  });
}
