import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { getAuthOptions } from "@/lib/auth";
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
  const session = await getServerSession(getAuthOptions());

  if (
    !session?.user ||
    !("id" in session.user) ||
    typeof session.user.id !== "string"
  ) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
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
    const sourceType = body.sourceType === "course" ? "course" : "video";
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

    const existingWord = await getWordWithEncounters(session.user.id, lemma);
    const word = await createWord({
      userId: session.user.id,
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
