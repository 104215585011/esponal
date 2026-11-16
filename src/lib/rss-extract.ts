// Timestamp: 2026-11-16 09:05
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
    .replace(/&#(\d+);/gi, (_, code: string) =>
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

const BOILERPLATE_LINE_RE =
  /^(fuente de la imagen|pie de foto|crédito|copyright|getty images|reuters|afp|efe|ap photo|suscr[ií]bete|lee tambi[eé]n|te puede interesar|compartir|publicidad|saltar al contenido)/i;

function isUsefulArticleParagraph(text: string): boolean {
  if (text.length < 40 || text.length > 1400) return false;
  if (/[{};]/.test(text.slice(0, 80)) && text.includes("{")) return false;
  if (/cookies|política de privacidad|derechos de autor|términos de uso|newsletter/i.test(text)) {
    return false;
  }
  if (BOILERPLATE_LINE_RE.test(text)) return false;
  return true;
}

export function extractArticleParagraphsFromHtml(html: string, maxParagraphs = 35): string[] {
  const cleaned = html
    .replace(/<script[\s\S]*?<\/script>/gi, " ")
    .replace(/<style[\s\S]*?<\/style>/gi, " ")
    .replace(/<noscript[\s\S]*?<\/noscript>/gi, " ")
    .replace(/<(header|nav|footer|aside|form|figcaption)[\s\S]*?<\/\1>/gi, " ");

  const mainScope =
    cleaned.match(/<article\b[^>]*>([\s\S]*?)<\/article>/i)?.[1] ??
    cleaned.match(/<main\b[^>]*>([\s\S]*?)<\/main>/i)?.[1] ??
    cleaned;

  const paragraphs: string[] = [];
  const seen = new Set<string>();
  const matches = mainScope.matchAll(/<p\b[^>]*>([\s\S]*?)<\/p>/gi);

  for (const match of matches) {
    const text = stripHtmlToText(match[1]).replace(/\s+/g, " ").trim();
    if (!isUsefulArticleParagraph(text)) continue;
    if (seen.has(text)) continue;
    seen.add(text);
    paragraphs.push(text);
    if (paragraphs.length >= maxParagraphs) break;
  }

  return paragraphs;
}

export function extractArticleParagraphsFromMarkdown(markdown: string, maxParagraphs = 35): string[] {
  const markerIdx = markdown.indexOf("Markdown Content:");
  const body = markerIdx >= 0 ? markdown.slice(markerIdx + "Markdown Content:".length) : markdown;
  const blocks = body.split(/\r?\n\s*\r?\n/);

  const paragraphs: string[] = [];
  const seen = new Set<string>();

  for (const rawBlock of blocks) {
    const line = rawBlock.trim();
    if (!line) continue;
    if (/^([*\-+]|\d+\.)\s+\[/.test(line)) continue;
    if (/^!\[/.test(line)) continue;
    if (/^#{1,6}\s+/.test(line)) continue;
    if (/^[-=*_]{3,}$/.test(line)) continue;
    if (/^(Title:|URL Source:|Published Time:|Warning:)/i.test(line)) continue;

    const clean = line
      .replace(/!\[[^\]]*\]\([^)]*\)/g, "")
      .replace(/\[([^\]]*)\]\([^)]+\)/g, "$1")
      .replace(/[*_`>#]/g, "")
      .replace(/\s+/g, " ")
      .trim();

    if (!isUsefulArticleParagraph(clean)) continue;
    const commaCount = (clean.match(/[.,!?]/g) ?? []).length;
    if (clean.length > 120 && commaCount === 0) continue;
    if (seen.has(clean)) continue;
    seen.add(clean);
    paragraphs.push(clean);
    if (paragraphs.length >= maxParagraphs) break;
  }

  return paragraphs;
}

export function normalizeCoverUrl(raw: string | null | undefined, baseUrl?: string): string | null {
  if (!raw) return null;
  let cleaned = decodeHtmlEntities(raw).trim();
  if (!cleaned || cleaned.startsWith("data:")) return null;

  if (cleaned.startsWith("//")) {
    cleaned = `https:${cleaned}`;
  } else if (!/^https?:\/\//i.test(cleaned) && baseUrl) {
    try {
      cleaned = new URL(cleaned, baseUrl).toString();
    } catch {
      return null;
    }
  }

  if (!/^https?:\/\//i.test(cleaned)) return null;
  // 屏蔽明显为追踪像素的小图标
  if (/1x1|spacer|pixel|favicon.*\.ico$/i.test(cleaned)) return null;

  // BBC RSS 缩略图默认仅 240px，升级到 800px 高清图
  if (/^https?:\/\/ichef\.bbci\.co\.uk\/ace\/ws\/\d+\//i.test(cleaned)) {
    cleaned = cleaned.replace(/\/ace\/ws\/\d+\//i, "/ace/ws/800/");
  }

  return cleaned.replace(/^http:\/\//i, "https://");
}

function readAttr(attrs: string, name: string): string | null {
  const m = attrs.match(new RegExp(`\\b${name}=["']([^"']+)["']`, "i"));
  return m?.[1] ?? null;
}

export function extractCoverUrlFromRssBlock(
  block: string,
  contentHtml = "",
  baseUrl?: string,
): string | null {
  const itunesMatch = block.match(/<itunes:image\b([^>]*)\/?>/i);
  if (itunesMatch) {
    const href = normalizeCoverUrl(readAttr(itunesMatch[1], "href") ?? extractXmlInner(itunesMatch[1]), baseUrl);
    if (href) return href;
  }

  const mediaMatches = block.matchAll(/<media:(?:content|thumbnail)\b([^>]*)\/?>/gi);
  for (const m of mediaMatches) {
    const attrs = m[1];
    const url = readAttr(attrs, "url");
    if (!url) continue;
    const medium = readAttr(attrs, "medium");
    const type = readAttr(attrs, "type");
    if (medium && medium.toLowerCase() !== "image" && (!type || !type.toLowerCase().startsWith("image/"))) {
      continue;
    }
    const normalized = normalizeCoverUrl(url, baseUrl);
    if (normalized) return normalized;
  }

  const enclosureMatches = block.matchAll(/<enclosure\b([^>]*)\/?>/gi);
  for (const m of enclosureMatches) {
    const attrs = m[1];
    const type = readAttr(attrs, "type") ?? "";
    const url = readAttr(attrs, "url");
    if (type.toLowerCase().startsWith("image/") && url) {
      const normalized = normalizeCoverUrl(url, baseUrl);
      if (normalized) return normalized;
    }
  }

  const imgMatch =
    contentHtml.match(/<img\b[^>]+src=["']([^"']+)["']/i) ??
    block.match(/<img\b[^>]+src=["']([^"']+)["']/i);
  if (imgMatch?.[1]) {
    const normalized = normalizeCoverUrl(imgMatch[1], baseUrl);
    if (normalized) return normalized;
  }

  const imageTag = block.match(/<image\b[^>]*>[\s\S]*?<url>([\s\S]*?)<\/url>[\s\S]*?<\/image>/i);
  if (imageTag?.[1]) {
    const normalized = normalizeCoverUrl(imageTag[1], baseUrl);
    if (normalized) return normalized;
  }

  return null;
}

function extractXmlInner(raw: string): string {
  return raw.trim();
}

export function extractOgImageFromHtml(html: string, baseUrl?: string): string | null {
  const patterns = [
    /<meta[^>]+property=["']og:image(?::secure_url)?["'][^>]+content=["']([^"']+)["']/i,
    /<meta[^>]+content=["']([^"']+)["'][^>]+property=["']og:image(?::secure_url)?["']/i,
    /<meta[^>]+name=["']twitter:image(?::src)?["'][^>]+content=["']([^"']+)["']/i,
    /<meta[^>]+content=["']([^"']+)["'][^>]+name=["']twitter:image(?::src)?["']/i,
    /<link[^>]+rel=["']image_src["'][^>]+href=["']([^"']+)["']/i,
  ];
  for (const re of patterns) {
    const m = html.match(re);
    if (m?.[1]) {
      const normalized = normalizeCoverUrl(m[1], baseUrl);
      if (normalized) return normalized;
    }
  }
  return null;
}
