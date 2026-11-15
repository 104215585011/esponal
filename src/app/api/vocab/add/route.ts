import { NextResponse } from "next/server";
import { getAuthedUserId } from "@/lib/api-auth";
import { assertUnlimitedSavesAccess, FREE_SAVE_LIMIT } from "@/lib/credits/access";
import { resolveRequestLanguage } from "@/lib/languages";
import { addLimiter, checkRateLimit, getRetryAfterSec } from "@/lib/ratelimit";
import { addEncounter, createWord, getWordWithEncounters } from "@/lib/vocab";

type AddVocabBody = {
  language?: unknown;
  lemma?: unknown;
  word?: unknown;
  translation?: unknown;
  meaning?: unknown;
  context?: unknown;
  form?: unknown;
  dictData?: unknown;
  partOfSpeech?: unknown;
  sourceType?: unknown;
  sourceUrl?: unknown;
  timestampSec?: unknown;
  courseRef?: unknown;
  originalSentence?: unknown;
  translatedSentence?: unknown;
};

export async function POST(request: Request) {
  // 双通道鉴权:Web 走 cookie,App 走 Bearer(否则 App 加词永远 unauthorized)
  const userId = await getAuthedUserId(request);

  if (!userId) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }

  const rateLimit = await checkRateLimit(addLimiter, request, userId);

  if (!rateLimit.allowed) {
    const retryAfterSec = getRetryAfterSec(rateLimit.reset);

    return NextResponse.json(
      { error: "rate limited", retryAfterSec },
      {
        status: 429,
        headers: { "Retry-After": String(retryAfterSec) }
      }
    );
  }

  try {
    const body = (await request.json()) as AddVocabBody;
    const rawLemma = typeof body.lemma === "string" ? body.lemma.trim().toLowerCase() : "";
    const rawWord = typeof body.word === "string" ? body.word.trim().toLowerCase() : "";
    const lemma = rawLemma || rawWord;
    const translation =
      typeof body.translation === "string" && body.translation.trim()
        ? body.translation.trim()
        : typeof body.meaning === "string"
          ? body.meaning.trim()
          : "";
    const rawForm = typeof body.form === "string" ? body.form.trim().toLowerCase() : "";
    const form = rawForm || rawWord || lemma;
    const dictData =
      body.dictData && typeof body.dictData === "object" ? body.dictData : undefined;
    const partOfSpeech =
      typeof body.partOfSpeech === "string" ? body.partOfSpeech.trim() : null;
    const sourceType =
      body.sourceType === "course" ||
      body.sourceType === "lectura" ||
      body.sourceType === "dissect" ||
      body.sourceType === "grammar" ||
      body.sourceType === "import" ||
      body.sourceType === "talk"
        ? body.sourceType
        : rawForm === "" && typeof body.sourceUrl !== "string"
          ? "lectura"
          : "video";
    const rawSourceUrl = typeof body.sourceUrl === "string" ? body.sourceUrl.trim() : "";
    const sourceUrl = rawSourceUrl || (rawWord || typeof body.context === "string" ? "app://mobile/lookup" : "");
    const courseRef = typeof body.courseRef === "string" ? body.courseRef.trim() : null;
    const rawOriginalSentence =
      typeof body.originalSentence === "string" ? body.originalSentence.trim() : "";
    const rawContext = typeof body.context === "string" ? body.context.trim() : "";
    const originalSentence =
      rawOriginalSentence || rawContext || (rawWord ? form : "");
    const translatedSentence =
      typeof body.translatedSentence === "string"
        ? body.translatedSentence.trim()
        : translation;
    const timestampSec =
      typeof body.timestampSec === "number" && Number.isInteger(body.timestampSec)
        ? body.timestampSec
        : rawWord && body.timestampSec === undefined
          ? 0
          : -1;

    if (!lemma || !translation || !form || !sourceUrl || !originalSentence) {
      return NextResponse.json({ error: "missing required fields" }, { status: 400 });
    }

    if (sourceType === "video" && timestampSec < 0) {
      return NextResponse.json({ error: "invalid timestampSec" }, { status: 400 });
    }

    const language = await resolveRequestLanguage(request, body.language, userId);
    const existingWord = await getWordWithEncounters(userId, lemma, language);

    if (!existingWord) {
      const saveAccess = await assertUnlimitedSavesAccess(userId);
      if (!saveAccess.ok) {
        return NextResponse.json(
          {
            error: "save limit reached",
            code: "SAVE_LIMIT_REACHED",
            limit: FREE_SAVE_LIMIT,
            count: saveAccess.count,
            upgradeHref: "/membership",
          },
          { status: 403 },
        );
      }
    }

    const word = await createWord({
      userId: userId,
      language,
      lemma,
      translation,
      forms: existingWord ? [...existingWord.forms, form] : [form],
      dictData,
      partOfSpeech
    });

    const encounter = await addEncounter({
      wordId: word.id,
      sourceUrl,
      timestampSec: Math.max(0, timestampSec),
      sourceType,
      courseRef,
      originalSentence,
      translatedSentence: translatedSentence || translation
    });

    return NextResponse.json({
      ok: true,
      wordId: word.id,
      encounterId: encounter.id
    });
  } catch (error) {
    console.error("Add vocab failed", error);

    return NextResponse.json({ error: "save failed" }, { status: 500 });
  }
}
