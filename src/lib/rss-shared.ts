// Timestamp: 2026-11-16 09:05
import { createHash } from "node:crypto";
import { redis } from "@/lib/redis";
import {
  decodeHtmlEntities,
  extractArticleParagraphsFromHtml,
  extractArticleParagraphsFromMarkdown,
  extractCoverUrlFromRssBlock,
  extractOgImageFromHtml,
  normalizeCoverUrl,
  stripHtmlToText,
} from "@/lib/rss-extract";

export {
  decodeHtmlEntities,
  extractArticleParagraphsFromHtml,
  extractArticleParagraphsFromMarkdown,
  extractCoverUrlFromRssBlock,
  extractOgImageFromHtml,
  normalizeCoverUrl,
  stripHtmlToText,
};

export type ParsedRssItem = {
  title: string;
  link: string;
  pubDate: string;
  description: string;
  contentHtml: string;
  enclosureUrl: string | null;
  enclosureType: string | null;
  durationRaw: string | null;
  coverUrl: string | null;
};

export function extractXmlTag(block: string, tag: string): string {
  const escaped = tag.replace(":", "\\:");
  const match = block.match(
    new RegExp(`<${escaped}(?:\\s[^>]*)?>([\\s\\S]*?)<\\/${escaped}>`, "i"),
  );
  if (!match) return "";
  return decodeHtmlEntities(match[1]).trim();
}

function extractEnclosure(block: string): { url: string | null; type: string | null } {
  const match = block.match(/<enclosure\b([^>]*)\/?>/i);
  if (!match) return { url: null, type: null };
  const attrs = match[1];
  const url = attrs.match(/\burl=["']([^"']+)["']/i)?.[1] ?? null;
  const type = attrs.match(/\btype=["']([^"']+)["']/i)?.[1] ?? null;
  return { url: url ? decodeHtmlEntities(url) : null, type };
}

export function parseRssFeed(
  xml: string,
  limit = 15,
): { channelImageUrl: string | null; items: ParsedRssItem[] } {
  const firstItemIdx = xml.search(/<item\b/i);
  const channelHeader = firstItemIdx >= 0 ? xml.slice(0, firstItemIdx) : xml.slice(0, 8000);
  const channelImageUrl = extractCoverUrlFromRssBlock(channelHeader);

  const items: ParsedRssItem[] = [];
  const itemMatches = xml.matchAll(/<item\b[^>]*>([\s\S]*?)<\/item>/gi);
  for (const match of itemMatches) {
    if (items.length >= limit) break;
    const block = match[1];
    const title = stripHtmlToText(extractXmlTag(block, "title"));
    const link = extractXmlTag(block, "link");
    if (!title || !link) continue;

    const pubDate = extractXmlTag(block, "pubDate");
    const description = stripHtmlToText(extractXmlTag(block, "description"));
    const contentHtml =
      extractXmlTag(block, "content:encoded") || extractXmlTag(block, "description");
    const enclosure = extractEnclosure(block);
    const durationRaw = extractXmlTag(block, "itunes:duration") || null;
    const coverUrl = extractCoverUrlFromRssBlock(block, contentHtml, link);

    items.push({
      title,
      link,
      pubDate,
      description,
      contentHtml,
      enclosureUrl: enclosure.url,
      enclosureType: enclosure.type,
      durationRaw,
      coverUrl,
    });
  }
  return { channelImageUrl, items };
}

export function parseRssItems(xml: string, limit = 15): ParsedRssItem[] {
  return parseRssFeed(xml, limit).items;
}

export function stableShortHash(input: string): string {
  return createHash("sha1").update(input).digest("hex").slice(0, 10);
}

export async function readJsonCache<T>(key: string): Promise<T | null> {
  try {
    const raw = await redis.get(key);
    if (!raw) return null;
    return JSON.parse(raw) as T;
  } catch {
    return null;
  }
}

export async function writeJsonCache(key: string, value: unknown, ttlSec: number): Promise<void> {
  try {
    await redis.set(key, JSON.stringify(value), "EX", ttlSec);
  } catch {
    // Redis 不可用时不影响主流程
  }
}

export async function fetchFeedXml(url: string, timeoutMs = 6000): Promise<string> {
  const response = await fetch(url, {
    headers: {
      "User-Agent": "EsponalReader/1.0 (+https://www.pcmuz.cn)",
      Accept: "application/rss+xml, application/xml, text/xml, */*",
    },
    signal: AbortSignal.timeout(timeoutMs),
    cache: "no-store",
  });
  if (!response.ok) {
    throw new Error(`Feed fetch failed: ${response.status}`);
  }
  return response.text();
}
