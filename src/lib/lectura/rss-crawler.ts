// Timestamp: 2026-11-15 14:20
import { type LecturaStory } from "@/../content/lectura";
import {
  extractArticleParagraphsFromHtml,
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

const LIST_CACHE_KEY = "lectura:rss:stories:v2";
const STORY_CACHE_PREFIX = "lectura:rss:story:v2:";
const LIST_TTL_SEC = 6 * 3600;
const STORY_TTL_SEC = 24 * 3600;

let memoryListCache: { expiresAt: number; items: CrawledLecturaItem[] } | null = null;
const memoryStoryCache = new Map<string, CrawledLecturaItem>();

function toParagraphsFromText(text: string): string[] {
  const parts = text
    .split(/\n{2,}/)
    .map((p) => p.replace(/\s+/g, " ").trim())
    .filter((p) => p.length >= 20);
  if (parts.length > 0) return parts.slice(0, 35);
  return text.trim() ? [text.trim()] : [];
}

function estimateReadingMinutes(paragraphs: string[]): number {
  const words = paragraphs.join(" ").split(/\s+/).filter(Boolean).length;
  return Math.max(2, Math.min(12, Math.ceil(words / 110)));
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
      const xml = await fetchFeedXml(feed.url, 6000);
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
          summaryZh: fallbackSummary.slice(0, 160),
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

  const items: CrawledLecturaItem[] = [];
  for (const res of results) {
    if (res.status === "fulfilled") {
      items.push(...res.value);
    }
  }

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
  if (mem) return mem;

  const redisHit = await readJsonCache<CrawledLecturaItem>(`${STORY_CACHE_PREFIX}${slug}`);
  if (redisHit) {
    memoryStoryCache.set(slug, redisHit);
    return redisHit;
  }

  const list = await crawlLecturaRssFeeds(false);
  const base = list.find((item) => item.slug === slug);
  if (!base) return null;

  // 若列表段落较少或为博客摘要，抓取原文 HTML 补全完整段落
  let paragraphs = base.paragraphs;
  if (paragraphs.length <= 4 && base.sourceUrl) {
    try {
      const response = await fetch(base.sourceUrl, {
        headers: {
          "User-Agent": "Mozilla/5.0 (compatible; EsponalReader/1.0)",
          Accept: "text/html,application/xhtml+xml",
        },
        signal: AbortSignal.timeout(6500),
        cache: "no-store",
      });
      if (response.ok) {
        const html = await response.text();
        const extracted = extractArticleParagraphsFromHtml(html, 35);
        if (extracted.length > paragraphs.length) {
          paragraphs = extracted;
        }
      }
    } catch {
      // 保留 RSS 摘要作为兜底正文
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
