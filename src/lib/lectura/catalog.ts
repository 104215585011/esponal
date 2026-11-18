// Timestamp: 2026-11-18 11:14
import { lecturaStories } from "@/../content/lectura";
import { normalizeLanguage, type LearningLanguage } from "@/lib/languages";
import {
  inferCuratedStoryTopic,
  mixLecturaRecommendations,
  recommendNextLecturaStory,
  type LecturaAudioType,
  type LecturaCatalogItem,
  type LecturaContentKind,
  type LecturaLevel,
  type NextStoryRecommendation
} from "@/lib/lectura/catalog-logic";
import { crawlLecturaRssFeeds, getCrawledLecturaStoryBySlug } from "@/lib/lectura/rss-crawler";
import { prisma } from "@/lib/prisma";

export type LecturaProgressInfo = {
  slug: string;
  lastParagraphIndex: number;
  totalParagraphs: number;
  completed: boolean;
  updatedAt: string;
};

export type LecturaContinueItem = {
  slug: string;
  language: LearningLanguage;
  title: string;
  titleZh: string;
  summaryZh: string;
  topic: string;
  level: LecturaLevel | null;
  durationMin: number;
  contentKind: LecturaContentKind;
  sourceLabel: string;
  lastParagraphIndex: number;
  totalParagraphs: number;
  updatedAt: string;
};

export type LecturaFeedItem = {
  slug: string;
  language: LearningLanguage;
  contentKind: LecturaContentKind;
  sourceId: string;
  source: string;
  sourceType: "curated" | "rss";
  title: string;
  titleZh: string;
  summaryZh: string;
  topic: string;
  level: LecturaLevel | null;
  durationMin: number;
  paragraphCount: number;
  isFullText: boolean;
  audioType: LecturaAudioType;
  publishedAt?: string;
  audioUrl?: string;
  coverUrl?: string;
  isRead: boolean;
  lastParagraphIndex: number;
  completed: boolean;
};

let seedPromise: Promise<void> | null = null;
let seededEs = false;

async function readSpanishSeedJson(): Promise<LecturaCatalogItem[]> {
  try {
    const mod = await import("@/data/spanish-lectura-catalog.json");
    const arr = (mod.default ?? mod) as unknown;
    return Array.isArray(arr) ? (arr as LecturaCatalogItem[]) : [];
  } catch {
    return [];
  }
}

export async function ensureSpanishLecturaCatalogSeeded(): Promise<void> {
  if (seededEs) return;
  if (seedPromise) return seedPromise;

  seedPromise = (async () => {
    try {
      const seeds = await readSpanishSeedJson();
      if (seeds.length === 0) return;

      const existingCount = await prisma.lecturaCatalog.count({
        where: { language: "es", isActive: true, bodyStatus: { in: ["ready", "excerpt"] } }
      });
      if (existingCount >= seeds.length) {
        seededEs = true;
        return;
      }

      for (const item of seeds) {
        if (item.bodyStatus === "failed") continue;
        await prisma.lecturaCatalog.upsert({
          where: { slug: item.slug },
          create: {
            slug: item.slug,
            language: "es",
            contentKind: item.contentKind,
            sourceId: item.sourceId,
            sourceLabel: item.sourceLabel,
            title: item.title,
            titleZh: item.titleZh,
            summaryZh: item.summaryZh,
            topic: item.topic,
            level: item.level ?? null,
            levelSource: item.levelSource ?? null,
            durationMin: item.durationMin,
            paragraphs: item.paragraphs,
            paragraphCount: item.paragraphCount,
            isFullText: item.isFullText,
            bodyStatus: item.bodyStatus,
            glossary: item.glossary ?? [],
            audioUrl: item.audioUrl ?? null,
            audioType: item.audioType,
            coverUrl: item.coverUrl ?? null,
            sourceUrl: item.sourceUrl ?? null,
            publishedAt: item.publishedAt ?? "",
            sortWeight: item.sortWeight ?? 0,
            isActive: true
          },
          update: {
            contentKind: item.contentKind,
            sourceLabel: item.sourceLabel,
            title: item.title,
            titleZh: item.titleZh,
            summaryZh: item.summaryZh,
            topic: item.topic,
            level: item.level ?? null,
            levelSource: item.levelSource ?? null,
            durationMin: item.durationMin,
            paragraphs: item.paragraphs,
            paragraphCount: item.paragraphCount,
            isFullText: item.isFullText,
            bodyStatus: item.bodyStatus,
            audioUrl: item.audioUrl ?? null,
            audioType: item.audioType,
            coverUrl: item.coverUrl ?? null,
            sortWeight: item.sortWeight ?? 0,
            isActive: true
          }
        });
      }
      seededEs = true;
    } catch (error) {
      console.warn(
        "[lectura-catalog] DB seed sync skipped:",
        error instanceof Error ? error.message : error
      );
    } finally {
      seedPromise = null;
    }
  })();

  return seedPromise;
}

