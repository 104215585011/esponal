import { readFile } from "node:fs/promises";
import path from "node:path";
import { NextResponse } from "next/server";
import { redis } from "@/lib/redis";

type LemmaEntry = {
  lemma: string;
  morphInfo: string;
  translation: string;
  partOfSpeech?: string;
};

type DictData = {
  pos: string;
  meanings: string[];
  example: { es: string; zh: string } | null;
};

let lemmaDictPromise: Promise<Record<string, LemmaEntry>> | null = null;

const loadLemmaDict = async () => {
  if (!lemmaDictPromise) {
    const dictPath = path.join(process.cwd(), "extension", "lemma-dict.json");
    lemmaDictPromise = readFile(dictPath, "utf8").then(
      (contents) => JSON.parse(contents) as Record<string, LemmaEntry>
    );
  }
  return lemmaDictPromise;
};

function stripMarkdown(text: string): string {
  return text.replace(/^```(?:json)?\s*/i, "").replace(/\s*```\s*$/, "").trim();
}

async function generateDictEntry(word: string): Promise<DictData | null> {
  const apiKey = process.env.DASHSCOPE_API_KEY?.trim();
  const model = process.env.DASHSCOPE_MODEL?.trim() || "glm-5";
  if (!apiKey) {
    console.error("[lemmatize] DASHSCOPE_API_KEY is not set");
    return null;
  }

  try {
    const res = await fetch(
      "https://dashscope.aliyuncs.com/compatible-mode/v1/chat/completions",
      {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${apiKey}`,
        },
        body: JSON.stringify({
          model,
          messages: [
            {
              role: "user",
              content: `你是西班牙语词典助手。请为单词"${word}"生成词典条目，只返回JSON，不要任何解释，格式：{"pos":"词性缩写","meanings":["中文义项1","中文义项2"],"example":{"es":"西语例句","zh":"中文翻译"}}`,
            },
          ],
          temperature: 0.1,
        }),
      }
    );

    if (!res.ok) return null;

    const data = (await res.json()) as {
      choices?: { message?: { content?: string } }[];
    };

    const raw = data.choices?.[0]?.message?.content;
    if (!raw) return null;

    const parsed = JSON.parse(stripMarkdown(raw)) as DictData;
    return parsed;
  } catch {
    return null;
  }
}

export async function POST(request: Request) {
  try {
    const body = (await request.json()) as { form?: unknown };
    const form = typeof body.form === "string" ? body.form.trim().toLowerCase() : "";

    if (!form) {
      return NextResponse.json({ error: "form is required" }, { status: 400 });
    }

    const lemmaDict = await loadLemmaDict();
    const entry = lemmaDict[form];
    const lemma = entry?.lemma ?? form;

    // Check Redis cache
    const cacheKey = `lemma:dict:${lemma}`;
    const cached = await redis.get(cacheKey);
    if (cached) {
      const dict = JSON.parse(cached as string) as DictData;
      return NextResponse.json({
        lemma,
        morphInfo: entry?.morphInfo || null,
        translation: dict.meanings.join("；"),
        partOfSpeech: dict.pos,
        meanings: dict.meanings,
        example: dict.example,
      });
    }

    // Generate via AI
    const dict = await generateDictEntry(lemma);

    if (!dict) {
      // Last resort: Baidu MT plain translation
      return NextResponse.json({
        lemma,
        morphInfo: null,
        translation: null,
        partOfSpeech: null,
        meanings: [],
        example: null,
      });
    }

    // Cache permanently
    await redis.set(cacheKey, JSON.stringify(dict));

    return NextResponse.json({
      lemma,
      morphInfo: entry?.morphInfo || null,
      translation: dict.meanings.join("；"),
      partOfSpeech: dict.pos,
      meanings: dict.meanings,
      example: dict.example,
    });
  } catch (error) {
    console.error("Lemmatize lookup failed", error);
    return NextResponse.json({ error: "lookup failed" }, { status: 500 });
  }
}
