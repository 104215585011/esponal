import { PrismaClient } from "@prisma/client";
import { tryConjugateVerb } from "../src/lib/conjugate.ts";

const prisma = new PrismaClient();

function normalizeForms(forms = []) {
  return Array.from(
    new Set(
      forms
        .filter((form) => typeof form === "string")
        .map((form) => form.trim().toLowerCase())
        .filter(Boolean)
    )
  );
}

function collectVerbForms(lemma) {
  const conjugations = tryConjugateVerb(lemma);
  if (!conjugations) return [];

  return Object.values(conjugations)
    .flatMap((tense) => Object.values(tense ?? {}))
    .filter((form) => typeof form === "string" && form.trim().length > 0);
}

function sameForms(left, right) {
  if (left.length !== right.length) return false;
  return left.every((value, index) => value === right[index]);
}

async function main() {
  const words = await prisma.word.findMany({
    where: {
      partOfSpeech: {
        not: null
      }
    },
    select: {
      id: true,
      lemma: true,
      forms: true,
      partOfSpeech: true
    }
  });

  const verbs = words.filter((word) => word.partOfSpeech?.trim().toLowerCase().startsWith("v"));
  let updated = 0;

  for (const [index, word] of verbs.entries()) {
    const normalizedForms = normalizeForms([
      word.lemma,
      ...word.forms,
      ...collectVerbForms(word.lemma)
    ]);

    if (!sameForms(word.forms, normalizedForms)) {
      await prisma.word.update({
        where: {
          id: word.id
        },
        data: {
          forms: normalizedForms
        }
      });
      updated += 1;
    }

    console.log(`Processed ${index + 1}/${verbs.length}: ${word.lemma}`);
  }

  console.log(`Backfilled verb forms: processed ${verbs.length}/${verbs.length}, updated ${updated}.`);
}

main()
  .catch((error) => {
    console.error("Backfill verb forms failed", error);
    process.exitCode = 1;
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