function mapStaticStoriesFallback(lang: LearningLanguage): LecturaCatalogItem[] {
  return lecturaStories
    .filter((s) => normalizeLanguage(s.language) === lang)
    .map((story) => ({
      slug: story.slug,
      language: normalizeLanguage(story.language),
      contentKind: "story" as const,
      sourceId: "esponal-curated",
      sourceLabel: story.source || "Esponal 分级短文",
      title: story.title,
      titleZh: story.titleZh,
      summaryZh: story.summaryZh,
      topic: inferCuratedStoryTopic(story),
      level: story.level,
      levelSource: "curated" as const,
      durationMin: story.durationMin,
      paragraphs: story.paragraphs,
      paragraphCount: story.paragraphs.length,
      isFullText: true,
      bodyStatus: "ready" as const,
      glossary: story.glossary ?? [],
      audioUrl: null,
      audioType: "tts" as const,
      coverUrl: null,
      sourceUrl: null,
      publishedAt: "",
      sortWeight: 10
    }));
}

function parseJsonStringArray(raw: unknown): string[] {
  return Array.isArray(raw) ? raw.filter((v): v is string => typeof v === "string") : [];
}

function parseJsonGlossary(raw: unknown): Array<{ word: string; note: string }> {
  if (!Array.isArray(raw)) return [];
  return raw.filter(
    (g): g is { word: string; note: string } =>
      Boolean(g) &&
      typeof g === "object" &&
      typeof (g as { word?: unknown }).word === "string" &&
      typeof (g as { note?: unknown }).note === "string"
  );
}

/**
 * 读取指定语种的预核验文章目录（首页秒开读取已准备好的文章库，不阻塞现场抓取 RSS）。
 */
