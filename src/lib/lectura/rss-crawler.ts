// Timestamp: 2026-11-17 23:05
import { type LecturaStory } from "@/../content/lectura";
import { normalizeLanguage, type LearningLanguage } from "@/lib/languages";
import {
  extractArticleParagraphsFromHtml,
  extractArticleParagraphsFromMarkdown,
  extractOgImageFromHtml,
  fetchFeedXml,
  parseRssFeed,
  readJsonCache,
  stableShortHash,
  stripHtmlToText,
  writeJsonCache,
} from "@/lib/rss-shared";

export type CrawledLecturaItem = LecturaStory & {
  language: LearningLanguage;
  sourceUrl: string;
  audioUrl?: string;
  coverUrl?: string;
  publishedAt: string;
  feedId: string;
};

type FeedSource = {
  id: string;
  label: string;
  language: LearningLanguage;
  url: string;
  defaultLevel: "A2" | "B1";
  limit: number;
};

const NEWS_FEEDS: FeedSource[] = [
  {
    id: "rfi",
    label: "RFI 西语之声",
    language: "es",
    url: "https://www.rfi.fr/es/rss",
    defaultLevel: "B1",
    limit: 5,
  },
  {
    id: "bbc",
    label: "BBC Mundo",
    language: "es",
    url: "https://feeds.bbci.co.uk/mundo/rss.xml",
    defaultLevel: "B1",
    limit: 5,
  },
  {
    id: "juan",
    label: "Español con Juan 博客",
    language: "es",
    url: "https://1001reasonstolearnspanish.com/feed/",
    defaultLevel: "A2",
    limit: 4,
  },
  {
    id: "slowgerman",
    label: "Slow German 博客",
    language: "de",
    url: "https://slowgerman.com/feed/",
    defaultLevel: "A2",
    limit: 5,
  },
  {
    id: "guardian",
    label: "The Guardian",
    language: "en",
    url: "https://www.theguardian.com/world/rss",
    defaultLevel: "B1",
    limit: 5,
  },
  {
    id: "rfifr",
    label: "RFI 法语之声",
    language: "fr",
    url: "https://www.rfi.fr/fr/rss",
    defaultLevel: "B1",
    limit: 5,
  },
  {
    id: "nhk",
    label: "NHK News",
    language: "ja",
    url: "https://www.nhk.or.jp/rss/news/cat0.xml",
    defaultLevel: "B1",
    limit: 5,
  },
];

// v7 缓存命名空间：新增 en / fr / ja 三语真实阅读 RSS 源
const LIST_CACHE_KEY = "lectura:rss:stories:v7";
const STORY_CACHE_PREFIX = "lectura:rss:story:v7:";
const LIST_TTL_SEC = 6 * 3600;
const STORY_TTL_SEC = 24 * 3600;

const LANG_READ_SUFFIX: Record<LearningLanguage, string> = {
  es: "真实西语阅读",
  de: "真实德语阅读",
  en: "真实英语阅读",
  fr: "真实法语阅读",
  ja: "真实日语阅读",
};

let memoryListCache: { expiresAt: number; items: CrawledLecturaItem[] } | null = null;
const memoryStoryCache = new Map<string, CrawledLecturaItem>();

function toParagraphsFromText(text: string): string[] {
  const parts = text
    .split(/\n{2,}/)
    .map((p) => p.replace(/\s+/g, " ").trim())
    .filter((p) => p.length >= 25);
  if (parts.length > 0) return parts.slice(0, 35);
  return text.trim() ? [text.trim()] : [];
}

function estimateReadingMinutes(paragraphs: string[]): number {
  const joined = paragraphs.join(" ").trim();
  const words = joined.split(/\s+/).filter(Boolean).length;
  // 日语等无空格文本按字符数折算
  const effectiveUnits = Math.max(words, Math.ceil(joined.length / 4));
  return Math.max(2, Math.min(15, Math.ceil(effectiveUnits / 110)));
}

/**
 * 抓取原文完整段落：先直连原文 HTML；遇到反爬 403（如 RFI）或提取过少时，自动走 Jina Reader 提取干净正文。
 */
async function fetchFullArticleData(
  sourceUrl: string,
): Promise<{ paragraphs: string[]; ogImage: string | null }> {
  let ogImage: string | null = null;
  try {
    const response = await fetch(sourceUrl, {
      headers: {
        "User-Agent":
          "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/126.0.0.0 Safari/537.36",
        Accept: "text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8",
        "Accept-Language": "es-ES,es;q=0.9,en;q=0.8",
      },
      signal: AbortSignal.timeout(5500),
      cache: "no-store",
    });
    if (response.ok) {
      const html = await response.text();
      ogImage = extractOgImageFromHtml(html, sourceUrl);
      const extracted = extractArticleParagraphsFromHtml(html, 35);
      if (extracted.length >= 4) {
        return { paragraphs: extracted, ogImage };
      }
    }
  } catch {
    // 走 Jina Reader 兜底
  }

  try {
    const jinaRes = await fetch(`https://r.jina.ai/${sourceUrl}`, {
      headers: {
        "User-Agent": "EsponalReader/1.0 (+https://www.pcmuz.cn)",
        Accept: "text/plain, text/markdown",
      },
      signal: AbortSignal.timeout(8500),
      cache: "no-store",
    });
    if (jinaRes.ok) {
      const md = await jinaRes.text();
      return { paragraphs: extractArticleParagraphsFromMarkdown(md, 35), ogImage };
    }
  } catch {
    // 保留 RSS 原文摘要
  }

  return { paragraphs: [], ogImage };
}

