#!/usr/bin/env node

import "./env-loader.mjs";
import { readFile } from "node:fs/promises";
import { PrismaClient } from "@prisma/client";

const PHRASE_KINDS = ["collocation", "phrase", "idiom"];
const REVIEWED_CSV_PATH = "data/lexicon-cleanup-001.reviewed.csv";
const EXPECTED_DECISIONS = new Set(["construction", "delete", "delete-dup", "migrate-word"]);

function printHelp() {
  console.log(`Usage: node scripts/lexicon/cleanup-single-token-phrases.mjs [--write]

Reads ${REVIEWED_CSV_PATH} and applies the PM-reviewed decision for each single-token phrase-kind row.

Decisions:
  construction  Migrate 10 reviewed lemmas to kind=construction and write usage_note_zh to explanationZh.
  delete-dup    Delete phrase-kind duplicates when a same-lemma word row already exists.
  migrate-word  Convert the phrase-kind row to kind=word.
  delete        Delete imperative-form noise rows.

Options:
  --write   Apply updates inside a Prisma transaction. Without this flag the script is a dry-run.
  --help    Show this help.

Post-write self-check SQL:
  SELECT count(*) FROM lexicon_entries WHERE kind IN ('collocation','phrase','idiom') AND lemma NOT LIKE '% %';
  SELECT count(*) FROM lexicon_entries WHERE kind='construction' AND explanation_zh IS NOT NULL;
`);
}

function parseCsvLine(line) {
  const values = [];
  let current = "";
  let inQuotes = false;

  for (let index = 0; index < line.length; index += 1) {
    const char = line[index];
    if (char === '"') {
      if (inQuotes && line[index + 1] === '"') {
        current += '"';
        index += 1;
      } else {
        inQuotes = !inQuotes;
      }
      continue;
    }

    if (char === "," && !inQuotes) {
      values.push(current);
      current = "";
      continue;
    }

    current += char;
  }

  values.push(current);
  return values;
}

async function loadReviewedRows() {
  const csv = await readFile(REVIEWED_CSV_PATH, "utf8");
  const [headerLine, ...lines] = csv.trim().split(/\r?\n/);
  const headers = parseCsvLine(headerLine);

  return lines
    .filter(Boolean)
    .map((line) => {
      const values = parseCsvLine(line);
      const row = Object.fromEntries(headers.map((header, index) => [header, values[index] ?? ""]));
      return {
        lemma: row.lemma?.trim().toLowerCase(),
        current_kind: row.current_kind?.trim(),
        has_word_dup: row.has_word_dup?.trim(),
        decision: row.decision?.trim(),
        usage_note_zh: row.usage_note_zh?.trim() || null
      };
    });
}

function countByDecision(rows) {
  const counts = new Map();
  for (const row of rows) {
    counts.set(row.decision, (counts.get(row.decision) ?? 0) + 1);
  }
  return counts;
}

function printDecisionSummary(prefix, counts) {
  console.log(
    `${prefix} construction=${counts.get("construction") ?? 0} delete-dup=${counts.get("delete-dup") ?? 0} migrate-word=${counts.get("migrate-word") ?? 0} delete=${counts.get("delete") ?? 0}`
  );
}

