import { Prisma, WordStatus } from "@prisma/client";
import { tryConjugateVerb } from "@/lib/conjugate";
import { normalizeLanguage, resolveRequestLanguage } from "@/lib/languages";
import { prisma } from "@/lib/prisma";

type CreateWordInput = {
  userId: string;
  language?: string;
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
  sourceType?: "video" | "course" | "lectura" | "dissect" | "grammar" | "import" | "talk";
  courseRef?: string | null;
  originalSentence: string;
  translatedSentence: string;
};

export type VocabSourceType =
  | "video"
  | "course"
  | "lectura"
  | "dissect"
  | "grammar"
  | "talk";

export type VocabEncounterBucket = {
  label: string;
  min: number;
  max: number | null;
  count: number;
};

export type VocabSourceStat = {
  type: VocabSourceType;
  label: string;
  count: number;
};

export type VocabStats = {
  totalSaved: number;
  encounterBuckets: VocabEncounterBucket[];
  weeklyNew: number;
  bySource: VocabSourceStat[];
};

const normalizeForms = (forms: string[] = []) =>
  Array.from(new Set(forms.map((form) => form.trim().toLowerCase()).filter(Boolean)));

const VOCAB_ENCOUNTER_BUCKETS = [
  { label: "1 次", min: 1, max: 1 },
  { label: "2 次", min: 2, max: 2 },
  { label: "3-5 次", min: 3, max: 5 },
  { label: "6+ 次", min: 6, max: null }
] as const;

const VOCAB_SOURCE_LABELS: Record<VocabSourceType, string> = {
  lectura: "阅读",
  video: "视频",
  talk: "对话",
  course: "课程",
  grammar: "语法",
  dissect: "拆解"
};

const VOCAB_SOURCE_ORDER: VocabSourceType[] = [
  "lectura",
  "video",
  "talk",
  "course",
  "grammar",
  "dissect"
];

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
  language,
  lemma,
  translation,
  forms = [],
  dictData,
  partOfSpeech,
  status = WordStatus.NEW
}: CreateWordInput) {
  const lang = normalizeLanguage(language);
  const normalizedLemma = lemma.trim().toLowerCase();
  const normalizedVerbForms =
    lang === "es" && isVerbPos(partOfSpeech) ? getVerbForms(normalizedLemma) : [];
  const normalizedForms = normalizeForms([normalizedLemma, ...forms, ...normalizedVerbForms]);

  return prisma.word.upsert({
    where: {
      userId_language_lemma: {
        userId,
        language: lang,
        lemma: normalizedLemma
      }
    },
    create: {
      userId,
      language: lang,
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

export async function getWordsByUser(userId: string, language?: string) {
  const lang = language
    ? normalizeLanguage(language)
    : await resolveRequestLanguage(null, undefined, userId);

  return prisma.word.findMany({
    where: {
      userId,
      language: lang
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

export async function getDueReviewCount(userId: string, now = new Date(), language?: string) {
  try {
    const lang = language
      ? normalizeLanguage(language)
      : await resolveRequestLanguage(null, undefined, userId);

    const dueCount = await prisma.word.count({
      where: {
        userId,
        language: lang,
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
        language: lang,
        srsState: null
      }
    });

    return dueCount + Math.min(newCount, 10);
  } catch {
    // SRS migration not yet applied to this database
    return 0;
  }
}

export async function getDueReviewWords(
  userId: string,
  now = new Date(),
  limit = 20,
  language?: string
) {
  // 上限 50:一次拉太多,session 中途断了浪费;客户端要更多就自己再取一批
  const batchSize = Math.max(1, Math.min(50, Math.floor(limit)));
  try {
    const lang = language
      ? normalizeLanguage(language)
      : await resolveRequestLanguage(null, undefined, userId);

    const dueWords = await prisma.word.findMany({
      where: {
        userId,
        language: lang,
        srsState: {
          not: null
        },
        srsDue: {
          lte: now
        }
      },
      include: {
        encounters: {
          orderBy: { createdAt: "desc" },
          take: 2
        }
      },
      orderBy: [{ srsDue: "asc" }, { createdAt: "asc" }],
      take: batchSize
    });

    const slotsForNew = Math.max(0, Math.min(10, batchSize - dueWords.length));
    const newWords = slotsForNew
      ? await prisma.word.findMany({
          where: {
            userId,
            language: lang,
            srsState: null
          },
          include: {
            encounters: {
              orderBy: { createdAt: "desc" },
              take: 2
            }
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

export async function getWordWithEncounters(
  userId: string,
  lemma: string,
  language?: string
) {
  const lang = language
    ? normalizeLanguage(language)
    : await resolveRequestLanguage(null, undefined, userId);

  return prisma.word.findUnique({
    where: {
      userId_language_lemma: {
        userId,
        language: lang,
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

export async function getVocabStats(
  userId: string,
  now = new Date(),
  language?: string
): Promise<VocabStats> {
  const lang = language
    ? normalizeLanguage(language)
    : await resolveRequestLanguage(null, undefined, userId);
  const weekAgo = new Date(now);
  weekAgo.setDate(weekAgo.getDate() - 7);

  const [totalSaved, weeklyNew, words, sourceGroups] = await Promise.all([
    prisma.word.count({
      where: { userId, language: lang }
    }),
    prisma.word.count({
      where: {
        userId,
        language: lang,
        createdAt: {
          gte: weekAgo
        }
      }
    }),
    prisma.word.findMany({
      where: { userId, language: lang },
      select: {
        id: true,
        _count: {
          select: {
            encounters: true
          }
        }
      }
    }),
    prisma.wordEncounter.groupBy({
      by: ["sourceType"],
      where: {
        word: {
          userId,
          language: lang
        }
      },
      _count: {
        _all: true
      }
    })
  ]);

  const encounterBuckets = VOCAB_ENCOUNTER_BUCKETS.map((bucket) => ({
    label: bucket.label,
    min: bucket.min,
    max: bucket.max,
    count: words.filter((word) => {
      const encounterCount = word._count.encounters;
      if (encounterCount < bucket.min) return false;
      if (bucket.max !== null && encounterCount > bucket.max) return false;
      return true;
    }).length
  }));

  const groupedCounts = new Map(
    sourceGroups.map((group) => [group.sourceType, group._count._all] as const)
  );

  const bySource = VOCAB_SOURCE_ORDER.flatMap((type) => {
    const count = groupedCounts.get(type) ?? 0;
    if (count <= 0) return [];

    return [
      {
        type,
        label: VOCAB_SOURCE_LABELS[type],
        count
      }
    ];
  });

  return {
    totalSaved,
    encounterBuckets,
    weeklyNew,
    bySource
  };
}
