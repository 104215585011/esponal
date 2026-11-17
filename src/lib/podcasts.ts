// Timestamp: 2026-11-17 15:05
import { normalizeLanguage, type LearningLanguage } from "@/lib/languages";
import {
  extractOgImageFromHtml,
  fetchFeedXml,
  parseRssFeed,
  readJsonCache,
  stableShortHash,
  stripHtmlToText,
  writeJsonCache,
} from "@/lib/rss-shared";

export type PodcastShow = {
  id: string;
  language: LearningLanguage;
  title: string;
  host: string;
  level: "A2" | "B1";
  description: string;
  feedUrl: string;
  coverUrl: string;
};

export type PodcastEpisode = {
  id: string;
  language: LearningLanguage;
  showId: string;
  showTitle: string;
  level: "A2" | "B1";
  title: string;
  description: string;
  audioUrl: string;
  coverUrl: string;
  durationSec: number | null;
  publishedAt: string;
  link: string;
};

export const CURATED_PODCASTS: PodcastShow[] = [
  {
    id: "hoy-hablamos",
    language: "es",
    title: "Hoy Hablamos",
    host: "Roi & Paco",
    level: "B1",
    description: "每日 10 分钟西班牙语新闻、文化与地道表达，语速适中适合精听。",
    feedUrl: "https://www.hoyhablamos.com/feed/podcast/",
    coverUrl:
      "https://is1-ssl.mzstatic.com/image/thumb/Podcasts125/v4/72/ee/37/72ee370b-3d51-27f2-92a2-37a3a3057391/mza_4998403547888481662.jpg/600x600bb.jpg",
  },
  {
    id: "espanol-con-juan",
    language: "es",
    title: "Español con Juan",
    host: "Juan Fernández",
    level: "A2",
    description: "用自然故事与反复重述建立听力语感，非常适合 A2-B1 进阶。",
    feedUrl: "https://1001reasonstolearnspanish.com/feed/",
    coverUrl: "https://1001reasonstolearnspanish.com/wp-content/uploads/powerpress/itunes_profile.jpg",
  },
  {
    id: "slow-german",
    language: "de",
    title: "Slow German mit Annik Rubens",
    host: "Annik Rubens",
    level: "A2",
    description: "德国记者 Annik Rubens 慢速清晰朗读文化、生活与日常主题，每期附完整德语源文稿。",
    feedUrl: "https://slowgerman.com/feed/",
    coverUrl:
      "https://is1-ssl.mzstatic.com/image/thumb/Podcasts123/v4/19/f6/0b/19f60bbe-3bb3-ce26-b346-e60dfbb3518c/mza_3134750145267089852.jpg/600x600bb.jpg",
  },
  {
    id: "bbc-6-minute-english",
    language: "en",
    title: "6 Minute English (BBC)",
    host: "BBC Learning English",
    level: "A2",
    description: "BBC 经典 6 分钟英音精听节目，每期聚焦一个生活或社会话题，结构紧凑易跟听。",
    feedUrl: "https://podcasts.files.bbci.co.uk/p02pc9tn.rss",
    coverUrl:
      "https://is1-ssl.mzstatic.com/image/thumb/Podcasts211/v4/ba/98/35/ba9835eb-1ef3-60e4-bf05-3d141b8d1c7a/mza_3844641997714022659.jpg/600x600bb.jpg",
  },
  {
    id: "innerfrench",
    language: "fr",
    title: "InnerFrench",
    host: "Hugo Cotton",
    level: "A2",
    description: "口碑极高的中慢速法语可理解输入播客，吐字清晰、围绕社会文化深度讲述。",
    feedUrl: "https://podcast.innerfrench.com/feed.xml",
    coverUrl:
      "https://is1-ssl.mzstatic.com/image/thumb/Podcasts126/v4/5f/4b/51/5f4b5121-b307-4b0c-4ba9-3fba7aba161d/mza_1141892237621262066.jpg/600x600bb.jpg",
  },
  {
    id: "rfi-francais-facile",
    language: "fr",
    title: "Journal en français facile (RFI)",
    host: "RFI Savoirs",
    level: "B1",
    description: "法广 RFI 每日十分钟慢速法语国际新闻简报，用词规范，适合积累时事表达。",
    feedUrl: "https://francaisfacile.rfi.fr/fr/podcasts/journal-en-fran%C3%A7ais-facile/podcast",
    coverUrl:
      "https://is1-ssl.mzstatic.com/image/thumb/Podcasts126/v4/e8/5c/ac/e85cacb6-6ef2-e0fa-bbc3-e4bfc135b2bf/mza_10847007516377223831.jpg/600x600bb.jpg",
  },
  {
    id: "nihongo-con-teppei",
    language: "ja",
    title: "Nihongo con Teppei (Beginners)",
    host: "Teppei",
    level: "A2",
    description: "专为初级日语学习者录制的 4 分钟自然日语闲聊，高频复现日常词汇与生活语法。",
    feedUrl: "http://nihongoconteppei.com/feed/podcast",
    coverUrl:
      "https://is1-ssl.mzstatic.com/image/thumb/Podcasts123/v4/6a/30/4c/6a304ce0-6794-5472-f436-c687bdda2745/mza_7253643594919702969.png/600x600bb.jpg",
  },
  {
    id: "japanese-with-shun",
    language: "ja",
    title: "Japanese with Shun",
    host: "Shun",
    level: "A2",
    description: "围绕 JLPT N5–N4 日常词汇展开的温和日语听力节目，语速友善清晰。",
    feedUrl: "https://feeds.redcircle.com/e8ab057c-683d-4375-a197-2dcc42d4f851",
    coverUrl:
      "https://is1-ssl.mzstatic.com/image/thumb/Podcasts221/v4/8a/8e/3e/8a8e3e9f-6810-1658-a4aa-a16bcef05960/mza_7363683509923378665.jpg/600x600bb.jpg",
  },
];

