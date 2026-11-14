import { NextResponse } from "next/server";
import { getAuthedUserId } from "@/lib/api-auth";
import { assertUnlimitedSavesAccess, FREE_SAVE_LIMIT } from "@/lib/credits/access";
import { addLimiter, checkRateLimit, getRetryAfterSec } from "@/lib/ratelimit";
import { addEncounter, createWord, getWordWithEncounters } from "@/lib/vocab";

type AddVocabBody = {
  lemma?: unknown;
  translation?: unknown;
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
    const lemma = typeof body.lemma === "string" ? body.lemma.trim().toLowerCase() : "";
    const translation =
      typeof body.translation === "string" ? body.translation.trim() : "";
    const form = typeof body.form === "string" ? body.form.trim().toLowerCase() : "";
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
        : "video";
    const sourceUrl = typeof body.sourceUrl === "string" ? body.sourceUrl.trim() : "";
    const courseRef = typeof body.courseRef === "string" ? body.courseRef.trim() : null;
    const originalSentence =
      typeof body.originalSentence === "string" ? body.originalSentence.trim() : "";
    const translatedSentence =
      typeof body.translatedSentence === "string"
        ? body.translatedSentence.trim()
        : translation;
    const timestampSec =
      typeof body.timestampSec === "number" && Number.isInteger(body.timestampSec)
        ? body.timestampSec
        : -1;

    if (!lemma || !translation || !form || !sourceUrl || !originalSentence) {
      return NextResponse.json({ error: "missing required fields" }, { status: 400 });
    }

    if (sourceType === "video" && timestampSec < 0) {
      return NextResponse.json({ error: "invalid timestampSec" }, { status: 400 });
    }

    const existingWord = await getWordWithEncounters(userId, lemma);

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
