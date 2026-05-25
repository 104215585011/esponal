import { NextResponse } from "next/server";
import {
  buildFallbackDissectionAnalysis,
  type DissectAnalysisResult
} from "@/app/dissect/analysis";
import { getDeepseekConfig, isConfiguredSecret } from "@/lib/talk/env";

type RawModelResponse = {
  tokens?: Array<{
    form?: string;
    english?: string;
    isPunctuation?: boolean;
  }>;
  impliedSubject?: {
    pronoun?: string;
    english?: string;
    insertBeforeIndex?: number;
  } | null;
  naturalEnglish?: string;
};

function normalizeModelResponse(payload: RawModelResponse): DissectAnalysisResult | null {
  if (!Array.isArray(payload.tokens) || typeof payload.naturalEnglish !== "string") {
    return null;
  }

  const tokens = payload.tokens
    .filter((token) => typeof token?.form === "string")
    .map((token) => ({
      form: token.form!.trim(),
      english: typeof token.english === "string" ? token.english.trim() : "",
      isPunctuation: Boolean(token.isPunctuation)
    }))
    .filter((token) => token.form.length > 0);

  if (tokens.length === 0) {
    return null;
  }

  const impliedSubject =
    payload.impliedSubject &&
    typeof payload.impliedSubject.pronoun === "string" &&
    typeof payload.impliedSubject.english === "string" &&
    typeof payload.impliedSubject.insertBeforeIndex === "number"
      ? {
          pronoun: payload.impliedSubject.pronoun.trim(),
          english: payload.impliedSubject.english.trim(),
          insertBeforeIndex: payload.impliedSubject.insertBeforeIndex
        }
      : null;

  return {
    tokens,
    impliedSubject,
    naturalEnglish: payload.naturalEnglish.trim()
  };
}

async function analyzeWithDeepseek(sentence: string) {
  const { apiKey, baseUrl, model } = getDeepseekConfig();
  if (!isConfiguredSecret(apiKey)) {
    return null;
  }

  const response = await fetch(`${baseUrl}/v1/chat/completions`, {
    method: "POST",
    headers: {
      authorization: `Bearer ${apiKey}`,
      "content-type": "application/json"
    },
    body: JSON.stringify({
      model,
      stream: false,
      temperature: 0.1,
      response_format: { type: "json_object" },
      messages: [
        {
          role: "system",
          content: [
            "You are a Spanish interlinear gloss assistant for Chinese beginners.",
            "Return JSON only with keys: tokens, impliedSubject, naturalEnglish.",
            "Each token must include form, english, isPunctuation.",
            "If the sentence omits a subject pronoun, infer it and return pronoun, english, insertBeforeIndex.",
            "If no subject is omitted, impliedSubject must be null.",
            "naturalEnglish must be a fluent English translation."
          ].join(" ")
        },
        {
          role: "user",
          content: JSON.stringify({
            sentence,
            schema: {
              tokens: [{ form: "De", english: "from", isPunctuation: false }],
              impliedSubject: {
                pronoun: "tú",
                english: "you",
                insertBeforeIndex: 3
              },
              naturalEnglish: "Where are you from?"
            }
          })
        }
      ]
    })
  });

  if (!response.ok) {
    throw new Error(`DeepSeek analyze failed: ${response.status}`);
  }

  const payload = (await response.json()) as {
    choices?: Array<{ message?: { content?: string } }>;
  };
  const content = payload.choices?.[0]?.message?.content?.trim();
  if (!content) {
    return null;
  }

  const parsed = JSON.parse(content) as RawModelResponse;
  return normalizeModelResponse(parsed);
}

export async function POST(request: Request) {
  const body = (await request.json().catch(() => null)) as { sentence?: unknown } | null;
  const sentence = typeof body?.sentence === "string" ? body.sentence.trim() : "";

  if (!sentence) {
    return NextResponse.json({ error: "sentence is required" }, { status: 400 });
  }

  if (sentence.length > 300) {
    return NextResponse.json({ error: "sentence is too long" }, { status: 400 });
  }

  try {
    const analysis =
      (await analyzeWithDeepseek(sentence).catch((error) => {
        console.warn("Dissect analyze model failed", error);
        return null;
      })) ?? (await buildFallbackDissectionAnalysis(sentence));

    return NextResponse.json(analysis);
  } catch (error) {
    console.error("Dissect analyze failed", error);
    return NextResponse.json({ error: "analysis failed" }, { status: 500 });
  }
}