const PODCAST_CACHE_KEY = "listening:podcasts:v6";
const COVER_CACHE_PREFIX = "listening:cover:v2:";
const PODCAST_TTL_SEC = 6 * 3600;
const COVER_TTL_SEC = 7 * 24 * 3600;
let memoryPodcastCache: { expiresAt: number; episodes: PodcastEpisode[] } | null = null;
const memoryCoverCache = new Map<string, string>();

async function resolveEpisodeCover(link: string, fallbackCover: string): Promise<string> {
  if (!link || !/^https?:\/\//i.test(link)) return fallbackCover;

  const mem = memoryCoverCache.get(link);
  if (mem) return mem;

  const cacheKey = `${COVER_CACHE_PREFIX}${stableShortHash(link)}`;
  const cached = await readJsonCache<string>(cacheKey);
  if (cached) {
    memoryCoverCache.set(link, cached);
    return cached;
  }

  try {
    const res = await fetch(link, {
      headers: {
        "User-Agent":
          "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0.0.0 Safari/537.36",
        Accept: "text/html,application/xhtml+xml",
      },
      redirect: "follow",
      signal: AbortSignal.timeout(4500),
    });
    if (res.ok) {
      const html = await res.text();
      const og = extractOgImageFromHtml(html, link);
      const resolved = og || fallbackCover;
      memoryCoverCache.set(link, resolved);
      void writeJsonCache(cacheKey, resolved, COVER_TTL_SEC);
      return resolved;
    }
  } catch {
    // 抓取超时时使用节目官方封面兜底
  }

  return fallbackCover;
}

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

export async function fetchPodcastEpisodes(
  forceRefresh = false,
  language?: string | null
): Promise<PodcastEpisode[]> {
  const filterByLang = (list: PodcastEpisode[]) => {
    if (!language) return list;
    const target = normalizeLanguage(language);
    return list.filter((ep) => normalizeLanguage(ep.language) === target);
  };

  if (!forceRefresh) {
    if (memoryPodcastCache && memoryPodcastCache.expiresAt > Date.now()) {
      return filterByLang(memoryPodcastCache.episodes);
    }
    const cached = await readJsonCache<PodcastEpisode[]>(PODCAST_CACHE_KEY);
    if (cached && cached.length > 0) {
      memoryPodcastCache = { expiresAt: Date.now() + 10 * 60 * 1000, episodes: cached };
      return filterByLang(cached);
    }
  }

  const settled = await Promise.allSettled(
    CURATED_PODCASTS.map(async (show) => {
      const xml = await fetchFeedXml(show.feedUrl, 6500);
      const { channelImageUrl, items } = parseRssFeed(xml, 10);
      const audioItems = items.filter(
        (item) => item.enclosureUrl && /^https?:\/\//i.test(item.enclosureUrl),
      );
      return Promise.all(
        audioItems.map(async (item): Promise<PodcastEpisode> => {
          const fullText = stripHtmlToText(item.contentHtml || item.description);
          const cleanDesc = (fullText || item.description).slice(0, 8000);
          const fallbackCover = item.coverUrl || show.coverUrl || channelImageUrl || "";
          const coverUrl = item.coverUrl
            ? item.coverUrl
            : await resolveEpisodeCover(item.link, fallbackCover);
          return {
            id: `${show.id}-${stableShortHash(item.enclosureUrl!)}`,
            language: show.language,
            showId: show.id,
            showTitle: show.title,
            level: show.level,
            title: item.title,
            description: cleanDesc,
            audioUrl: item.enclosureUrl!,
            coverUrl,
            durationSec: parseDurationToSeconds(item.durationRaw),
            publishedAt: item.pubDate,
            link: item.link,
          };
        }),
      );
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

  return filterByLang(episodes);
}
