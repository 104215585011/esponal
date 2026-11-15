// Timestamp: 2026-11-15 14:20
import {
  fetchFeedXml,
  parseRssItems,
  readJsonCache,
  stableShortHash,
  stripHtmlToText,
  writeJsonCache,
} from "@/lib/rss-shared";

export type PodcastShow = {
  id: string;
  title: string;
  host: string;
  level: "A2" | "B1";
  description: string;
  feedUrl: string;
};

export type PodcastEpisode = {
  id: string;
  showId: string;
  showTitle: string;
  level: "A2" | "B1";
  title: string;
  description: string;
  audioUrl: string;
  durationSec: number | null;
  publishedAt: string;
  link: string;
};

export const CURATED_PODCASTS: PodcastShow[] = [
  {
    id: "hoy-hablamos",
    title: "Hoy Hablamos",
    host: "Roi & Paco",
    level: "B1",
    description: "每日 10 分钟西班牙语新闻、文化与地道表达，语速适中适合精听。",
    feedUrl: "https://www.hoyhablamos.com/feed/podcast/",
  },
  {
    id: "espanol-con-juan",
    title: "Español con Juan",
    host: "Juan Fernández",
    level: "A2",
    description: "用自然故事与反复重述建立听力语感，非常适合 A2-B1 进阶。",
    feedUrl: "https://1001reasonstolearnspanish.com/feed/",
  },
];

const PODCAST_CACHE_KEY = "listening:podcasts:v2";
const PODCAST_TTL_SEC = 6 * 3600;
let memoryPodcastCache: { expiresAt: number; episodes: PodcastEpisode[] } | null = null;

function parseDurationToSeconds(raw: string | null): number | null {
  if (!raw) return null;
  const trimmed = raw.trim();
  if (/^\d+$/.test(trimmed)) return Number(trimmed);
  const parts = trimmed.split(":").map((p) => Number(p));
  if (parts.some((n) => !Number.isFinite(n))) return null;
  if (parts.length === 3) return parts[0] * 3600 + parts[1] * 60 + parts[2];
  if (parts.length === 2) return parts[0] * 60 + parts[1];
  return null;
}

export async function fetchPodcastEpisodes(forceRefresh = false): Promise<PodcastEpisode[]> {
  if (!forceRefresh) {
    if (memoryPodcastCache && memoryPodcastCache.expiresAt > Date.now()) {
      return memoryPodcastCache.episodes;
    }
    const cached = await readJsonCache<PodcastEpisode[]>(PODCAST_CACHE_KEY);
    if (cached && cached.length > 0) {
      memoryPodcastCache = { expiresAt: Date.now() + 10 * 60 * 1000, episodes: cached };
      return cached;
    }
  }

  const settled = await Promise.allSettled(
    CURATED_PODCASTS.map(async (show) => {
      const xml = await fetchFeedXml(show.feedUrl, 6500);
      const items = parseRssItems(xml, 10);
      return items
        .filter((item) => item.enclosureUrl && /^https?:\/\//i.test(item.enclosureUrl))
        .map((item): PodcastEpisode => {
          const fullText = stripHtmlToText(item.contentHtml || item.description);
          const cleanDesc = (fullText || item.description).slice(0, 6000);
          return {
            id: `${show.id}-${stableShortHash(item.enclosureUrl!)}`,
            showId: show.id,
            showTitle: show.title,
            level: show.level,
            title: item.title,
            description: cleanDesc,
            audioUrl: item.enclosureUrl!,
            durationSec: parseDurationToSeconds(item.durationRaw),
            publishedAt: item.pubDate,
            link: item.link,
          };
        });
    }),
  );

  const episodes: PodcastEpisode[] = [];
  for (const res of settled) {
    if (res.status === "fulfilled") {
      episodes.push(...res.value);
    }
  }

  // 按发布时间倒序交叉呈现
  episodes.sort((a, b) => {
    const ta = Date.parse(a.publishedAt) || 0;
    const tb = Date.parse(b.publishedAt) || 0;
    return tb - ta;
  });

  if (episodes.length > 0) {
    memoryPodcastCache = { expiresAt: Date.now() + 10 * 60 * 1000, episodes };
    await writeJsonCache(PODCAST_CACHE_KEY, episodes, PODCAST_TTL_SEC);
  }

  return episodes;
}
