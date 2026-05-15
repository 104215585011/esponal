import { Prisma, WordStatus } from "@prisma/client";
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
  sourceType?: "video" | "course";
  courseRef?: string | null;
  originalSentence: string;
  translatedSentence: string;
};

const normalizeForms = (forms: string[] = []) =>
  Array.from(new Set(forms.map((form) => form.trim()).filter(Boolean)));

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
  const normalizedForms = normalizeForms([normalizedLemma, ...forms]);

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
