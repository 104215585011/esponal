// Timestamp: 2026-11-18 17:32
import { NextResponse } from "next/server";
import { getOptionalUserId } from "@/lib/api-auth";
import { resolveRequestLanguage } from "@/lib/languages";
import { prisma } from "@/lib/prisma";
import { getStarterPackByLanguage } from "@/lib/vocab-starter";

/**
 * GET /api/vocab/starter?lang=es
 * 返回起步高频核心词/语块快扫列表（用于“混眼熟”低压力快速扫词），
 * 已登录用户会标注哪些已在词库及其当前 status。
 */
export async function GET(request: Request) {
  const userId = await getOptionalUserId(request);
  const { searchParams } = new URL(request.url);
  const language = await resolveRequestLanguage(
    request,
    searchParams.get("lang") ?? searchParams.get("language"),
    userId
  );

  const pack = getStarterPackByLanguage(language);
  if (pack.length === 0) {
    return NextResponse.json({ language, items: [] });
  }

  const wordStatusByLemma = new Map<string, string>();
  const phraseStatusByLemma = new Map<string, string>();

  if (userId) {
    const lemmas = pack.map((item) => item.lemma.toLowerCase());
    const [savedWords, savedPhrases] = await Promise.all([
      prisma.word
        .findMany({
          where: { userId, language, lemma: { in: lemmas } },
          select: { lemma: true, status: true }
        })
        .catch(() => []),
      prisma.savedPhrase
        .findMany({
          where: { userId, language, lemma: { in: lemmas } },
          select: { lemma: true, status: true }
        })
        .catch(() => [])
    ]);

    for (const w of savedWords) wordStatusByLemma.set(w.lemma.toLowerCase(), w.status);
    for (const p of savedPhrases) phraseStatusByLemma.set(p.lemma.toLowerCase(), p.status);
  }

  const items = pack.map((item) => {
    const key = item.lemma.toLowerCase();
    const status =
      item.kind === "phrase"
        ? phraseStatusByLemma.get(key) ?? null
        : wordStatusByLemma.get(key) ?? null;
    return {
      ...item,
      inVocab: Boolean(status),
      status
    };
  });

  return NextResponse.json({ language, items });
}
