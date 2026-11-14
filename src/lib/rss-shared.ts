// Timestamp: 2026-11-15 07:40
import { createHash } from "node:crypto";
import { redis } from "@/lib/redis";

export type ParsedRssItem = {
  title: string;
  link: string;
  pubDate: string;
  description: string;
  contentHtml: string;
  enclosureUrl: string | null;
  enclosureType: string | null;
  durationRaw: string | null;
};

export function decodeHtmlEntities(value: string): string {
  return value
    .replace(/<!\[CDATA\[([\s\S]*?)\]\]>/g, "$1")
    .replace(/&nbsp;/gi, " ")
    .replace(/&amp;/gi, "&")
    .replace(/&lt;/gi, "<")
    .replace(/&gt;/gi, ">")
    .replace(/&quot;/gi, "\"")
    .replace(/&#39;|&apos;/gi, "'")
    .replace(/&#x([0-9a-f]+);/gi, (_, hex: string) =>
      String.fromCodePoint(Number.parseInt(hex, 16)),
    )
    .replace(/&#(\d+);/g, (_, code: string) =>
      String.fromCodePoint(Number.parseInt(code, 10)),
    );
}

export function stripHtmlToText(html: string): string {
  return decodeHtmlEntities(html)
    .replace(/<script[\s\S]*?<\/script>/gi, " ")
    .replace(/<style[\s\S]*?<\/style>/gi, " ")
    .replace(/<br\s*\/?>/gi, "\n")
    .replace(/<\/p>/gi, "\n\n")
    .replace(/<[^>]+>/g, " ")
    .replace(/[ \t\r\f\v]+/g, " ")
    .replace(/\n{3,}/g, "\n\n")
    .trim();
}

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

export function parseRssItems(xml: string, limit = 15): ParsedRssItem[] {
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

    items.push({
      title,
      link,
      pubDate,
      description,
      contentHtml,
      enclosureUrl: enclosure.url,
      enclosureType: enclosure.type,
      durationRaw,
    });
  }
  return items;
}

export function extractArticleParagraphsFromHtml(html: string, maxParagraphs = 14): string[] {
  // 去掉导航/脚本/页脚干扰
  const cleaned = html
    .replace(/<script[\s\S]*?<\/script>/gi, " ")
    .replace(/<style[\s\S]*?<\/style>/gi, " ")
    .replace(/<noscript[\s\S]*?<\/noscript>/gi, " ")
    .replace(/<(header|nav|footer|aside|form)[\s\S]*?<\/\1>/gi, " ");

  const mainScope =
    cleaned.match(/<article\b[^>]*>([\s\S]*?)<\/article>/i)?.[1] ??
    cleaned.match(/<main\b[^>]*>([\s\S]*?)<\/main>/i)?.[1] ??
    cleaned;

  const paragraphs: string[] = [];
  const seen = new Set<string>();
  const matches = mainScope.matchAll(/<p\b[^>]*>([\s\S]*?)<\/p>/gi);

  for (const match of matches) {
    const text = stripHtmlToText(match[1]).replace(/\s+/g, " ").trim();
    if (text.length < 40 || text.length > 900) continue;
    // 排除 CSS/JS 残留或版权提示
    if (/[{};]/.test(text.slice(0, 80)) && text.includes("{")) continue;
    if (/cookies|política de privacidad|derechos de autor/i.test(text)) continue;
    if (seen.has(text)) continue;
    seen.add(text);
    paragraphs.push(text);
    if (paragraphs.length >= maxParagraphs) break;
  }

  return paragraphs;
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
