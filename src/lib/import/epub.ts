// Timestamp: 2026-06-11 09:30
import path from "node:path/posix";
import AdmZip from "adm-zip";

export type EpubReaderChapter = {
  index: number;
  title: string;
  href: string;
  text: string;
  html: string;
};

type ManifestItem = {
  href: string;
  mediaType: string;
};

function getEntryText(zip: AdmZip, entryName: string) {
  const entry = zip.getEntry(entryName);
  return entry ? entry.getData().toString("utf8") : "";
}

function getAttribute(source: string, name: string) {
  const pattern = new RegExp(`${name}=["']([^"']+)["']`, "i");
  return pattern.exec(source)?.[1] ?? "";
}

function decodeXmlEntities(value: string) {
  return value
    .replace(/&nbsp;/gi, " ")
    .replace(/&amp;/gi, "&")
    .replace(/&lt;/gi, "<")
    .replace(/&gt;/gi, ">")
    .replace(/&quot;/gi, "\"")
    .replace(/&#39;/gi, "'")
    .replace(/&#x([0-9a-f]+);/gi, (_match, hex: string) => String.fromCodePoint(Number.parseInt(hex, 16)))
    .replace(/&#(\d+);/g, (_match, code: string) => String.fromCodePoint(Number.parseInt(code, 10)));
}

function safeDecodeUriComponent(value: string) {
  try {
    return decodeURIComponent(value);
  } catch {
    return value;
  }
}

function normalizeManifestHref(href: string) {
  const withoutFragment = href.split("#")[0]?.split("?")[0] ?? href;
  return safeDecodeUriComponent(decodeXmlEntities(withoutFragment));
}

function escapeHtml(value: string) {
  return value.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
}

function escapeAttribute(value: string) {
  return escapeHtml(value).replace(/"/g, "&quot;");
}

function resolveEntryPath(baseDir: string, href: string) {
  return path.normalize(path.join(baseDir, normalizeManifestHref(href))).replace(/^(\.\.\/)+/, "");
}

function mediaTypeForPath(entryPath: string, resourceMediaTypes: Map<string, string>) {
  const fromManifest = resourceMediaTypes.get(entryPath);
  if (fromManifest) return fromManifest;
  if (/\.jpe?g$/i.test(entryPath)) return "image/jpeg";
  if (/\.gif$/i.test(entryPath)) return "image/gif";
  if (/\.webp$/i.test(entryPath)) return "image/webp";
  if (/\.svg$/i.test(entryPath)) return "image/svg+xml";
  return "image/png";
}

function wrapEpubWords(text: string) {
  return escapeHtml(decodeXmlEntities(text)).replace(
    /[\p{L}ÁÉÍÓÚÜÑáéíóúüñ]+/gu,
    (word) => `<span data-epub-word="${escapeAttribute(word)}">${escapeHtml(word)}</span>`,
  );
}

export function stripEpubHtmlToText(html: string) {
  const body = /<body[\s\S]*?>([\s\S]*?)<\/body>/i.exec(html)?.[1] ?? html;
  return decodeXmlEntities(
    body
      .replace(/<script[\s\S]*?<\/script>/gi, " ")
      .replace(/<style[\s\S]*?<\/style>/gi, " ")
      .replace(/<svg[\s\S]*?<\/svg>/gi, " ")
      .replace(/<(h[1-6]|p|div|section|article|li|br)\b[^>]*>/gi, "\n")
      .replace(/<[^>]+>/g, " ")
      .replace(/[ \t\f\v]+/g, " ")
      .replace(/\n\s+/g, "\n")
      .replace(/\n{3,}/g, "\n\n")
      .trim(),
  );
}

function sanitizeEpubHtmlChapter(
  html: string,
  zip: AdmZip,
  chapterHref: string,
  resourceMediaTypes: Map<string, string>,
) {
  const body = /<body[\s\S]*?>([\s\S]*?)<\/body>/i.exec(html)?.[1] ?? html;
  const chapterDir = path.dirname(chapterHref) === "." ? "" : path.dirname(chapterHref);
  const withoutUnsafeBlocks = body
    .replace(/<!--[\s\S]*?-->/g, " ")
    .replace(/<script[\s\S]*?<\/script>/gi, " ")
    .replace(/<style[\s\S]*?<\/style>/gi, " ")
    .replace(/<svg[\s\S]*?<\/svg>/gi, " ");
  const allowedTags = new Set([
    "article",
    "blockquote",
    "br",
    "div",
    "em",
    "figcaption",
    "figure",
    "h1",
    "h2",
    "h3",
    "h4",
    "h5",
    "h6",
    "i",
    "li",
    "ol",
    "p",
    "section",
    "span",
    "strong",
    "ul",
  ]);

  const sanitized = withoutUnsafeBlocks.replace(/<\/?([a-z0-9:-]+)\b[^>]*>/gi, (tag, rawName: string) => {
    const name = rawName.toLowerCase();
    const isClosing = /^<\//.test(tag);
    if (name === "img") {
      if (isClosing) return "";
      const src = getAttribute(tag, "src");
      if (!src) return "";
      const entryPath = resolveEntryPath(chapterDir, src);
      const entry = zip.getEntry(entryPath);
      if (!entry) return "";
      const alt = decodeXmlEntities(getAttribute(tag, "alt"));
      const mediaType = mediaTypeForPath(entryPath, resourceMediaTypes);
      const dataUrl = `data:${mediaType};base64,${entry.getData().toString("base64")}`;
      return `<img src="${dataUrl}" alt="${escapeAttribute(alt)}" />`;
    }
    if (!allowedTags.has(name)) return "";
    return isClosing ? `</${name}>` : name === "br" ? "<br />" : `<${name}>`;
  });

  return sanitized
    .split(/(<[^>]+>)/g)
    .map((part) => (part.startsWith("<") ? part : wrapEpubWords(part)))
    .join("")
    .replace(/\s{3,}/g, " ")
    .trim();
}

function extractTitle(html: string, fallback: string) {
  const title =
    /<title[^>]*>([\s\S]*?)<\/title>/i.exec(html)?.[1] ??
    /<h1[^>]*>([\s\S]*?)<\/h1>/i.exec(html)?.[1] ??
    /<h2[^>]*>([\s\S]*?)<\/h2>/i.exec(html)?.[1] ??
    fallback;
  return stripEpubHtmlToText(title).split("\n")[0]?.trim() || fallback;
}

export function parseEpubForReader(bytes: Uint8Array) {
  const zip = new AdmZip(Buffer.from(bytes));
  const containerXml = getEntryText(zip, "META-INF/container.xml");
  const rootfile = /<rootfile\b[^>]*full-path=["']([^"']+)["'][^>]*>/i.exec(containerXml)?.[1];
  if (!rootfile) {
    throw new Error("epub_missing_rootfile");
  }

  const opf = getEntryText(zip, rootfile);
  if (!opf) {
    throw new Error("epub_missing_package");
  }

  const opfDir = path.dirname(rootfile) === "." ? "" : path.dirname(rootfile);
  const manifest = new Map<string, ManifestItem>();
  const resourceMediaTypes = new Map<string, string>();
  for (const itemMatch of opf.matchAll(/<item\b[^>]*>/gi)) {
    const item = itemMatch[0];
    const id = getAttribute(item, "id");
    const href = getAttribute(item, "href");
    const mediaType = getAttribute(item, "media-type");
    if (id && href) {
      const normalizedHref = path.normalize(path.join(opfDir, normalizeManifestHref(href)));
      manifest.set(id, { href, mediaType });
      resourceMediaTypes.set(normalizedHref, mediaType);
    }
  }

  const spine: string[] = [];
  for (const itemRefMatch of opf.matchAll(/<itemref\b[^>]*>/gi)) {
    const idref = getAttribute(itemRefMatch[0], "idref");
    if (idref) spine.push(idref);
  }

  const htmlLike = new Set(["application/xhtml+xml", "text/html"]);
  const chapters = spine
    .map((idref, index) => {
      const manifestItem = manifest.get(idref);
      if (!manifestItem || (manifestItem.mediaType && !htmlLike.has(manifestItem.mediaType))) return null;

      const href = path.normalize(path.join(opfDir, normalizeManifestHref(manifestItem.href)));
      const html = getEntryText(zip, href);
      const text = stripEpubHtmlToText(html);
      if (!text) return null;

      return {
        index,
        title: extractTitle(html, `Chapter ${index + 1}`),
        href,
        text,
        html: sanitizeEpubHtmlChapter(html, zip, href, resourceMediaTypes),
      };
    })
    .filter((chapter): chapter is EpubReaderChapter => Boolean(chapter));

  if (chapters.length === 0) {
    throw new Error("epub_empty_spine");
  }

  return { chapters };
}