async function main() {
  const args = new Set(process.argv.slice(2));
  if (args.has("--help") || args.has("-h")) {
    printHelp();
    return;
  }

  const dryRun = !args.has("--write");
  const prisma = new PrismaClient();

  try {
    const reviewedRows = await loadReviewedRows();
    const reviewedCounts = countByDecision(reviewedRows);
    console.log(`LEX-CLEANUP-001 dryRun=${dryRun} csvRows=${reviewedRows.length}`);
    printDecisionSummary("reviewed-counts", reviewedCounts);

    for (const row of reviewedRows) {
      if (!EXPECTED_DECISIONS.has(row.decision)) {
        throw new Error(`Unknown decision for ${row.lemma}: ${row.decision}`);
      }
    }

    const phraseRows = await prisma.lexiconEntry.findMany({
      where: {
        kind: { in: PHRASE_KINDS },
        NOT: { lemma: { contains: " " } }
      },
      orderBy: [{ kind: "asc" }, { lemma: "asc" }]
    });
    const alreadyCleanDb = phraseRows.length === 0;

    const phraseByLemma = new Map(phraseRows.map((row) => [row.lemma, row]));
    const wordRows = await prisma.lexiconEntry.findMany({
      where: {
        kind: "word",
        lemma: { in: reviewedRows.map((row) => row.lemma) }
      }
    });
    const wordByLemma = new Map(wordRows.map((row) => [row.lemma, row]));

    const operations = [];
    const missingPhraseRows = [];

    for (const row of reviewedRows) {
      const phraseRow = phraseByLemma.get(row.lemma);
      if (!phraseRow) {
        missingPhraseRows.push(row.lemma);
        if (!alreadyCleanDb) {
          console.warn(`warning missing-phrase-row lemma=${row.lemma} decision=${row.decision}`);
        }
        continue;
      }

      const wordRow = wordByLemma.get(row.lemma) ?? null;
      if (row.has_word_dup === "yes" && !wordRow && row.decision !== "delete") {
        console.warn(`warning expected-word-dup-not-found lemma=${row.lemma} decision=${row.decision}`);
      }
      if (row.has_word_dup === "no" && wordRow && row.decision !== "construction") {
        console.warn(`warning unexpected-word-dup-present lemma=${row.lemma} decision=${row.decision}`);
      }

      operations.push({
        decision: row.decision,
        lemma: row.lemma,
        usage_note_zh: row.usage_note_zh,
        phraseRow,
        wordRow
      });
    }

    const operationCounts = countByDecision(operations);
    printDecisionSummary("planned-counts", operationCounts);
    if (alreadyCleanDb) {
      console.log("already-clean-db remaining_single_token_phrase_kind=0");
    }

    for (const operation of operations) {
      if (operation.decision === "delete-dup") {
        console.log(`${dryRun ? "would-delete-dup" : "delete-dup"} ${operation.lemma}`);
        continue;
      }
      if (operation.decision === "delete") {
        console.log(`${dryRun ? "would-delete" : "delete"} ${operation.lemma}`);
        continue;
      }
      if (operation.decision === "migrate-word") {
        console.log(`${dryRun ? "would-migrate-word" : "migrate-word"} ${operation.lemma}`);
        continue;
      }

      if (operation.wordRow) {
        console.log(`${dryRun ? "would-upgrade-word-to-construction" : "upgrade-word-to-construction"} ${operation.lemma}`);
      } else {
        console.log(`${dryRun ? "would-migrate-construction" : "migrate-construction"} ${operation.lemma}`);
      }
    }

    let updated = 0;
    let deleted = 0;
    let constructionUpserts = 0;

    if (!dryRun) {
      await prisma.$transaction(async (tx) => {
        // 135 sequential row ops against remote Neon exceed Prisma's default 5s
        // interactive-transaction timeout, so raise the window. LEX-CLEANUP-001.
        for (const operation of operations) {
          if (operation.decision === "delete-dup" || operation.decision === "delete") {
            await tx.lexiconEntry.delete({ where: { id: operation.phraseRow.id } });
            deleted += 1;
            continue;
          }

          if (operation.decision === "migrate-word") {
            await tx.lexiconEntry.update({
              where: { id: operation.phraseRow.id },
              data: { kind: "word" }
            });
            updated += 1;
            continue;
          }

          if (operation.wordRow) {
            await tx.lexiconEntry.delete({ where: { id: operation.phraseRow.id } });
            await tx.lexiconEntry.update({
              where: { id: operation.wordRow.id },
              data: {
                kind: "construction",
                explanationZh: operation.usage_note_zh
              }
            });
            deleted += 1;
            updated += 1;
            constructionUpserts += 1;
            continue;
          }

          await tx.lexiconEntry.update({
            where: { id: operation.phraseRow.id },
            data: {
              kind: "construction",
              explanationZh: operation.usage_note_zh
            }
          });
          updated += 1;
          constructionUpserts += 1;
        }
      }, { maxWait: 15000, timeout: 120000 });
    }

    const remaining = await prisma.lexiconEntry.count({
      where: {
        kind: { in: PHRASE_KINDS },
        NOT: { lemma: { contains: " " } }
      }
    });
    const construction_with_usage = await prisma.lexiconEntry.count({
      where: {
        kind: "construction",
        explanationZh: { not: null }
      }
    });

    console.log(
      `summary updated=${updated} deleted=${deleted} construction_with_usage=${construction_with_usage} missing_phrase_rows=${alreadyCleanDb ? 0 : missingPhraseRows.length} remaining_single_token_phrase_kind=${remaining}`
    );
    console.log(
      "self-check: SELECT count(*) FROM lexicon_entries WHERE kind IN ('collocation','phrase','idiom') AND lemma NOT LIKE '% %';"
    );
    console.log(
      "self-check: SELECT count(*) FROM lexicon_entries WHERE kind='construction' AND explanation_zh IS NOT NULL;"
    );

    if (!dryRun && remaining !== 0) {
      throw new Error(`Self-check failed: remaining=${remaining}`);
    }
  } finally {
    await prisma.$disconnect();
  }
}

main().catch((error) => {
  console.error(error instanceof Error ? error.message : error);
  process.exitCode = 1;
});
