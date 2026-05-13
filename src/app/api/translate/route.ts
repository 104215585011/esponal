import { createHash } from "node:crypto";
import { NextResponse } from "next/server";
import { redis } from "@/lib/redis";

const MINIMAX_ENDPOINT = "https://api.minimax.chat/v1/chat/completions";
const SUBTITLE_CACHE_TTL_SECONDS = 60 * 60 * 24 * 7;

function hashSubtitleText(text: string) {
  return createHash("sha256").update(text.trim()).digest("hex");
}

type MiniMaxResponse = {
  choices?: Array<{
    message?: {
      content?: string;
    };
  }>;
};

async function requestMiniMaxTranslation(text: string) {
  const apiKey = process.env.MINIMAX_API_KEY;
  const groupId = process.env.MINIMAX_GROUP_ID;

  if (!apiKey || !groupId) {
    return text;
  }

  const response = await fetch(`${MINIMAX_ENDPOINT}?GroupId=${groupId}`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${apiKey}`
    },
    body: JSON.stringify({
      model: "abab5.5-chat",
      messages: [
        {
          role: "system",
          content:
            "Translate Spanish YouTube subtitles into concise Simplified Chinese. Return only the translation."
        },
        {
          role: "user",
          content: text
        }
      ],
      temperature: 0.2
    })
  });

  if (!response.ok) {
    throw new Error(`MiniMax translate failed: ${response.status}`);
  }

  const data = (await response.json()) as MiniMaxResponse;
  const translation = data.choices?.[0]?.message?.content?.trim();

  if (!translation) {
    throw new Error("MiniMax translate returned an empty response");
  }

  return translation;
}

export async function POST(request: Request) {
  try {
    const body = (await request.json()) as { text?: unknown };
    const text = typeof body.text === "string" ? body.text.trim() : "";

    if (!text) {
      return NextResponse.json({ error: "text is required" }, { status: 400 });
    }

    if (text.length > 1000) {
      return NextResponse.json({ error: "text is too long" }, { status: 400 });
    }

    const cacheKey = `subtitle:${hashSubtitleText(text)}`;
    const cached = await redis.get(cacheKey);

    if (cached) {
      return NextResponse.json({ translation: cached, cached: true });
    }

    const translation = await requestMiniMaxTranslation(text);
    await redis.set(cacheKey, translation, "EX", SUBTITLE_CACHE_TTL_SECONDS);

    return NextResponse.json({ translation, cached: false });
  } catch (error) {
    console.error("Subtitle translation failed", error);

    return NextResponse.json(
      { error: "translation failed" },
      { status: 500 }
    );
  }
}
