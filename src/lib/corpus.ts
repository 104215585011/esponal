// Timestamp: 2026-11-15 08:08
import type { LexiconKind, Prisma } from "@prisma/client";
import { normalizeLanguage, resolveRequestLanguage } from "@/lib/languages";
import { prisma } from "@/lib/prisma";

export type SavePhraseKind = Extract<LexiconKind, "collocation" | "phrase" | "idiom">;

export type UpsertVideoViewInput = {
  userId: string;
  language?: string;
  videoId: string;
  title: string;
  channelTitle: string;
  thumbnail?: string | null;
};

export type SavePhraseInput = {
  userId: string;
  language?: string;
  lemma: string;
  kind: SavePhraseKind;
  translationZh?: string | null;
  explanationZh?: string | null;
  data?: Prisma.InputJsonValue;
};

function normalizeText(value: string, fallback: string) {
  const normalized = value.trim();
  return normalized || fallback;
}

export async function upsertVideoView({
  userId,
  language,
  videoId,
  title,
  channelTitle,
  thumbnail
}: UpsertVideoViewInput) {
  const lang = normalizeLanguage(language);
  const normalizedVideoId = videoId.trim();

  return prisma.videoView.upsert({
    where: {
      userId_videoId: {
        userId,
        videoId: normalizedVideoId
      }
    },
    create: {
      userId,
      language: lang,
      videoId: normalizedVideoId,
      title: normalizeText(title, "YouTube video"),
      channelTitle: normalizeText(channelTitle, "YouTube"),
      thumbnail: thumbnail?.trim() || null,
      viewedAt: new Date()
    },
    update: {
      language: lang,
      title: normalizeText(title, "YouTube video"),
      channelTitle: normalizeText(channelTitle, "YouTube"),
      thumbnail: thumbnail?.trim() || null,
      viewedAt: new Date()
    }
  });
}

export async function getVideoViewsByUser(
  userId: string,
  limit = 100,
  language?: string,
  options?: { allLanguages?: boolean }
) {
  if (options?.allLanguages) {
    return prisma.videoView.findMany({
      where: { userId },
      orderBy: {
        viewedAt: "desc"
      },
      take: Math.min(Math.max(limit, 1), 200)
    });
  }

  const lang = language
    ? normalizeLanguage(language)
    : await resolveRequestLanguage(null, undefined, userId);

  return prisma.videoView.findMany({
    where: { userId, language: lang },
    orderBy: {
      viewedAt: "desc"
    },
    take: Math.min(Math.max(limit, 1), 200)
  });
}

export async function savePhraseForUser({
  userId,
  language,
  lemma,
  kind,
  translationZh,
  explanationZh,
  data
}: SavePhraseInput) {
  const lang = normalizeLanguage(language);
  const normalizedLemma = lemma.trim().toLowerCase();

  return prisma.savedPhrase.upsert({
    where: {
      userId_language_lemma_kind: {
        userId,
        language: lang,
        lemma: normalizedLemma,
        kind
      }
    },
    create: {
      userId,
      language: lang,
      lemma: normalizedLemma,
      kind,
      translationZh: translationZh?.trim() || null,
      explanationZh: explanationZh?.trim() || null,
      data
    },
    update: {
      translationZh: translationZh?.trim() || null,
      explanationZh: explanationZh?.trim() || null,
      data
    }
  });
}

export async function getSavedPhraseByUser(
  userId: string,
  lemma: string,
  kind: SavePhraseKind,
  language?: string
) {
  const lang = language
    ? normalizeLanguage(language)
    : await resolveRequestLanguage(null, undefined, userId);

  return prisma.savedPhrase.findUnique({
    where: {
      userId_language_lemma_kind: {
        userId,
        language: lang,
        lemma: lemma.trim().toLowerCase(),
        kind
      }
    }
  });
}

export async function getSavedPhrasesByUser(
  userId: string,
  limit = 100,
  language?: string
) {
  const lang = language
    ? normalizeLanguage(language)
    : await resolveRequestLanguage(null, undefined, userId);

  return prisma.savedPhrase.findMany({
    where: { userId, language: lang },
    orderBy: {
      createdAt: "desc"
    },
    take: Math.min(Math.max(limit, 1), 200)
  });
}
