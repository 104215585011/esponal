// Timestamp: 2026-06-10 09:35
import path from "node:path/posix";
import AdmZip from "adm-zip";

export type EpubReaderChapter = {
  index: number;
  title: string;
  href: string;
  text: string;
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
  for (const itemMatch of opf.matchAll(/<item\b[^>]*>/gi)) {
    const item = itemMatch[0];
    const id = getAttribute(item, "id");
    const href = getAttribute(item, "href");
    const mediaType = getAttribute(item, "media-type");
    if (id && href) {
      manifest.set(id, { href, mediaType });
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
        title: extractTitle(html, `第 ${index + 1} 章`),
        href,
        text,
      };
    })
    .filter((chapter): chapter is EpubReaderChapter => Boolean(chapter));

  if (chapters.length === 0) {
    throw new Error("epub_empty_spine");
  }

  return { chapters };
}
