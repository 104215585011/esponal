// Timestamp: 2026-06-01 17:18
export type DisplayMode = "bilingual" | "spanish" | "chinese";

export type PdfRow = {
  id: string;
  start: number;
  spanish: string;
  chinese: string;
  translationIndex: number;
};

export type PdfImagePage = {
  dataUrl: string;
  width: number;
  height: number;
};

const PDF_PAGE_WIDTH_PT = 595.28;
const PDF_PAGE_HEIGHT_PT = 841.89;
const PDF_CANVAS_WIDTH = 1240;
const PDF_CANVAS_HEIGHT = 1754;
const PDF_MARGIN_X = 106;
const PDF_TOP_MARGIN = 118;
const PDF_BOTTOM_MARGIN = 118;
const PDF_TIMESTAMP_WIDTH = 92;

export function formatTimestamp(seconds: number) {
  const wholeSeconds = Math.max(0, Math.floor(seconds));
  const minutes = Math.floor(wholeSeconds / 60);
  const remainder = wholeSeconds % 60;
  return `${minutes}:${String(remainder).padStart(2, "0")}`;
}

export function wrapCanvasText(
  context: CanvasRenderingContext2D,
  text: string,
  maxWidth: number
) {
  const words = text.split(" ");
  const lines: string[] = [];
  let line = "";

  for (const token of words) {
    const nextLine = line ? `${line} ${token}` : token;
    const metrics = context.measureText(nextLine);
    if (metrics.width > maxWidth && line) {
      lines.push(line.trimEnd());
      line = token.trimStart();
      continue;
    }
    line = nextLine;
  }

  if (line.trim()) {
    lines.push(line.trimEnd());
  }

  return lines.length > 0 ? lines : [""];
}

export function dataUrlToBytes(dataUrl: string) {
  const base64 = dataUrl.split(",")[1] ?? "";
  const binary = atob(base64);
  const bytes = new Uint8Array(binary.length);
  for (let index = 0; index < binary.length; index += 1) {
    bytes[index] = binary.charCodeAt(index);
  }
  return bytes;
}

export function concatBytes(parts: Uint8Array[]) {
  const totalLength = parts.reduce((length, part) => length + part.length, 0);
  const output = new Uint8Array(totalLength);
  let offset = 0;
  for (const part of parts) {
    output.set(part, offset);
    offset += part.length;
  }
  return output;
}

export function buildPdfBytes(pages: PdfImagePage[]) {
  const encoder = new TextEncoder();
  const chunks: Uint8Array[] = [];
  const offsets: number[] = [0];
  let byteLength = 0;
  const objectCount = 2 + pages.length * 3;
  const pageObjectIds = pages.map((_, index) => 3 + index * 3);

  const push = (part: string | Uint8Array) => {
    const bytes = typeof part === "string" ? encoder.encode(part) : part;
    chunks.push(bytes);
    byteLength += bytes.length;
  };

  const writeObject = (
    id: number,
    body: string | Uint8Array,
    prefix?: string,
    suffix?: string
  ) => {
    offsets[id] = byteLength;
    push(`${id} 0 obj\n`);
    if (prefix) push(prefix);
    push(body);
    if (suffix) push(suffix);
    push("\nendobj\n");
  };

  push("%PDF-1.4\n%\xE2\xE3\xCF\xD3\n");
  writeObject(1, "<< /Type /Catalog /Pages 2 0 R >>");
  writeObject(
    2,
    `<< /Type /Pages /Kids [${pageObjectIds.map((id) => `${id} 0 R`).join(" ")}] /Count ${pages.length} >>`
  );

  pages.forEach((page, index) => {
    const pageObjectId = 3 + index * 3;
    const contentObjectId = pageObjectId + 1;
    const imageObjectId = pageObjectId + 2;
    const imageName = `Im${index}`;
    const content = `q\n${PDF_PAGE_WIDTH_PT} 0 0 ${PDF_PAGE_HEIGHT_PT} 0 0 cm\n/${imageName} Do\nQ\n`;
    const imageBytes = dataUrlToBytes(page.dataUrl);

    writeObject(
      pageObjectId,
      `<< /Type /Page /Parent 2 0 R /MediaBox [0 0 ${PDF_PAGE_WIDTH_PT} ${PDF_PAGE_HEIGHT_PT}] /Resources << /XObject << /${imageName} ${imageObjectId} 0 R >> >> /Contents ${contentObjectId} 0 R >>`
    );
    writeObject(
      contentObjectId,
      content,
      `<< /Length ${encoder.encode(content).length} >>\nstream\n`,
      "endstream"
    );
    writeObject(
      imageObjectId,
      imageBytes,
      `<< /Type /XObject /Subtype /Image /Width ${page.width} /Height ${page.height} /ColorSpace /DeviceRGB /BitsPerComponent 8 /Filter /DCTDecode /Length ${imageBytes.length} >>\nstream\n`,
      "endstream"
    );
  });

  const xrefOffset = byteLength;
  push(`xref\n0 ${objectCount + 1}\n0000000000 65535 f \n`);
  for (let id = 1; id <= objectCount; id += 1) {
    push(`${String(offsets[id]).padStart(10, "0")} 00000 n \n`);
  }
  push(`trailer\n<< /Size ${objectCount + 1} /Root 1 0 R >>\nstartxref\n${xrefOffset}\n%%EOF`);

  return concatBytes(chunks);
}

