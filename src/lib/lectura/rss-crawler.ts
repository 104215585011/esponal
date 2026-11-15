// Timestamp: 2026-11-15 15:10
import { type LecturaStory } from "@/../content/lectura";
import {
  extractArticleParagraphsFromHtml,
  extractArticleParagraphsFromMarkdown,
  fetchFeedXml,
  parseRssItems,
  readJsonCache,
  stableShortHash,
  stripHtmlToText,
  writeJsonCache,
} from "@/lib/rss-shared";

export type CrawledLecturaItem = LecturaStory & {
  sourceUrl: string;
  audioUrl?: string;
  publishedAt: string;
  feedId: string;
};

type FeedSource = {
  id: string;
  label: string;
  url: string;
  defaultLevel: "A2" | "B1";
  limit: number;
};

const NEWS_FEEDS: FeedSource[] = [
  {
    id: "rfi",
    label: "RFI 西语之声",
    url: "https://www.rfi.fr/es/rss",
    defaultLevel: "B1",
    limit: 5,
  },
  {
    id: "bbc",
    label: "BBC Mundo",
    url: "https://feeds.bbci.co.uk/mundo/rss.xml",
    defaultLevel: "B1",
    limit: 5,
  },
  {
    id: "juan",
    label: "Español con Juan 博客",
    url: "https://1001reasonstolearnspanish.com/feed/",
    defaultLevel: "A2",
    limit: 4,
  },
];

// v3 缓存命名空间：全量刷新此前截断的 RFI / 博客短文，补全原文完整段落
const LIST_CACHE_KEY = "lectura:rss:stories:v3";
const STORY_CACHE_PREFIX = "lectura:rss:story:v3:";
const LIST_TTL_SEC = 6 * 3600;
const STORY_TTL_SEC = 24 * 3600;

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
  const words = paragraphs.join(" ").split(/\s+/).filter(Boolean).length;
  return Math.max(2, Math.min(15, Math.ceil(words / 110)));
}

/**
 * 抓取原文完整段落：先直连原文 HTML；遇到反爬 403（如 RFI）或提取过少时，自动走 Jina Reader 提取干净正文。
 */
async function fetchFullArticleParagraphs(sourceUrl: string): Promise<string[]> {
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
      const extracted = extractArticleParagraphsFromHtml(html, 35);
      if (extracted.length >= 4) {
        return extracted;
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
      return extractArticleParagraphsFromMarkdown(md, 35);
    }
  } catch {
    // 保留 RSS 原文摘要
  }

  return [];
}

async function enrichShortItems(items: CrawledLecturaItem[]): Promise<CrawledLecturaItem[]> {
  const enriched = await Promise.all(
    items.map(async (item) => {
      if (item.paragraphs.length >= 6 || !item.sourceUrl) {
        return item;
      }
      const full = await fetchFullArticleParagraphs(item.sourceUrl);
      if (full.length <= item.paragraphs.length) {
        return item;
      }
      const next: CrawledLecturaItem = {
        ...item,
        paragraphs: full,
        durationMin: estimateReadingMinutes(full),
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
      const parsed = parseRssItems(xml, feed.limit);
      return parsed.map((entry): CrawledLecturaItem => {
        const slug = `rss-${feed.id}-${stableShortHash(entry.link)}`;
        const inlineParagraphs = toParagraphsFromText(stripHtmlToText(entry.contentHtml));
        const fallbackSummary = entry.description || inlineParagraphs[0] || entry.title;
        return {
          slug,
          title: entry.title,
          titleZh: `${feed.label} · 真实西语阅读`,
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
  if (paragraphs.length < 6 && base.sourceUrl) {
    const extracted = await fetchFullArticleParagraphs(base.sourceUrl);
    if (extracted.length > paragraphs.length) {
      paragraphs = extracted;
    }
  }

  const fullStory: CrawledLecturaItem = {
    ...base,
    paragraphs,
    durationMin: estimateReadingMinutes(paragraphs),
  };

  memoryStoryCache.set(slug, fullStory);
  await writeJsonCache(`${STORY_CACHE_PREFIX}${slug}`, fullStory, STORY_TTL_SEC);
  return fullStory;
}
