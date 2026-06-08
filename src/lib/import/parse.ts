// Timestamp: 2026-06-08 18:36
import AdmZip from "adm-zip";
import { createRequire } from "node:module";
import { dirname, join } from "node:path";
import { paginateImportedText } from "./paginate.ts";
import { runOcr } from "./ocr.ts";

const require = createRequire(import.meta.url);

export class NeedsOcrError extends Error {
  readonly pageCount: number;

  constructor(pageCount: number, message = "needs_ocr") {
    super(message);
    this.name = "NeedsOcrError";
    this.pageCount = pageCount;
  }
}

export type ParsedImportedDocument = {
  title: string;
  kind: "epub" | "pdf_text" | "pdf_ocr";
  pages: string[];
};

function deriveTitle(file: File) {
  return file.name.replace(/\.[^.]+$/, "").trim() || "Imported document";
}

function decodeHtmlEntities(text: string) {
  return text
    .replace(/&nbsp;/g, " ")
    .replace(/&amp;/g, "&")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'");
}

function stripHtmlToText(html: string) {
  const withBreaks = html
    .replace(/<\s*br\s*\/?>/gi, "\n")
    .replace(/<\s*\/p\s*>/gi, "\n\n")
    .replace(/<\s*\/h[1-6]\s*>/gi, "\n\n")
    .replace(/<\s*li\s*>/gi, "- ")
    .replace(/<\s*\/li\s*>/gi, "\n");

  return decodeHtmlEntities(withBreaks.replace(/<[^>]+>/g, " "))
    .replace(/\r/g, "")
    .replace(/[ \t]+\n/g, "\n")
    .replace(/\n{3,}/g, "\n\n")
    .replace(/[ \t]{2,}/g, " ")
    .trim();
}

function normalizeZipPath(basePath: string, href: string) {
  const segments = `${basePath}/${href}`.split("/").filter(Boolean);
  const normalized: string[] = [];

  for (const segment of segments) {
    if (segment === ".") continue;
    if (segment === "..") {
      normalized.pop();
      continue;
    }
    normalized.push(segment);
  }

  return normalized.join("/");
}

function getZipText(zip: AdmZip, path: string) {
  const entry = zip.getEntry(path);
  return entry ? entry.getData().toString("utf8") : null;
}

function extractRootfilePath(containerXml: string) {
  const match = containerXml.match(/full-path="([^"]+)"/i);
  return match?.[1] ?? null;
}

function extractEpubTitle(opfXml: string) {
  const match = opfXml.match(/<dc:title[^>]*>([\s\S]*?)<\/dc:title>/i);
  return match ? stripHtmlToText(match[1]) : null;
}

function extractManifestMap(opfXml: string) {
  const manifest = new Map<string, string>();
  const itemMatches = opfXml.matchAll(/<item\b[^>]*id="([^"]+)"[^>]*href="([^"]+)"[^>]*>/gi);

  for (const match of itemMatches) {
    manifest.set(match[1], match[2]);
  }

  return manifest;
}

function extractSpineIds(opfXml: string) {
  return [...opfXml.matchAll(/<itemref\b[^>]*idref="([^"]+)"[^>]*>/gi)].map((match) => match[1]);
}

function parseEpub(buffer: Buffer, fallbackTitle: string): ParsedImportedDocument {
  const zip = new AdmZip(buffer);
  const containerXml = getZipText(zip, "META-INF/container.xml");

  if (!containerXml) {
    throw new Error("invalid_epub_container");
  }

  const rootfilePath = extractRootfilePath(containerXml);
  if (!rootfilePath) {
    throw new Error("invalid_epub_rootfile");
  }

  const opfXml = getZipText(zip, rootfilePath);
  if (!opfXml) {
    throw new Error("invalid_epub_package");
  }

  const title = extractEpubTitle(opfXml) || fallbackTitle;
  const manifest = extractManifestMap(opfXml);
  const spineIds = extractSpineIds(opfXml);
  const basePath = rootfilePath.split("/").slice(0, -1).join("/");
  const pageTexts: string[] = [];

  for (const spineId of spineIds) {
    const href = manifest.get(spineId);
    if (!href) continue;
    const chapterPath = normalizeZipPath(basePath, href);
    const chapterXml = getZipText(zip, chapterPath);
    if (!chapterXml) continue;

    const text = stripHtmlToText(chapterXml);
    if (text) {
      pageTexts.push(text);
    }
  }

  return {
    title,
    kind: "epub",
    pages: pageTexts.length > 0 ? pageTexts : [],
  };
}

async function loadPdfDocument(buffer: Buffer) {
  const pdfjs = await import("pdfjs-dist/legacy/build/pdf.mjs");
  const pdfjsPackagePath = require.resolve("pdfjs-dist/package.json");
  const standardFontDataUrl = `${join(dirname(pdfjsPackagePath), "standard_fonts").replace(/\\/g, "/")}/`;
  return pdfjs.getDocument({
    data: new Uint8Array(buffer),
    useWorkerFetch: false,
    disableFontFace: true,
    standardFontDataUrl,
  });
}

async function parsePdfPages(buffer: Buffer) {
  const loadingTask = await loadPdfDocument(buffer);
  const document = await loadingTask.promise;
  const pages: string[] = [];

  for (let pageNumber = 1; pageNumber <= document.numPages; pageNumber += 1) {
    const page = await document.getPage(pageNumber);
    const textContent = await page.getTextContent();
    const items = textContent.items as Array<{ str?: string; hasEOL?: boolean }>;
    let pageText = "";

    for (const item of items) {
      const fragment = typeof item.str === "string" ? item.str : "";
      if (!fragment) continue;
      pageText += fragment;
      pageText += item.hasEOL ? "\n" : " ";
    }

    pageText = pageText.replace(/[ \t]+\n/g, "\n").replace(/[ \t]{2,}/g, " ").trim();
    pages.push(pageText);
  }

  return pages.filter((page) => page.trim().length > 0);
}

async function countPdfPages(buffer: Buffer) {
  const loadingTask = await loadPdfDocument(buffer);
  const document = await loadingTask.promise;
  return document.numPages;
}

export async function parseImportedDocumentWithOcr(
  file: File,
): Promise<ParsedImportedDocument> {
  const fallbackTitle = deriveTitle(file);
  const buffer = Buffer.from(await file.arrayBuffer());
  const pageCount = await countPdfPages(buffer);
  const pages = await runOcr({
    fileName: file.name,
    pdfBase64: buffer.toString("base64"),
    pageCount,
  });

  return {
    title: fallbackTitle,
    kind: "pdf_ocr",
    pages,
  };
}

export async function parseImportedDocument(file: File): Promise<ParsedImportedDocument> {
  const fallbackTitle = deriveTitle(file);
  const lowerName = file.name.toLowerCase();

  if (lowerName.endsWith(".epub")) {
    const buffer = Buffer.from(await file.arrayBuffer());
    return parseEpub(buffer, fallbackTitle);
  }

  if (lowerName.endsWith(".pdf")) {
    const buffer = Buffer.from(await file.arrayBuffer());
    const pages = await parsePdfPages(buffer);
    const loadingTask = await loadPdfDocument(buffer);
    const document = await loadingTask.promise;

    if (pages.length === 0) {
      throw new NeedsOcrError(document.numPages);
    }

    return {
      title: fallbackTitle,
      kind: "pdf_text",
      pages,
    };
  }

  throw new Error("unsupported_import_file");
}
