import { getUnitPageData } from "@/lib/curriculum";
import { formatRelativeTime } from "@/lib/dates";
import { prisma } from "@/lib/prisma";

type EncounterWithWord = {
  sourceUrl: string;
  timestampSec: number;
  originalSentence: string;
  courseRef: string | null;
  createdAt: Date;
};

export type ContinueVideoEncounter = {
  videoId: string;
  title: string;
  thumbnail: string;
  sourceUrl: string;
  timestampSec: number;
  originalSentence: string;
  relativeTime: string;
};

export type ContinueCourseEncounter = {
  slug: string;
  title: string;
  courseRef: string;
  originalSentence: string;
  relativeTime: string;
};

export function parseYouTubeVideoId(sourceUrl: string) {
  try {
    const url = new URL(sourceUrl);
    if (url.hostname.includes("youtu.be")) {
      return url.pathname.replace("/", "") || null;
    }
    return url.searchParams.get("v");
  } catch {
    return null;
  }
}

function getVideoTitle(sourceUrl: string, fallback: string) {
  try {
    const url = new URL(sourceUrl);
    return url.searchParams.get("title") || fallback || "上次观看的视频";
  } catch {
    return fallback || "上次观看的视频";
  }
}

function getCourseSlug(courseRef: string | null) {
  return courseRef?.match(/unidad-\d+/)?.[0] ?? null;
}

function toVideoEncounter(encounter: EncounterWithWord): ContinueVideoEncounter | null {
  const videoId = parseYouTubeVideoId(encounter.sourceUrl);
  if (!videoId) return null;

  return {
    videoId,
    title: getVideoTitle(encounter.sourceUrl, encounter.originalSentence),
    thumbnail: `https://img.youtube.com/vi/${videoId}/mqdefault.jpg`,
    sourceUrl: encounter.sourceUrl,
    timestampSec: encounter.timestampSec,
    originalSentence: encounter.originalSentence,
    relativeTime: formatRelativeTime(encounter.createdAt)
  };
}

function toCourseEncounter(encounter: EncounterWithWord): ContinueCourseEncounter | null {
  const slug = getCourseSlug(encounter.courseRef);
  if (!slug) return null;

  const { unit } = getUnitPageData(slug);
  return {
    slug,
    title: unit.title,
    courseRef: encounter.courseRef ?? slug,
    originalSentence: encounter.originalSentence,
    relativeTime: formatRelativeTime(encounter.createdAt)
  };
}

export async function getLastVideoEncounter(userId: string) {
  const encounter = await prisma.wordEncounter.findFirst({
    where: {
      sourceType: "video",
      word: {
        userId
      }
    },
    orderBy: {
      createdAt: "desc"
    },
    select: {
      sourceUrl: true,
      timestampSec: true,
      originalSentence: true,
      courseRef: true,
      createdAt: true
    }
  });

  return encounter ? toVideoEncounter(encounter) : null;
}

export async function getLastCourseEncounter(userId: string) {
  const encounter = await prisma.wordEncounter.findFirst({
    where: {
      sourceType: "course",
      word: {
        userId
      }
    },
    orderBy: {
      createdAt: "desc"
    },
    select: {
      sourceUrl: true,
      timestampSec: true,
      originalSentence: true,
      courseRef: true,
      createdAt: true
    }
  });

  return encounter ? toCourseEncounter(encounter) : null;
}