export async function loadReadyLecturaCatalog(
  language: LearningLanguage,
  options?: { forceRefresh?: boolean; onlyCurated?: boolean }
): Promise<LecturaCatalogItem[]> {
  if (language === "es") {
    await ensureSpanishLecturaCatalogSeeded();
    try {
      const dbRows = await prisma.lecturaCatalog.findMany({
        where: {
          language: "es",
          isActive: true,
          bodyStatus: { in: ["ready", "excerpt"] },
          ...(options?.onlyCurated ? { contentKind: "story" } : {})
        },
        orderBy: [{ sortWeight: "desc" }, { updatedAt: "desc" }]
      });
      if (dbRows.length > 0) {
        return dbRows.map((row) => ({
          slug: row.slug,
          language: "es" as const,
          contentKind:
            row.contentKind === "blog" || row.contentKind === "news" ? row.contentKind : "story",
          sourceId: row.sourceId,
          sourceLabel: row.sourceLabel,
          title: row.title,
          titleZh: row.titleZh,
          summaryZh: row.summaryZh,
          topic: row.topic,
          level:
            row.level === "A1" || row.level === "A2" || row.level === "B1" ? row.level : null,
          levelSource:
            row.levelSource === "curated" || row.levelSource === "inferred"
              ? row.levelSource
              : null,
          durationMin: row.durationMin,
          paragraphs: parseJsonStringArray(row.paragraphs),
          paragraphCount: row.paragraphCount,
          isFullText: row.isFullText,
          bodyStatus: row.bodyStatus === "excerpt" ? "excerpt" : "ready",
          glossary: parseJsonGlossary(row.glossary),
          audioUrl: row.audioUrl,
          audioType: row.audioType === "native" ? "native" : "tts",
          coverUrl: row.coverUrl,
          sourceUrl: row.sourceUrl,
          publishedAt: row.publishedAt,
          sortWeight: row.sortWeight
        }));
      }
    } catch (error) {
      console.warn(
        "[lectura-catalog] DB query failed, using static seed:",
        error instanceof Error ? error.message : error
      );
    }

    const seedFallback = await readSpanishSeedJson();
    if (seedFallback.length > 0) {
      return options?.onlyCurated
        ? seedFallback.filter((i) => i.contentKind === "story")
        : seedFallback;
    }
    return mapStaticStoriesFallback("es");
  }

  // 非西语语种沿用原有分级短文 + 按语种过滤后的 RSS 源
  const staticItems = mapStaticStoriesFallback(language);
  if (options?.onlyCurated) return staticItems;

  const crawled = await crawlLecturaRssFeeds(Boolean(options?.forceRefresh), language).catch(
    () => []
  );
  const rssItems: LecturaCatalogItem[] = crawled
    .filter((item) => normalizeLanguage(item.language) === language && item.paragraphs.length >= 2)
    .map((item) => ({
      slug: item.slug,
      language,
      contentKind: item.feedId === "slowgerman" ? ("blog" as const) : ("news" as const),
      sourceId: item.feedId,
      sourceLabel: item.source,
      title: item.title,
      titleZh: item.titleZh,
      summaryZh: item.summaryZh,
      topic: item.feedId === "slowgerman" ? "生活文化" : "时事热点",
      level: item.level ?? null,
      levelSource: item.level ? ("inferred" as const) : null,
      durationMin: item.durationMin,
      paragraphs: item.paragraphs,
      paragraphCount: item.paragraphs.length,
      isFullText: item.paragraphs.length < 120,
      bodyStatus: "ready" as const,
      glossary: [],
      audioUrl: item.audioUrl ?? null,
      audioType: item.audioUrl ? ("native" as const) : ("tts" as const),
      coverUrl: item.coverUrl ?? null,
      sourceUrl: item.sourceUrl,
      publishedAt: item.publishedAt,
      sortWeight: 5
    }));

  return [...staticItems, ...rssItems];
}

