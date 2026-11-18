// Timestamp: 2026-11-18 16:35
import { Prisma, WordStatus, type Word } from "@prisma/client";
import { tryConjugateVerb } from "@/lib/conjugate";
import { normalizeLanguage, resolveRequestLanguage } from "@/lib/languages";
import { prisma } from "@/lib/prisma";
import {
  buildContextCloze,
  buildNounArticleCue,
  detectSpanishCognateHint,
  isLowFrequencyWordCandidate,
  scoreNewReviewPriority,
  type CognateHint,
  type ContextCloze,
  type NounArticleCue
} from "@/lib/vocab-learning";

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

    const [dueWordCount, newWordCount, duePhraseCount, newPhraseCount] = await Promise.all([
      prisma.word.count({
        where: {
          userId,
          language: lang,
          status: { not: WordStatus.KNOWN },
          srsState: { not: null },
          srsDue: { lte: now }
        }
      }),
      prisma.word.count({
        where: {
          userId,
          language: lang,
          status: { not: WordStatus.KNOWN },
          srsState: null
        }
      }),
      prisma.savedPhrase
        .count({
          where: {
            userId,
            language: lang,
            status: { not: WordStatus.KNOWN },
            srsState: { not: null },
            srsDue: { lte: now }
          }
        })
        .catch(() => 0),
      prisma.savedPhrase
        .count({
          where: {
            userId,
            language: lang,
            status: { not: WordStatus.KNOWN },
            srsState: null
          }
        })
        .catch(() => 0)
    ]);

    return dueWordCount + duePhraseCount + Math.min(newWordCount + newPhraseCount, 10);
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
        status: { not: WordStatus.KNOWN },
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
    const candidateNewWords = slotsForNew
      ? await prisma.word.findMany({
          where: {
            userId,
            language: lang,
            status: { not: WordStatus.KNOWN },
            srsState: null
          },
          include: {
            encounters: {
              orderBy: { createdAt: "desc" },
              take: 3
            },
            _count: {
              select: { encounters: true }
            }
          },
          orderBy: {
            createdAt: "asc"
          },
          take: Math.max(slotsForNew, 50)
        })
      : [];

    if (candidateNewWords.length <= slotsForNew) {
      return [...dueWords, ...candidateNewWords];
    }

    const lexRows = await prisma.lexiconEntry
      .findMany({
        where: {
          language: lang,
          lemma: { in: candidateNewWords.map((w) => w.lemma) }
        },
        select: { lemma: true, level: true, frequency: true }
      })
      .catch(() => []);
    const lexMap = new Map(lexRows.map((row) => [row.lemma, row]));

    const prioritizedNew = [...candidateNewWords]
      .sort((a, b) => {
        const lexA = lexMap.get(a.lemma);
        const lexB = lexMap.get(b.lemma);
        const cogA = lang === "es" ? detectSpanishCognateHint(a.lemma) : null;
        const cogB = lang === "es" ? detectSpanishCognateHint(b.lemma) : null;
        const scoreA = scoreNewReviewPriority({
          itemType: "word",
          encounterCount: a._count.encounters,
          lexiconLevel: lexA?.level ?? null,
          lexiconFrequency: lexA?.frequency ?? null,
          isEasyCognate: Boolean(cogA?.isCognate),
          createdAtMs: a.createdAt.getTime()
        }).score;
        const scoreB = scoreNewReviewPriority({
          itemType: "word",
          encounterCount: b._count.encounters,
          lexiconLevel: lexB?.level ?? null,
          lexiconFrequency: lexB?.frequency ?? null,
          isEasyCognate: Boolean(cogB?.isCognate),
          createdAtMs: b.createdAt.getTime()
        }).score;
        return scoreB - scoreA;
      })
      .slice(0, slotsForNew);

    return [...dueWords, ...prioritizedNew];
  } catch {
    // SRS migration not yet applied to this database
    return [];
  }
}

export type ReviewQueueEncounter = {
  id: string;
  sourceType: string;
  sourceUrl: string;
  timestampSec: number;
  originalSentence: string;
  translatedSentence: string;
  createdAt: string;
};

export type ReviewQueueItem = {
  id: string;
  itemType: "word" | "phrase";
  phraseKind?: string | null;
  language: string;
  lemma: string;
  forms: string[];
  translation: string;
  partOfSpeech: string | null;
  dictData: unknown;
  status: string;
  srsDue: string | null;
  srsState: string | null;
  srsReps: number;
  srsLapses: number;
  encounters: ReviewQueueEncounter[];
  encounterCount: number;
  encounterForm: string | null;
  articleCue: NounArticleCue | null;
  cloze: ContextCloze | null;
  cognateHint: CognateHint | null;
  frequencyLevel: string | null;
  lexiconFrequency: number | null;
  priorityReason: string | null;
  isLowFrequency: boolean;
};

