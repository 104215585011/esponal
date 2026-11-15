// Timestamp: 2026-11-15 15:16
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