export async function getLecturaFeedForUser(params: {
  language: LearningLanguage;
  userId: string | null;
  forceRefresh?: boolean;
  onlyCurated?: boolean;
}): Promise<{
  language: LearningLanguage;
  items: LecturaFeedItem[];
  continueReading: LecturaContinueItem | null;
  sources: Array<{ id: string; label: string; contentKind: LecturaContentKind; count: number }>;
}> {
  const { language, userId, forceRefresh, onlyCurated } = params;
  const catalog = await loadReadyLecturaCatalog(language, { forceRefresh, onlyCurated });

  const progressBySlug = new Map<string, LecturaProgressInfo>();
  if (userId) {
    const reads = await prisma.lecturaRead
      .findMany({
        where: { userId },
        orderBy: { updatedAt: "desc" },
        select: {
          slug: true,
          lastParagraphIndex: true,
          totalParagraphs: true,
          completed: true,
          updatedAt: true
        }
      })
      .catch(() => []);
    for (const r of reads) {
      progressBySlug.set(r.slug, {
        slug: r.slug,
        lastParagraphIndex: r.lastParagraphIndex,
        totalParagraphs: r.totalParagraphs,
        completed: r.completed,
        updatedAt: r.updatedAt.toISOString()
      });
    }
  }

  const enriched = catalog.map((item): LecturaFeedItem => {
    const prog = progressBySlug.get(item.slug);
    const completed = Boolean(prog?.completed);
    return {
      slug: item.slug,
      language: item.language,
      contentKind: item.contentKind,
      sourceId: item.sourceId,
      source: item.sourceLabel,
      sourceType: item.contentKind === "story" ? "curated" : "rss",
      title: item.title,
      titleZh: item.titleZh,
      summaryZh: item.summaryZh,
      topic: item.topic,
      level: item.level,
      durationMin: item.durationMin,
      paragraphCount: item.paragraphCount,
      isFullText: item.isFullText,
      audioType: item.audioType,
      publishedAt: item.publishedAt || undefined,
      audioUrl: item.audioUrl || undefined,
      coverUrl: item.coverUrl || undefined,
      isRead: completed,
      completed,
      lastParagraphIndex: prog?.lastParagraphIndex ?? 0
    };
  });

  // 找最近一篇尚未读完、有阅读位置或最近更新的文章作为顶部「继续阅读」
  const catalogBySlug = new Map(catalog.map((c) => [c.slug, c]));
  let continueReading: LecturaContinueItem | null = null;
  for (const prog of progressBySlug.values()) {
    if (prog.completed) continue;
    const match = catalogBySlug.get(prog.slug);
    if (!match) continue;
    continueReading = {
      slug: match.slug,
      language: match.language,
      title: match.title,
      titleZh: match.titleZh,
      summaryZh: match.summaryZh,
      topic: match.topic,
      level: match.level,
      durationMin: match.durationMin,
      contentKind: match.contentKind,
      sourceLabel: match.sourceLabel,
      lastParagraphIndex: prog.lastParagraphIndex,
      totalParagraphs: prog.totalParagraphs || match.paragraphCount,
      updatedAt: prog.updatedAt
    };
    break;
  }

  const mixed = mixLecturaRecommendations(
    enriched.map((item) => ({
      ...item,
      sortWeight: catalogBySlug.get(item.slug)?.sortWeight ?? 0
    }))
  );

  // 统计可用来源列表（供「来源列表」独立入口展示）
  const sourceMap = new Map<
    string,
    { id: string; label: string; contentKind: LecturaContentKind; count: number }
  >();
  for (const item of mixed) {
    const existing = sourceMap.get(item.sourceId);
    if (existing) {
      existing.count += 1;
    } else {
      sourceMap.set(item.sourceId, {
        id: item.sourceId,
        label: item.source,
        contentKind: item.contentKind,
        count: 1
      });
    }
  }

  return {
    language,
    items: mixed,
    continueReading,
    sources: Array.from(sourceMap.values())
  };
}

