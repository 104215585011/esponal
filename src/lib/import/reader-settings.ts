// Timestamp: 2026-06-11 10:15
export const IMPORT_READER_SETTINGS_STORAGE_KEY = "esponal.import.reader.settings.v1";

export type ImportReaderFontSize = 15 | 16 | 17 | 19 | 21 | 23;
export type ImportReaderLineHeight = "compact" | "normal" | "loose";
export type ImportReaderFontFamily = "sans" | "serif";
export type ImportReaderPaper = "white" | "sepia" | "night";
export type ImportReaderPageTurn = "slide" | "none";

export type ImportReaderSettings = {
  fontSize: ImportReaderFontSize;
  lineHeight: ImportReaderLineHeight;
  fontFamily: ImportReaderFontFamily;
  paper: ImportReaderPaper;
  pageTurn: ImportReaderPageTurn;
};

export const IMPORT_READER_FONT_SIZES: ImportReaderFontSize[] = [15, 16, 17, 19, 21, 23];

export const DEFAULT_IMPORT_READER_SETTINGS: ImportReaderSettings = {
  fontSize: 17,
  lineHeight: "normal",
  fontFamily: "sans",
  paper: "white",
  pageTurn: "slide",
};

const SPANISH_ABBREVIATIONS = new Set(["sr.", "sra.", "srta.", "dr.", "dra.", "ud.", "uds.", "etc.", "pág.", "núm."]);

function isReaderLineHeight(value: unknown): value is ImportReaderLineHeight {
  return value === "compact" || value === "normal" || value === "loose";
}

function isReaderFontFamily(value: unknown): value is ImportReaderFontFamily {
  return value === "sans" || value === "serif";
}

function isReaderPaper(value: unknown): value is ImportReaderPaper {
  return value === "white" || value === "sepia" || value === "night";
}

function isReaderPageTurn(value: unknown): value is ImportReaderPageTurn {
  return value === "slide" || value === "none";
}

export function clampImportReaderSettings(input: Partial<ImportReaderSettings> | null | undefined): ImportReaderSettings {
  const rawFontSize = Number(input?.fontSize ?? DEFAULT_IMPORT_READER_SETTINGS.fontSize);
  const nearestFontSize = IMPORT_READER_FONT_SIZES.reduce((nearest, value) => (
    Math.abs(value - rawFontSize) < Math.abs(nearest - rawFontSize) ? value : nearest
  ), DEFAULT_IMPORT_READER_SETTINGS.fontSize);

  return {
    fontSize: nearestFontSize,
    lineHeight: isReaderLineHeight(input?.lineHeight) ? input.lineHeight : DEFAULT_IMPORT_READER_SETTINGS.lineHeight,
    fontFamily: isReaderFontFamily(input?.fontFamily) ? input.fontFamily : DEFAULT_IMPORT_READER_SETTINGS.fontFamily,
    paper: isReaderPaper(input?.paper) ? input.paper : DEFAULT_IMPORT_READER_SETTINGS.paper,
    pageTurn: isReaderPageTurn(input?.pageTurn) ? input.pageTurn : DEFAULT_IMPORT_READER_SETTINGS.pageTurn,
  };
}

export function splitSpanishSentences(text: string) {
  const source = text.replace(/\s+/g, " ").trim();
  if (!source) return [];
  const sentences: string[] = [];
  let start = 0;

  for (let index = 0; index < source.length; index += 1) {
    const char = source[index];
    if (char !== "." && char !== "!" && char !== "?") continue;

    const before = source.slice(Math.max(0, index - 12), index + 1).toLowerCase().match(/[\p{L}.]+$/u)?.[0] ?? "";
    if (SPANISH_ABBREVIATIONS.has(before)) continue;

    const next = source[index + 1] ?? "";
    const after = source.slice(index + 1).trimStart()[0] ?? "";
    if (next && !/\s|["'”’)]/.test(next)) continue;
    if (after && !/[A-ZÁÉÍÓÚÜÑ¿¡0-9]/.test(after)) continue;

    const sentence = source.slice(start, index + 1).trim();
    if (sentence) sentences.push(sentence);
    start = index + 1;
  }

  const tail = source.slice(start).trim();
  if (tail) sentences.push(tail);
  return sentences;
}

export function wrapSentencesInEpubHtml(html: string) {
  let sentenceIndex = 0;
  return html
    .split(/(<[^>]+>)/g)
    .map((part) => {
      if (part.startsWith("<")) return part;
      return splitSpanishSentences(part)
        .map((sentence) => `<span data-sent="${sentenceIndex++}">${sentence}</span>`)
        .join(" ");
    })
    .join("");
}
