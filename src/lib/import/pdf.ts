// Timestamp: 2026-11-15 14:10
import { join } from "node:path";

export type PdfReaderPage = {
  pageNumber: number;
  text: string;
};

export type PdfReaderData = {
  pages: PdfReaderPage[];
  unitCount: number;
};

const MAX_EXTRACTED_PAGES = 80;

function joinPdfTextItems(items: Array<{ str?: unknown; hasEOL?: unknown }>): string {
  const lines: string[] = [];
  let current = "";
  for (const item of items) {
    const str = typeof item?.str === "string" ? item.str : "";
    if (str) {
      current += current && !current.endsWith(" ") && !str.startsWith(" ") ? ` ${str}` : str;
    }
    if (item?.hasEOL) {
      if (current.trim()) lines.push(current.trim());
      current = "";
    }
  }
  if (current.trim()) lines.push(current.trim());
  return lines.join("\n").replace(/\n{3,}/g, "\n\n").trim();
}

export async function parsePdfForReader(input: Buffer | Uint8Array): Promise<PdfReaderData> {
  const pdfjs = await import("pdfjs-dist/legacy/build/pdf.mjs");
  const bytes = input instanceof Uint8Array ? input : new Uint8Array(input);
  const standardFontDataUrl = join(process.cwd(), "node_modules", "pdfjs-dist", "standard_fonts") + "/";

  const loadingTask = pdfjs.getDocument({
    data: bytes,
    useWorkerFetch: false,
    disableFontFace: true,
    standardFontDataUrl,
  });

  const doc = await loadingTask.promise;
  try {
    const totalPages = doc.numPages || 0;
    const limit = Math.min(totalPages, MAX_EXTRACTED_PAGES);
    const pages: PdfReaderPage[] = [];

    for (let i = 1; i <= limit; i += 1) {
      const page = await doc.getPage(i);
      const textContent = await page.getTextContent();
      const text = joinPdfTextItems(
        textContent.items as Array<{ str?: unknown; hasEOL?: unknown }>,
      );
      if (text) {
        pages.push({ pageNumber: i, text });
      }
    }

    return {
      pages,
      unitCount: totalPages,
    };
  } finally {
    const destroyable = doc as unknown as { destroy?: () => Promise<void> };
    await destroyable.destroy?.().catch(() => {});
  }
}
