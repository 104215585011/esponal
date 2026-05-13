import { readFile } from "node:fs/promises";
import path from "node:path";
import { NextResponse } from "next/server";

type LemmaEntry = {
  lemma: string;
  morphInfo: string;
  translation: string;
  partOfSpeech?: string;
};

let lemmaDictPromise: Promise<Record<string, LemmaEntry>> | null = null;

const loadLemmaDict = async () => {
  if (!lemmaDictPromise) {
    const dictPath = path.join(process.cwd(), "extension", "lemma-dict.json");
    lemmaDictPromise = readFile(dictPath, "utf8").then((contents) =>
      JSON.parse(contents) as Record<string, LemmaEntry>
    );
  }

  return lemmaDictPromise;
};

export async function POST(request: Request) {
  try {
    const body = (await request.json()) as { form?: unknown };
    const form = typeof body.form === "string" ? body.form.trim().toLowerCase() : "";

    if (!form) {
      return NextResponse.json({ error: "form is required" }, { status: 400 });
    }

    const lemmaDict = await loadLemmaDict();
    const entry = lemmaDict[form];

    if (!entry) {
      return NextResponse.json({
        lemma: null,
        morphInfo: null,
        translation: null,
        partOfSpeech: null
      });
    }

    return NextResponse.json({
      lemma: entry.lemma,
      morphInfo: entry.morphInfo,
      translation: entry.translation,
      partOfSpeech: entry.partOfSpeech ?? null
    });
  } catch (error) {
    console.error("Lemmatize lookup failed", error);

    return NextResponse.json({ error: "lookup failed" }, { status: 500 });
  }
}
