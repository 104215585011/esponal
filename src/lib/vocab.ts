import { Prisma, WordStatus } from "@prisma/client";
import { tryConjugateVerb } from "@/lib/conjugate";
import { prisma } from "@/lib/prisma";

type CreateWordInput = {
  userId: string;
  lemma: string;
  translation: string;
  forms?: string[];
  dictData?: Prisma.InputJsonValue;
  partOfSpeech?: string | null;
  status?: WordStatus;
};

type AddEncounterInput = {
  wordId: string;
  sourceUrl: string;
  timestampSec: number;
  sourceType?: "video" | "course" | "lectura" | "dissect" | "grammar";
  courseRef?: string | null;
  originalSentence: string;
  translatedSentence: string;
};

const normalizeForms = (forms: string[] = []) =>
  Array.from(new Set(forms.map((form) => form.trim().toLowerCase()).filter(Boolean)));

function isVerbPos(partOfSpeech?: string | null) {
  return Boolean(partOfSpeech?.trim().toLowerCase().startsWith("v"));
}

function getVerbForms(lemma: string) {
  const conjugations = tryConjugateVerb(lemma);
  if (!conjugations) return [];

  return Object.values(conjugations)
    .flatMap((tense) => Object.values(tense ?? {}))
    .filter((form): form is string => typeof form === "string" && form.trim().length > 0);
}

export async function createWord({
  userId,
  lemma,
  translation,
  forms = [],
  dictData,
  partOfSpeech,
  status = WordStatus.NEW
}: CreateWordInput) {
  const normalizedLemma = lemma.trim().toLowerCase();
  const normalizedVerbForms = isVerbPos(partOfSpeech)
    ? getVerbForms(normalizedLemma)
    : [];
  const normalizedForms = normalizeForms([normalizedLemma, ...forms, ...normalizedVerbForms]);

  return prisma.word.upsert({
    where: {
      userId_lemma: {
        userId,
        lemma: normalizedLemma
      }
    },
    create: {
      userId,
      lemma: normalizedLemma,
      translation: translation.trim(),
      forms: normalizedForms,
      dictData,
      partOfSpeech,
      status
    },
    update: {
      translation: translation.trim(),
      forms: normalizedForms,
      ...(dictData ? { dictData } : {}),
      ...(partOfSpeech ? { partOfSpeech } : {}),
      status
    }
  });
}

export async function addEncounter({
  wordId,
  sourceUrl,
  timestampSec,
  sourceType = "video",
  courseRef,
  originalSentence,
  translatedSentence
}: AddEncounterInput) {
  return prisma.wordEncounter.create({
    data: {
      wordId,
      sourceUrl,
      timestampSec,
      sourceType,
      courseRef,
      originalSentence,
      translatedSentence
    }
  });
}

export async function getWordsByUser(userId: string) {
  return prisma.word.findMany({
    where: {
      userId
    },
    include: {
      encounters: {
        orderBy: {
          createdAt: "desc"
        }
      }
    },
    orderBy: {
      lemma: "asc"
    }
  });
}

export async function getDueReviewCount(userId: string, now = new Date()) {
  try {
    const dueCount = await prisma.word.count({
      where: {
        userId,
        srsState: {
          not: null
        },
        srsDue: {
          lte: now
        }
      }
    });
    const newCount = await prisma.word.count({
      where: {
        userId,
        srsState: null
      }
    });

    return dueCount + Math.min(newCount, 10);
  } catch {
    // SRS migration not yet applied to this database
    return 0;
  }
}

export async function getDueReviewWords(userId: string, now = new Date()) {
  try {
    const dueWords = await prisma.word.findMany({
      where: {
        userId,
        srsState: {
          not: null
        },
        srsDue: {
          lte: now
        }
      },
      orderBy: [{ srsDue: "asc" }, { createdAt: "asc" }],
      take: 20
    });

    const slotsForNew = Math.max(0, Math.min(10, 20 - dueWords.length));
    const newWords = slotsForNew
      ? await prisma.word.findMany({
          where: {
            userId,
            srsState: null
          },
          orderBy: {
            createdAt: "asc"
          },
          take: slotsForNew
        })
      : [];

    return [...dueWords, ...newWords];
  } catch {
    // SRS migration not yet applied to this database
    return [];
  }
}

export async function getWordWithEncounters(userId: string, lemma: string) {
  return prisma.word.findUnique({
    where: {
      userId_lemma: {
        userId,
        lemma: lemma.trim().toLowerCase()
      }
    },
    include: {
      encounters: {
        orderBy: {
          createdAt: "desc"
        }
      }
    }
  });
}