async function enrichShortItems(items: CrawledLecturaItem[]): Promise<CrawledLecturaItem[]> {
  const enriched = await Promise.all(
    items.map(async (item) => {
      const needsBody = item.paragraphs.length < 6;
      const needsCover = !item.coverUrl;
      if ((!needsBody && !needsCover) || !item.sourceUrl) {
        return item;
      }
      const fetched = await fetchFullArticleData(item.sourceUrl);
      const nextParagraphs =
        needsBody && fetched.paragraphs.length > item.paragraphs.length
          ? fetched.paragraphs
          : item.paragraphs;
      const nextCover = item.coverUrl || fetched.ogImage || undefined;
      if (nextParagraphs === item.paragraphs && nextCover === item.coverUrl) {
        return item;
      }
      const next: CrawledLecturaItem = {
        ...item,
        paragraphs: nextParagraphs,
        durationMin: estimateReadingMinutes(nextParagraphs),
        coverUrl: nextCover,
      };
      memoryStoryCache.set(item.slug, next);
      void writeJsonCache(`${STORY_CACHE_PREFIX}${item.slug}`, next, STORY_TTL_SEC);
      return next;
    }),
  );
  return enriched;
}

export async function crawlLecturaRssFeeds(forceRefresh = false): Promise<CrawledLecturaItem[]> {
  if (!forceRefresh) {
    if (memoryListCache && memoryListCache.expiresAt > Date.now()) {
      return memoryListCache.items;
    }
    const cached = await readJsonCache<CrawledLecturaItem[]>(LIST_CACHE_KEY);
    if (cached && cached.length > 0) {
      memoryListCache = { expiresAt: Date.now() + 10 * 60 * 1000, items: cached };
      return cached;
    }
  }

  const results = await Promise.allSettled(
    NEWS_FEEDS.map(async (feed) => {
      const xml = await fetchFeedXml(feed.url, 6500);
      const { channelImageUrl, items: parsed } = parseRssFeed(xml, feed.limit);
      return parsed.map((entry): CrawledLecturaItem => {
        const slug = `rss-${feed.id}-${stableShortHash(entry.link)}`;
        const inlineParagraphs = toParagraphsFromText(stripHtmlToText(entry.contentHtml));
        const fallbackSummary = entry.description || inlineParagraphs[0] || entry.title;
        return {
          slug,
          language: feed.language,
          title: entry.title,
          titleZh: `${feed.label} · ${LANG_READ_SUFFIX[feed.language]}`,
          level: feed.defaultLevel,
          source: `${feed.label} RSS`,
          durationMin: estimateReadingMinutes(inlineParagraphs),
          summaryZh: fallbackSummary.slice(0, 180),
          paragraphs: inlineParagraphs.length > 0 ? inlineParagraphs : [entry.title],
          glossary: [],
          sourceUrl: entry.link,
          audioUrl:
            entry.enclosureUrl && /^https?:\/\//i.test(entry.enclosureUrl)
              ? entry.enclosureUrl
              : undefined,
          coverUrl: entry.coverUrl || channelImageUrl || undefined,
          publishedAt: entry.pubDate,
          feedId: feed.id,
        };
      });
    }),
  );

  const rawItems: CrawledLecturaItem[] = [];
  for (const res of results) {
    if (res.status === "fulfilled") {
      rawItems.push(...res.value);
    }
  }

  // 直接并发补全短文章全文，列表上即显示真实段落数与时长
  const items = rawItems.length > 0 ? await enrichShortItems(rawItems) : [];

  if (items.length > 0) {
    memoryListCache = { expiresAt: Date.now() + 10 * 60 * 1000, items };
    await writeJsonCache(LIST_CACHE_KEY, items, LIST_TTL_SEC);
  }

  return items;
}

export async function getCrawledLecturaStoryBySlug(
  slug: string,
): Promise<CrawledLecturaItem | null> {
  if (!slug.startsWith("rss-")) return null;

  const mem = memoryStoryCache.get(slug);
  if (mem && mem.paragraphs.length >= 6) return mem;

  const redisHit = await readJsonCache<CrawledLecturaItem>(`${STORY_CACHE_PREFIX}${slug}`);
  if (redisHit && redisHit.paragraphs.length >= 6) {
    memoryStoryCache.set(slug, redisHit);
    return redisHit;
  }

  const list = await crawlLecturaRssFeeds(false);
  const base = redisHit ?? list.find((item) => item.slug === slug);
  if (!base) return null;

  let paragraphs = base.paragraphs;
  let coverUrl = base.coverUrl;
  if ((paragraphs.length < 6 || !coverUrl) && base.sourceUrl) {
    const fetched = await fetchFullArticleData(base.sourceUrl);
    if (fetched.paragraphs.length > paragraphs.length) {
      paragraphs = fetched.paragraphs;
    }
    if (!coverUrl && fetched.ogImage) {
      coverUrl = fetched.ogImage;
    }
  }

  const fullStory: CrawledLecturaItem = {
    ...base,
    paragraphs,
    coverUrl,
    durationMin: estimateReadingMinutes(paragraphs),
  };

  memoryStoryCache.set(slug, fullStory);
  await writeJsonCache(`${STORY_CACHE_PREFIX}${slug}`, fullStory, STORY_TTL_SEC);
  return fullStory;
}