type WordWithEncountersRow = Word & {
  encounters?: Array<{
    id: string;
    sourceType: string;
    sourceUrl: string;
    timestampSec: number;
    originalSentence: string;
    translatedSentence: string;
    createdAt: Date;
  }>;
  _count?: { encounters: number };
};

export async function enrichDueReviewQueue(params: {
  userId: string;
  language: string;
  now: Date;
  limit: number;
  wordItems: WordWithEncountersRow[];
}): Promise<ReviewQueueItem[]> {
  const { userId, language, now, limit, wordItems } = params;
  const lang = normalizeLanguage(language);
  const batchSize = Math.max(1, Math.min(50, Math.floor(limit)));

  const duePhraseRows = await prisma.savedPhrase
    .findMany({
      where: {
        userId,
        language: lang,
        status: { not: WordStatus.KNOWN },
        srsState: { not: null },
        srsDue: { lte: now }
      },
      orderBy: [{ srsDue: "asc" }, { createdAt: "asc" }],
      take: Math.min(10, batchSize)
    })
    .catch(() => []);

  const newPhraseRows = await prisma.savedPhrase
    .findMany({
      where: {
        userId,
        language: lang,
        status: { not: WordStatus.KNOWN },
        srsState: null
      },
      orderBy: { createdAt: "asc" },
      take: 25
    })
    .catch(() => []);

  const allLemmas = Array.from(
    new Set([
      ...wordItems.map((w) => w.lemma),
      ...duePhraseRows.map((p) => p.lemma),
      ...newPhraseRows.map((p) => p.lemma)
    ])
  );

  const [lexRows, encounterCounts] = await Promise.all([
    allLemmas.length > 0
      ? prisma.lexiconEntry
          .findMany({
            where: { language: lang, lemma: { in: allLemmas } },
            select: { lemma: true, level: true, frequency: true, examples: true }
          })
          .catch(() => [])
      : [],
    wordItems.length > 0
      ? prisma.wordEncounter
          .groupBy({
            by: ["wordId"],
            where: { wordId: { in: wordItems.map((w) => w.id) } },
            _count: { _all: true }
          })
          .catch(() => [])
      : []
  ]);

  const lexMap = new Map(lexRows.map((row) => [row.lemma, row]));
  const countMap = new Map(encounterCounts.map((row) => [row.wordId, row._count._all]));

  const mapWord = (word: WordWithEncountersRow): ReviewQueueItem & { _priority: number } => {
    const lex = lexMap.get(word.lemma);
    const encList = word.encounters ?? [];
    const encounterCount = word._count?.encounters ?? countMap.get(word.id) ?? encList.length;
    const dictObj =
      word.dictData && typeof word.dictData === "object"
        ? (word.dictData as {
            meanings?: string[];
            examples?: Array<{ es: string; zh: string }>;
          })
        : null;
    const cognateHint =
      lang === "es" ? detectSpanishCognateHint(word.lemma, dictObj?.meanings ?? []) : null;
    const articleCue = buildNounArticleCue({
      lemma: word.lemma,
      partOfSpeech: word.partOfSpeech,
      dictData: word.dictData,
      language: lang
    });

    const firstEncounter = encList[0];
    const clozeFromEncounter = firstEncounter
      ? buildContextCloze({
          sentence: firstEncounter.originalSentence,
          translatedSentence: firstEncounter.translatedSentence,
          lemma: word.lemma,
          forms: word.forms
        })
      : null;
    const firstExample = dictObj?.examples?.[0];
    const cloze =
      clozeFromEncounter ??
      (firstExample
        ? buildContextCloze({
            sentence: firstExample.es,
            translatedSentence: firstExample.zh,
            lemma: word.lemma,
            forms: word.forms
          })
        : null);

    const priorityInfo = scoreNewReviewPriority({
      itemType: "word",
      encounterCount,
      lexiconLevel: lex?.level ?? null,
      lexiconFrequency: lex?.frequency ?? null,
      isEasyCognate: Boolean(cognateHint?.isCognate),
      createdAtMs: word.createdAt.getTime()
    });
    const isLowFrequency = isLowFrequencyWordCandidate({
      encounterCount,
      lexiconLevel: lex?.level ?? null,
      lexiconFrequency: lex?.frequency ?? null,
      srsLapses: word.srsLapses
    });

    return {
      id: word.id,
      itemType: "word",
      phraseKind: null,
      language: word.language,
      lemma: word.lemma,
      forms: word.forms,
      translation: word.translation,
      partOfSpeech: word.partOfSpeech,
      dictData: word.dictData,
      status: word.status,
      srsDue: word.srsDue?.toISOString() ?? null,
      srsState: word.srsState,
      srsReps: word.srsReps,
      srsLapses: word.srsLapses,
      encounters: encList.map((e) => ({
        id: e.id,
        sourceType: e.sourceType,
        sourceUrl: e.sourceUrl,
        timestampSec: e.timestampSec,
        originalSentence: e.originalSentence,
        translatedSentence: e.translatedSentence,
        createdAt: e.createdAt.toISOString()
      })),
      encounterCount,
      encounterForm: cloze?.answerForm ?? word.forms.find((f) => f !== word.lemma) ?? null,
      articleCue,
      cloze,
      cognateHint,
      frequencyLevel: lex?.level ?? null,
      lexiconFrequency: lex?.frequency ?? null,
      priorityReason:
        priorityInfo.priorityReason ??
        (isLowFrequency && word.srsLapses >= 2 ? "屡忘低频词 · 可暂缓" : null),
      isLowFrequency,
      _priority: priorityInfo.score
    };
  };

  const mapPhrase = (phrase: (typeof duePhraseRows)[number]): ReviewQueueItem & { _priority: number } => {
    const lex = lexMap.get(phrase.lemma);
    const dataObj =
      phrase.data && typeof phrase.data === "object"
        ? (phrase.data as {
            meanings?: string[];
            examples?: Array<{ es: string; zh: string }>;
            source?: { sentence?: string; type?: string };
          })
        : null;
    const sourceSentence = dataObj?.source?.sentence?.trim() ?? "";
    const firstEx = dataObj?.examples?.[0];
    const cloze =
      buildContextCloze({
        sentence: sourceSentence || firstEx?.es,
        translatedSentence: firstEx?.zh ?? phrase.translationZh ?? "",
        lemma: phrase.lemma,
        forms: [phrase.lemma]
      }) ?? null;
    const encounters: ReviewQueueEncounter[] = sourceSentence
      ? [
          {
            id: `phrase-${phrase.id}`,
            sourceType: dataObj?.source?.type ?? "phrase",
            sourceUrl: "",
            timestampSec: 0,
            originalSentence: sourceSentence,
            translatedSentence: phrase.translationZh ?? "",
            createdAt: phrase.createdAt.toISOString()
          }
        ]
      : [];

    const priorityInfo = scoreNewReviewPriority({
      itemType: "phrase",
      encounterCount: 1,
      lexiconLevel: lex?.level ?? null,
      lexiconFrequency: lex?.frequency ?? null,
      isEasyCognate: false,
      createdAtMs: phrase.createdAt.getTime()
    });

    const kindLabel =
      phrase.kind === "collocation"
        ? "固定搭配"
        : phrase.kind === "idiom"
          ? "习语表达"
          : "实用语块";

    return {
      id: phrase.id,
      itemType: "phrase",
      phraseKind: phrase.kind,
      language: phrase.language,
      lemma: phrase.lemma,
      forms: [phrase.lemma],
      translation: phrase.translationZh ?? phrase.explanationZh ?? phrase.lemma,
      partOfSpeech: kindLabel,
      dictData: {
        ...(dataObj ?? {}),
        meanings:
          dataObj?.meanings && dataObj.meanings.length > 0
            ? dataObj.meanings
            : [phrase.translationZh, phrase.explanationZh].filter(
                (v): v is string => Boolean(v?.trim())
              )
      },
      status: phrase.status,
      srsDue: phrase.srsDue?.toISOString() ?? null,
      srsState: phrase.srsState,
      srsReps: phrase.srsReps,
      srsLapses: phrase.srsLapses,
      encounters,
      encounterCount: 1,
      encounterForm: cloze?.answerForm ?? phrase.lemma,
      articleCue: null,
      cloze,
      cognateHint: null,
      frequencyLevel: lex?.level ?? null,
      lexiconFrequency: lex?.frequency ?? null,
      priorityReason: priorityInfo.priorityReason ?? kindLabel,
      isLowFrequency: false,
      _priority: priorityInfo.score
    };
  };

  const mappedWords = wordItems.map(mapWord);
  const dueWordsOut = mappedWords.filter((item) => item.srsState !== null);
  const newWordsOut = mappedWords.filter((item) => item.srsState === null);
  const duePhrasesOut = duePhraseRows.map(mapPhrase);
  const newPhrasesOut = newPhraseRows.map(mapPhrase);

  const combinedDue = [...dueWordsOut, ...duePhrasesOut].sort((a, b) => {
    const dueA = a.srsDue ? new Date(a.srsDue).getTime() : 0;
    const dueB = b.srsDue ? new Date(b.srsDue).getTime() : 0;
    return dueA - dueB;
  });

  const newSlots = Math.max(0, Math.min(10, batchSize - combinedDue.length));
  const combinedNew = [...newWordsOut, ...newPhrasesOut]
    .sort((a, b) => b._priority - a._priority)
    .slice(0, newSlots);

  // Interleave new phrases & prioritized new words cleanly and strip internal _priority
  return [...combinedDue, ...combinedNew]
    .slice(0, batchSize)
    .map(({ _priority: _ignored, ...rest }) => rest);
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