export async function getCatalogStoryBySlug(slug: string): Promise<LecturaCatalogItem | null> {
  const staticHit = lecturaStories.find((item) => item.slug === slug);

  // 先查 DB LecturaCatalog（含已增强中文导读的短文 + 核验博客/新闻）
  try {
    const dbRow = await prisma.lecturaCatalog.findUnique({ where: { slug } });
    if (dbRow) {
      return {
        slug: dbRow.slug,
        language: normalizeLanguage(dbRow.language),
        contentKind:
          dbRow.contentKind === "blog" || dbRow.contentKind === "news" ? dbRow.contentKind : "story",
        sourceId: dbRow.sourceId,
        sourceLabel: dbRow.sourceLabel,
        title: dbRow.title,
        titleZh: dbRow.titleZh,
        summaryZh: dbRow.summaryZh,
        topic: dbRow.topic,
        level:
          dbRow.level === "A1" || dbRow.level === "A2" || dbRow.level === "B1" ? dbRow.level : null,
        levelSource:
          dbRow.levelSource === "curated" || dbRow.levelSource === "inferred"
            ? dbRow.levelSource
            : null,
        durationMin: dbRow.durationMin,
        paragraphs: parseJsonStringArray(dbRow.paragraphs),
        paragraphCount: dbRow.paragraphCount,
        isFullText: dbRow.isFullText,
        bodyStatus: dbRow.bodyStatus === "excerpt" ? "excerpt" : "ready",
        glossary: parseJsonGlossary(dbRow.glossary),
        audioUrl: dbRow.audioUrl,
        audioType: dbRow.audioType === "native" ? "native" : "tts",
        coverUrl: dbRow.coverUrl,
        sourceUrl: dbRow.sourceUrl,
        publishedAt: dbRow.publishedAt
      };
    }
  } catch {
    // Fallback below
  }

  const esSeeds = await readSpanishSeedJson();
  const seedHit = esSeeds.find((item) => item.slug === slug);
  if (seedHit) return seedHit;

  if (staticHit) {
    return {
      slug: staticHit.slug,
      language: normalizeLanguage(staticHit.language),
      contentKind: "story",
      sourceId: "esponal-curated",
      sourceLabel: staticHit.source || "Esponal 分级短文",
      title: staticHit.title,
      titleZh: staticHit.titleZh,
      summaryZh: staticHit.summaryZh,
      topic: inferCuratedStoryTopic(staticHit),
      level: staticHit.level,
      levelSource: "curated",
      durationMin: staticHit.durationMin,
      paragraphs: staticHit.paragraphs,
      paragraphCount: staticHit.paragraphs.length,
      isFullText: true,
      bodyStatus: "ready",
      glossary: staticHit.glossary ?? [],
      audioUrl: null,
      audioType: "tts",
      coverUrl: null,
      sourceUrl: null,
      publishedAt: ""
    };
  }

  const crawled = await getCrawledLecturaStoryBySlug(slug).catch(() => null);
  if (!crawled) return null;

  const lang = normalizeLanguage(crawled.language);
  return {
    slug: crawled.slug,
    language: lang,
    contentKind: crawled.feedId === "juan" || crawled.feedId === "slowgerman" ? "blog" : "news",
    sourceId: crawled.feedId,
    sourceLabel: crawled.source,
    title: crawled.title,
    titleZh: crawled.titleZh,
    summaryZh: crawled.summaryZh,
    topic: crawled.feedId === "bbc" || crawled.feedId === "rfi" ? "时事热点" : "生活文化",
    level: crawled.level ?? null,
    levelSource: "inferred",
    durationMin: crawled.durationMin,
    paragraphs: crawled.paragraphs,
    paragraphCount: crawled.paragraphs.length,
    isFullText: crawled.paragraphs.length < 120,
    bodyStatus: crawled.paragraphs.length >= 4 ? "ready" : "failed",
    glossary: [],
    audioUrl: crawled.audioUrl ?? null,
    audioType: crawled.audioUrl ? "native" : "tts",
    coverUrl: crawled.coverUrl ?? null,
    sourceUrl: crawled.sourceUrl,
    publishedAt: crawled.publishedAt
  };
}

export async function getNextRecommendationAfterRead(params: {
  current: LecturaCatalogItem;
  userId: string | null;
}): Promise<NextStoryRecommendation | null> {
  const { current, userId } = params;
  const candidates = await loadReadyLecturaCatalog(current.language);

  const completedSlugs = new Set<string>();
  let savedWords: string[] = [];

  if (userId) {
    const [reads, recentWords] = await Promise.all([
      prisma.lecturaRead
        .findMany({
          where: { userId, completed: true },
          select: { slug: true }
        })
        .catch(() => []),
      prisma.word
        .findMany({
          where: { userId, language: current.language },
          orderBy: { createdAt: "desc" },
          take: 30,
          select: { lemma: true, forms: true }
        })
        .catch(() => [])
    ]);
    for (const r of reads) completedSlugs.add(r.slug);
    savedWords = recentWords.flatMap((w) => [w.lemma, ...(w.forms ?? [])]).filter(Boolean);
  }

  return recommendNextLecturaStory({
    current,
    candidates,
    completedSlugs,
    savedWords
  });
}
