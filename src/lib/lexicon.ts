// Timestamp: 2026-05-28 11:35
import { Prisma, type CefrLevel, type LexiconEntry, type LexiconKind } from "@prisma/client";
import { prisma } from "@/lib/prisma";

export type LexiconUpsertInput = {
  kind?: LexiconKind;
  lemma: string;
  displayForm?: string;
  forms?: string[];
  partOfSpeech?: string | null;
  level?: CefrLevel | null;
  frequency?: number | null;
  ipa?: string | null;
  audioUrl?: string | null;
  translationZh?: string | null;
  translationEn?: string | null;
  explanationZh?: string | null;
  examples?: Prisma.InputJsonValue | null;
  morphology?: Prisma.InputJsonValue | null;
  collocations?: string[];
  sources: string[];
  licenseCode: string;
  qualityScore?: number;
};

export function normalizeLexiconText(value: string) {
  return value.trim().toLowerCase().replace(/\s+/g, " ");
}

function unique(values: string[]) {
  return [...new Set(values.filter(Boolean))];
}

function normalizeForms(lemma: string, displayForm: string, forms: string[] = []) {
  return unique([lemma, displayForm, ...forms].map(normalizeLexiconText));
}

export async function getLexiconEntry(
  lemma: string,
  kind?: LexiconKind
): Promise<LexiconEntry | null> {
  const normalized = normalizeLexiconText(lemma);
  if (!normalized) return null;

  return prisma.lexiconEntry.findFirst({
    where: {
      kind: kind ?? "word",
      OR: [
        { lemma: normalized },
        { forms: { has: normalized } }
      ]
    }
  });
}

export async function findLexiconLookupEntry(lemma: string): Promise<LexiconEntry | null> {
  const normalized = normalizeLexiconText(lemma);
  if (!normalized) return null;

  const word = await prisma.lexiconEntry.findFirst({
    where: {
      kind: "word",
      OR: [
        { lemma: normalized },
        { forms: { has: normalized } }
      ]
    }
  });
  if (word) return word;

  return prisma.lexiconEntry.findFirst({
    where: {
      kind: { in: ["collocation", "phrase", "idiom"] },
      OR: [
        { lemma: normalized },
        { forms: { has: normalized } }
      ]
    }
  });
}

export async function findRelatedPhraseEntries(lemma: string): Promise<LexiconEntry[]> {
  const normalized = normalizeLexiconText(lemma);
  if (!normalized) return [];

  const candidates = await prisma.lexiconEntry.findMany({
    where: {
      kind: { in: ["collocation", "phrase", "idiom"] },
      lemma: { contains: normalized }
    },
    orderBy: [
      { frequency: "asc" },
      { qualityScore: "desc" }
    ],
    take: 20
  });

  const tokenPattern = new RegExp(`(^|\\s)${normalized.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}(\\s|$)`);
  return candidates.filter((entry) => tokenPattern.test(entry.lemma)).slice(0, 5);
}

export async function upsertLexiconEntry(input: LexiconUpsertInput): Promise<LexiconEntry> {
  const kind = input.kind ?? "word";
  const lemma = normalizeLexiconText(input.lemma);
  const displayForm = input.displayForm ?? input.lemma.trim();
  const forms = normalizeForms(lemma, displayForm, input.forms);

  return prisma.lexiconEntry.upsert({
    where: {
      kind_lemma: { kind, lemma }
    },
    create: {
      kind,
      lemma,
      displayForm,
      forms,
      partOfSpeech: input.partOfSpeech ?? null,
      level: input.level ?? null,
      frequency: input.frequency ?? null,
      ipa: input.ipa ?? null,
      audioUrl: input.audioUrl ?? null,
      translationZh: input.translationZh ?? null,
      translationEn: input.translationEn ?? null,
      explanationZh: input.explanationZh ?? null,
      examples: input.examples ?? Prisma.JsonNull,
      morphology: input.morphology ?? Prisma.JsonNull,
      collocations: input.collocations?.map(normalizeLexiconText) ?? [],
      sources: unique(input.sources.map(normalizeLexiconText)),
      licenseCode: input.licenseCode,
      qualityScore: input.qualityScore ?? 0
    },
    update: {
      displayForm,
      forms,
      partOfSpeech: input.partOfSpeech ?? null,
      level: input.level ?? null,
      frequency: input.frequency ?? null,
      ipa: input.ipa ?? null,
      audioUrl: input.audioUrl ?? null,
      translationZh: input.translationZh ?? null,
      translationEn: input.translationEn ?? null,
      explanationZh: input.explanationZh ?? null,
      examples: input.examples ?? Prisma.JsonNull,
      morphology: input.morphology ?? Prisma.JsonNull,
      collocations: input.collocations?.map(normalizeLexiconText) ?? [],
      sources: unique(input.sources.map(normalizeLexiconText)),
      licenseCode: input.licenseCode,
      qualityScore: input.qualityScore ?? 0
    }
  });
}

export async function incrementLookupCount(id: string): Promise<void> {
  await prisma.lexiconEntry.update({
    where: { id },
    data: {
      lookupCount: { increment: 1 }
    }
  });
}
