import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { prisma } from "@/lib/prisma";
import { authOptions } from "@/lib/auth";
import phaseOneWords from "../../../../../content/curriculum/phase1-words.json";

type HighlightBody = {
  words?: unknown;
};

type HighlightStatus = "course" | "saved" | "unknown";

const courseWordSet = new Set(
  phaseOneWords.words
    .map((entry) => entry.spanish.trim().toLowerCase())
    .filter(Boolean)
);

function normalizeWords(value: unknown) {
  if (!Array.isArray(value)) {
    return [];
  }

  return Array.from(
    new Set(
      value
        .filter((item): item is string => typeof item === "string")
        .map((item) => item.trim().toLowerCase())
        .filter(Boolean)
    )
  ).slice(0, 64);
}

function buildDefaultStatuses(words: string[]) {
  return words.map((word) => ({
    word,
    status: courseWordSet.has(word) ? ("course" satisfies HighlightStatus) : ("unknown" satisfies HighlightStatus)
  }));
}

export async function POST(request: Request) {
  const session = await getServerSession(authOptions);

  try {
    const body = (await request.json()) as HighlightBody;
    const words = normalizeWords(body.words);

    if (words.length === 0) {
      return NextResponse.json({ items: [] });
    }

    const items = buildDefaultStatuses(words);

    if (
      !session?.user ||
      !("id" in session.user) ||
      typeof session.user.id !== "string"
    ) {
      return NextResponse.json({ items });
    }

    const savedWords = await prisma.word.findMany({
      where: {
        userId: session.user.id,
        OR: [
          {
            lemma: {
              in: words
            }
          },
          {
            forms: {
              hasSome: words
            }
          }
        ]
      },
      select: {
        lemma: true,
        forms: true
      }
    });

    const savedWordSet = new Set<string>();

    for (const word of savedWords) {
      savedWordSet.add(word.lemma);

      for (const form of word.forms) {
        savedWordSet.add(form);
      }
    }

    return NextResponse.json({
      items: items.map((item) => ({
        word: item.word,
        status: savedWordSet.has(item.word) ? "saved" : item.status
      }))
    });
  } catch (error) {
    console.error("Highlight lookup failed", error);

    return NextResponse.json({ error: "highlight lookup failed" }, { status: 500 });
  }
}