export function renderTranscriptPdfPages(
  rows: PdfRow[],
  displayMode: DisplayMode,
  title: string
) {
  const pages: PdfImagePage[] = [];
  let canvas = document.createElement("canvas");
  let context = canvas.getContext("2d");
  if (!context) {
    throw new Error("Canvas is not available");
  }

  const setupPage = () => {
    canvas = document.createElement("canvas");
    canvas.width = PDF_CANVAS_WIDTH;
    canvas.height = PDF_CANVAS_HEIGHT;
    context = canvas.getContext("2d");
    if (!context) {
      throw new Error("Canvas is not available");
    }
    context.fillStyle = "#ffffff";
    context.fillRect(0, 0, PDF_CANVAS_WIDTH, PDF_CANVAS_HEIGHT);
    context.fillStyle = "#18181b";
    context.font = '700 38px "Noto Sans SC", "Microsoft YaHei", Arial, sans-serif';
    context.fillText("Esponal 字幕讲义", PDF_MARGIN_X, 76);
    context.fillStyle = "#71717a";
    context.font = '500 18px "Noto Sans SC", "Microsoft YaHei", Arial, sans-serif';
    context.fillText(title, PDF_MARGIN_X, 108);
    context.fillStyle = "#10b981";
    context.fillRect(PDF_MARGIN_X, 128, PDF_CANVAS_WIDTH - PDF_MARGIN_X * 2, 4);
    return PDF_TOP_MARGIN + 44;
  };

  const finishPage = () => {
    if (!context) return;
    const pageNumber = pages.length + 1;
    context.fillStyle = "#71717a";
    context.font = '500 16px "Noto Sans SC", "Microsoft YaHei", Arial, sans-serif';
    context.textAlign = "center";
    context.fillText(`第 ${pageNumber} 页`, PDF_CANVAS_WIDTH / 2, PDF_CANVAS_HEIGHT - 48);
    context.textAlign = "right";
    context.fillText(
      "Esponal — 西班牙语学习平台",
      PDF_CANVAS_WIDTH - PDF_MARGIN_X,
      PDF_CANVAS_HEIGHT - 48
    );
    context.textAlign = "left";
    pages.push({
      dataUrl: canvas.toDataURL("image/jpeg", 0.92),
      width: canvas.width,
      height: canvas.height
    });
  };

  let y = setupPage();
  const textX = PDF_MARGIN_X + PDF_TIMESTAMP_WIDTH;
  const textWidth = PDF_CANVAS_WIDTH - textX - PDF_MARGIN_X;

  for (const row of rows) {
    if (!context) continue;
    context.font =
      displayMode === "spanish"
        ? "600 25px Arial, sans-serif"
        : "600 23px Arial, sans-serif";
    const spanishLines =
      displayMode !== "chinese"
        ? wrapCanvasText(context, row.spanish, textWidth)
        : [];
    context.font =
      displayMode === "chinese"
        ? '500 25px "Noto Sans SC", "Microsoft YaHei", Arial, sans-serif'
        : '500 21px "Noto Sans SC", "Microsoft YaHei", Arial, sans-serif';
    const chineseLines =
      displayMode !== "spanish"
        ? wrapCanvasText(context, row.chinese, textWidth)
        : [];
    const blockHeight =
      18 +
      spanishLines.length * (displayMode === "spanish" ? 32 : 29) +
      chineseLines.length * (displayMode === "chinese" ? 32 : 27) +
      (spanishLines.length && chineseLines.length ? 8 : 0);

    if (y + blockHeight > PDF_CANVAS_HEIGHT - PDF_BOTTOM_MARGIN) {
      finishPage();
      y = setupPage();
    }

    context.fillStyle = "#71717a";
    context.font = '700 16px "Noto Sans SC", "Microsoft YaHei", Arial, sans-serif';
    context.fillText(`[${formatTimestamp(row.start)}]`, PDF_MARGIN_X, y + 20);

    let textY = y + 20;
    if (spanishLines.length) {
      context.fillStyle = "#18181b";
      context.font =
        displayMode === "spanish"
          ? "600 25px Arial, sans-serif"
          : "600 23px Arial, sans-serif";
      for (const line of spanishLines) {
        context.fillText(line, textX, textY);
        textY += displayMode === "spanish" ? 32 : 29;
      }
    }

    if (chineseLines.length) {
      if (spanishLines.length) textY += 8;
      context.fillStyle = displayMode === "chinese" ? "#18181b" : "#71717a";
      context.font =
        displayMode === "chinese"
          ? '500 25px "Noto Sans SC", "Microsoft YaHei", Arial, sans-serif'
          : '500 21px "Noto Sans SC", "Microsoft YaHei", Arial, sans-serif';
      for (const line of chineseLines) {
        context.fillText(line, textX, textY);
        textY += displayMode === "chinese" ? 32 : 27;
      }
    }

    context.strokeStyle = "#f4f4f5";
    context.beginPath();
    context.moveTo(textX, y + blockHeight - 4);
    context.lineTo(PDF_CANVAS_WIDTH - PDF_MARGIN_X, y + blockHeight - 4);
    context.stroke();
    y += blockHeight + 14;
  }

  finishPage();
  return pages;
}
