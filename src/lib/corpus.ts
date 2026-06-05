// Timestamp: 2026-06-03 10:05
import type { LexiconKind, Prisma } from "@prisma/client";
import { prisma } from "@/lib/prisma";

export type SavePhraseKind = Extract<LexiconKind, "collocation" | "phrase" | "idiom">;

export type UpsertVideoViewInput = {
  userId: string;
  videoId: string;
  title: string;
  channelTitle: string;
  thumbnail?: string | null;
};

export type SavePhraseInput = {
  userId: string;
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
  videoId,
  title,
  channelTitle,
  thumbnail
}: UpsertVideoViewInput) {
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
      videoId: normalizedVideoId,
      title: normalizeText(title, "YouTube video"),
      channelTitle: normalizeText(channelTitle, "YouTube"),
      thumbnail: thumbnail?.trim() || null,
      viewedAt: new Date()
    },
    update: {
      title: normalizeText(title, "YouTube video"),
      channelTitle: normalizeText(channelTitle, "YouTube"),
      thumbnail: thumbnail?.trim() || null,
      viewedAt: new Date()
    }
  });
}

export async function getVideoViewsByUser(userId: string, limit = 100) {
  return prisma.videoView.findMany({
    where: { userId },
    orderBy: {
      viewedAt: "desc"
    },
    take: Math.min(Math.max(limit, 1), 200)
  });
}

export async function savePhraseForUser({
  userId,
  lemma,
  kind,
  translationZh,
  explanationZh,
  data
}: SavePhraseInput) {
  const normalizedLemma = lemma.trim().toLowerCase();

  return prisma.savedPhrase.upsert({
    where: {
      userId_lemma_kind: {
        userId,
        lemma: normalizedLemma,
        kind
      }
    },
    create: {
      userId,
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
) {
  return prisma.savedPhrase.findUnique({
    where: {
      userId_lemma_kind: {
        userId,
        lemma: lemma.trim().toLowerCase(),
        kind,
      },
    },
  });
}

export async function getSavedPhrasesByUser(userId: string, limit = 100) {
  return prisma.savedPhrase.findMany({
    where: { userId },
    orderBy: {
      createdAt: "desc"
    },
    take: Math.min(Math.max(limit, 1), 200)
  });
}
