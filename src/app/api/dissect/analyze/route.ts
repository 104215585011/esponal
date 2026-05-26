import { NextResponse } from "next/server";
import {
  buildFallbackDissectionAnalysis,
  type DissectAnalysisResult,
  type DissectImpliedSubject,
  type ImpliedSubjectType
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
    type?: ImpliedSubjectType;
  } | null;
  inversionNote?: "gustar";
  naturalEnglish?: string;
};

function normalizeImpliedSubject(
  impliedSubject: RawModelResponse["impliedSubject"]
): DissectImpliedSubject | null {
  if (
    !impliedSubject ||
    typeof impliedSubject.pronoun !== "string" ||
    typeof impliedSubject.english !== "string" ||
    typeof impliedSubject.insertBeforeIndex !== "number" ||
    !impliedSubject.type
  ) {
    return null;
  }

  return {
    pronoun: impliedSubject.pronoun.trim(),
    english: impliedSubject.english.trim(),
    insertBeforeIndex: impliedSubject.insertBeforeIndex,
    type: impliedSubject.type
  };
}

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

  return {
    tokens,
    impliedSubject: normalizeImpliedSubject(payload.impliedSubject),
    inversionNote: payload.inversionNote === "gustar" ? "gustar" : undefined,
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
            "Return JSON only with keys: tokens, impliedSubject, inversionNote, naturalEnglish.",
            "Each token must include form, english, isPunctuation.",
            "Identify ALL cases where Spanish omits or inverts a subject that English requires:",
            'CASE 1 - Personal pro-drop: verb conjugation implies yo/tú/él/ella/nosotros/vosotros/ellos/ellas -> impliedSubject: { pronoun: "yo"|"tú"|..., english: "I"|"you"|..., insertBeforeIndex: <verb idx>, type: "prodrop" }',
            'CASE 2 - Impersonal weather: hace calor/frío/viento, llueve, nieva, hay + weather noun -> impliedSubject: { pronoun: "ello", english: "it", insertBeforeIndex: <verb idx>, type: "impersonal" }',
            'CASE 3 - Impersonal es/parece/resulta + adj/clause -> impliedSubject: { pronoun: "ello", english: "it", insertBeforeIndex: <verb idx>, type: "impersonal" }',
            'CASE 4 - Existential hay (there is/are) -> impliedSubject: { pronoun: "there", english: "there", insertBeforeIndex: <hay idx>, type: "existential" }',
            'CASE 5 - Se impersonal / pasiva refleja -> impliedSubject: { pronoun: "se", english: "one", insertBeforeIndex: <verb idx>, type: "se_impersonal" }',
            'CASE 6 - Gustar-type inversion (me gusta, me duele, me parece...) -> impliedSubject: null -> inversionNote: "gustar"',
            "If none apply, impliedSubject must be null and inversionNote must be absent.",
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
                insertBeforeIndex: 3,
                type: "prodrop"
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
