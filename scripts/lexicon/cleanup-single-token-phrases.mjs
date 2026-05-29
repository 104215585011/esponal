#!/usr/bin/env node

import "./env-loader.mjs";
import { PrismaClient } from "@prisma/client";

const PHRASE_KINDS = ["collocation", "phrase", "idiom"];

function printHelp() {
  console.log(`Usage: node scripts/lexicon/cleanup-single-token-phrases.mjs [--write]

Migrates single-token collocation/phrase/idiom LexiconEntry rows to kind=construction.

Options:
  --write   Apply updates. Without this flag the script is a dry-run.
  --help    Show this help.

Post-write self-check SQL:
  SELECT count(*) FROM lexicon_entries WHERE kind IN ('collocation','phrase','idiom') AND lemma NOT LIKE '% %';
`);
}

function hasSpace(value) {
  return /\s/.test(value.trim());
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
    const rows = await prisma.lexiconEntry.findMany({
      where: {
        kind: { in: ["collocation", "phrase", "idiom"] },
        NOT: { lemma: { contains: " " } }
      },
      orderBy: [
        { kind: "asc" },
        { lemma: "asc" }
      ]
    });

    const candidates = rows.filter((row) => !hasSpace(row.lemma));
    console.log(
      `LEX-CLEANUP-001 dryRun=${dryRun} candidates=${candidates.length}`
    );

    for (const row of candidates) {
      console.log(`${dryRun ? "would-update" : "update"} ${row.kind} -> construction ${row.lemma}`);
    }

    let updated = 0;
    if (!dryRun) {
      for (const row of candidates) {
        const existingConstruction = await prisma.lexiconEntry.findUnique({
          where: {
            kind_lemma: {
              kind: "construction",
              lemma: row.lemma
            }
          }
        });

        if (existingConstruction) {
          await prisma.lexiconEntry.delete({ where: { id: row.id } });
        } else {
          await prisma.lexiconEntry.update({
            where: { id: row.id },
            data: { kind: "construction" }
          });
        }
        updated += 1;
      }
    }

    const remaining = await prisma.lexiconEntry.count({
      where: {
        kind: { in: PHRASE_KINDS },
        NOT: { lemma: { contains: " " } }
      }
    });

    console.log(`summary updated=${updated} remaining_single_token_phrase_kind=${remaining}`);
    console.log(
      "self-check: SELECT count(*) FROM lexicon_entries WHERE kind IN ('collocation','phrase','idiom') AND lemma NOT LIKE '% %';"
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
