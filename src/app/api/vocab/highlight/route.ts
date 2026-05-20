import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { prisma } from "@/lib/prisma";
import { getAuthOptions } from "@/lib/auth";
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

function getSessionUserId(session: unknown) {
  if (!session || typeof session !== "object" || !("user" in session)) {
    return null;
  }

  const user = (session as { user?: { id?: unknown } }).user;
  return typeof user?.id === "string" ? user.id : null;
}

function buildSavedForms(words: { lemma: string; forms: string[] }[]) {
  const savedForms = new Set<string>();

  for (const word of words) {
    savedForms.add(word.lemma.trim().toLowerCase());

    for (const form of word.forms) {
      const normalized = form.trim().toLowerCase();
      if (normalized) savedForms.add(normalized);
    }
  }

  return Array.from(savedForms).sort();
}

function savedFormsResponse(savedForms: string[]) {
  return NextResponse.json(
    { savedForms },
    {
      headers: {
        "Cache-Control": "private, max-age=60"
      }
    }
  );
}

export async function GET() {
  const session = await getServerSession(getAuthOptions());
  const userId = getSessionUserId(session);

  if (!userId) {
    return NextResponse.json(
      { savedForms: [] },
      {
        headers: {
          "Cache-Control": "private, max-age=60"
        }
      }
    );
  }

  try {
    const words = await prisma.word.findMany({
      where: {
        userId
      },
      select: {
        lemma: true,
        forms: true
      }
    });

    return savedFormsResponse(buildSavedForms(words));
  } catch (error) {
    console.error("Highlight saved forms failed", error);

    return NextResponse.json({ error: "highlight lookup failed" }, { status: 500 });
  }
}

export async function POST(request: Request) {
  const session = await getServerSession(getAuthOptions());

  try {
    const body = (await request.json()) as HighlightBody;
    const words = normalizeWords(body.words);

    if (words.length === 0) {
      return NextResponse.json({ items: [] });
    }

    const items = buildDefaultStatuses(words);

    const userId = getSessionUserId(session);

    if (!userId) {
      return NextResponse.json({ items });
    }

    const savedWords = await prisma.word.findMany({
      where: {
        userId,
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
      savedWordSet.add(word.lemma.trim().toLowerCase());

      for (const form of word.forms) {
        savedWordSet.add(form.trim().toLowerCase());
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
