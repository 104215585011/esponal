// Timestamp: 2026-11-15 15:08
import { join } from "node:path";

export type PdfReaderPage = {
  pageNumber: number;
  text: string;
};

export type PdfReaderData = {
  pages: PdfReaderPage[];
  unitCount: number;
};

const MAX_EXTRACTED_PAGES = 100;

type RawPdfTextItem = {
  str?: unknown;
  hasEOL?: unknown;
  transform?: unknown;
};

/**
 * 将 PDF 碎片化的视觉换行合并为自然的阅读段落，
 * 仅在较大的垂直行距（新段落/小标题）或句末换行时分段，避免一句话被拆成十几行影响点击与翻译。
 */
export function joinPdfTextItems(items: RawPdfTextItem[]): string {
  const visualLines: Array<{ text: string; y: number | null }> = [];
  let current = "";
  let currentY: number | null = null;

  for (const item of items) {
    const str = typeof item?.str === "string" ? item.str : "";
    const y =
      Array.isArray(item?.transform) && typeof item.transform[5] === "number"
        ? item.transform[5]
        : null;

    if (currentY === null && y !== null && str.trim()) {
      currentY = y;
    }

    if (str) {
      if (current && !current.endsWith(" ") && !str.startsWith(" ")) {
        current += ` ${str}`;
      } else {
        current += str;
      }
    }

    if (item?.hasEOL) {
      const cleaned = current.replace(/\s+/g, " ").trim();
      if (cleaned) {
        visualLines.push({ text: cleaned, y: currentY });
      }
      current = "";
      currentY = null;
    }
  }

  const tail = current.replace(/\s+/g, " ").trim();
  if (tail) {
    visualLines.push({ text: tail, y: currentY });
  }

  if (visualLines.length === 0) return "";

  const paragraphs: string[] = [];
  let para = visualLines[0].text;
  let prevY = visualLines[0].y;

  for (let i = 1; i < visualLines.length; i += 1) {
    const line = visualLines[i];
    const yGap = prevY !== null && line.y !== null ? Math.abs(prevY - line.y) : 0;
    const endsSentence = /[.!?。！？»"”]$/.test(para);
    const largeVerticalGap = yGap > 18;
    const isShortHeading = para.length < 48 && !/[,;、]$/.test(para);

    if (largeVerticalGap || (endsSentence && isShortHeading) || (endsSentence && para.length > 260)) {
      paragraphs.push(para);
      para = line.text;
    } else if (para.endsWith("-") && /^[a-zA-Záéíóúüñ]/.test(line.text)) {
      // 连字符跨行断词还原
      para = para.slice(0, -1) + line.text;
    } else {
      para += ` ${line.text}`;
    }
    prevY = line.y ?? prevY;
  }

  if (para.trim()) {
    paragraphs.push(para.trim());
  }

  return paragraphs.join("\n\n").trim();
}

export async function parsePdfForReader(input: Buffer | Uint8Array): Promise<PdfReaderData> {
  const pdfjs = await import("pdfjs-dist/legacy/build/pdf.mjs");
  const bytes = input instanceof Uint8Array ? input : new Uint8Array(input);
  const standardFontDataUrl =
    join(process.cwd(), "node_modules", "pdfjs-dist", "standard_fonts") + "/";

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
      const text = joinPdfTextItems(textContent.items as RawPdfTextItem[]);
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
