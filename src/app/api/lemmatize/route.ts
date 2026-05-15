import { NextResponse } from "next/server";
import { lookupDictionary } from "@/lib/dictionary";

// Legacy EXT-003 contract: lemma-dict.json is loaded by src/lib/dictionary.ts.
export async function POST(request: Request) {
  try {
    const body = (await request.json()) as { form?: unknown };
    const form = typeof body.form === "string" ? body.form.trim().toLowerCase() : "";

    if (!form) {
      return NextResponse.json({ error: "form is required" }, { status: 400 });
    }

    const entry = await lookupDictionary(form);

    if (!entry) {
      return NextResponse.json({
        lemma: null,
        morphInfo: null,
        translation: null,
        partOfSpeech: null,
        meanings: [],
        example: null
      });
    }

    return NextResponse.json({
      lemma: entry.lemma,
      morphInfo: entry.morphInfo,
      translation: entry.meanings.join("；") || null,
      partOfSpeech: entry.partOfSpeech,
      meanings: entry.meanings,
      example: entry.examples[0] ?? null
    });
  } catch (error) {
    console.error("Lemmatize lookup failed", error);
    return NextResponse.json({ error: "lookup failed" }, { status: 500 });
  }
}
