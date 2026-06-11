import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

async function read(path) {
  return readFile(path, "utf8");
}

test("IMPORT-6 reader settings and sentence helpers expose the approved contracts", async () => {
  const {
    DEFAULT_IMPORT_READER_SETTINGS,
    IMPORT_READER_SETTINGS_STORAGE_KEY,
    clampImportReaderSettings,
    splitSpanishSentences,
    wrapSentencesInEpubHtml,
  } = await import("../src/lib/import/reader-settings.ts");

  assert.equal(IMPORT_READER_SETTINGS_STORAGE_KEY, "esponal.import.reader.settings.v1");
  assert.deepEqual(DEFAULT_IMPORT_READER_SETTINGS, {
    fontSize: 17,
    lineHeight: "normal",
    fontFamily: "sans",
    paper: "white",
    pageTurn: "slide",
  });
  assert.deepEqual(clampImportReaderSettings({ fontSize: 99, lineHeight: "loose", fontFamily: "serif", paper: "sepia", pageTurn: "none" }), {
    fontSize: 23,
    lineHeight: "loose",
    fontFamily: "serif",
    paper: "sepia",
    pageTurn: "none",
  });

  const sentences = splitSpanishSentences("La Sra. López vive en Madrid. ¿Cómo está? ¡Muy bien! Habla con el Dr. Pérez.");
  assert.deepEqual(sentences, [
    "La Sra. López vive en Madrid.",
    "¿Cómo está?",
    "¡Muy bien!",
    "Habla con el Dr. Pérez.",
  ]);

  const wrapped = wrapSentencesInEpubHtml("<p>La Sra. López vive en Madrid. ¿Cómo está?</p>");
  assert.match(wrapped, /data-sent="0"[^>]*>La Sra\. López vive en Madrid\./);
  assert.match(wrapped, /data-sent="1"[^>]*>¿Cómo está\?/);
});

test("IMPORT-6 reader shell exposes immersive sheets, upgraded EPUB progress, and setting persistence", async () => {
  const shell = await read("src/app/import/[id]/ImportReaderClient.tsx");

  assert.match(shell, /IMPORT_READER_SETTINGS_STORAGE_KEY/);
  assert.match(shell, /DEFAULT_IMPORT_READER_SETTINGS/);
  assert.match(shell, /localStorage\.getItem\(IMPORT_READER_SETTINGS_STORAGE_KEY\)/);
  assert.match(shell, /localStorage\.setItem\(IMPORT_READER_SETTINGS_STORAGE_KEY/);
  assert.match(shell, /epub:\$\{epubChapterIndex\}:\$\{epubPageInChapter\}/);
  assert.match(shell, /epub:\\d\+:\(\\d\+\)/);
  assert.match(shell, /data-testid="import-reader-settings-sheet"/);
  assert.match(shell, /data-testid="import-reader-toc-sheet"/);
  assert.match(shell, /aria-label="阅读设置"/);
  assert.match(shell, /aria-label="目录"/);
  assert.match(shell, /纸张/);
  assert.match(shell, /米黄/);
  assert.match(shell, /夜间/);
  assert.match(shell, /data-testid="import-reader-progress-slider"/);
});

test("IMPORT-7 M1 EPUB uses epub.js paginated rendering while PDF keeps continuous lookup", async () => {
  const epub = await read("src/app/import/[id]/EpubReader.tsx");
  const pdf = await read("src/app/import/[id]/PdfReader.tsx");
  const lookup = await read("src/app/watch/LookupCard.tsx");

  assert.match(epub, /import\("epubjs"\)/);
  assert.match(epub, /data-testid="import-epubjs-stage"/);
  assert.match(epub, /flow:\s*"paginated"/);
  assert.match(epub, /spread:\s*"none"/);
  assert.match(epub, /renditionRef\.current\?\.next\(\)/);
  assert.match(epub, /renditionRef\.current\?\.prev\(\)/);
  assert.doesNotMatch(epub, /wrapSentencesInEpubHtml/);
  assert.doesNotMatch(epub, /dangerouslySetInnerHTML/);

  assert.match(pdf, /data-testid="import-pdf-continuous-scroll"/);
  assert.match(pdf, /data-testid="import-pdf-page-canvas"/);
  assert.match(pdf, /IntersectionObserver/);
  assert.match(pdf, /window\.devicePixelRatio/);
  assert.match(pdf, /closestSentenceForPdfItem/);
  assert.match(pdf, /sentenceText/);

  assert.match(lookup, /朗读整句/);
  assert.match(lookup, /0\.1/);
  assert.match(lookup, /handleSpeakOriginalSentence/);
  assert.match(lookup, /fetch\("\/api\/tts\?text="/);
  assert.match(lookup, /source\?\.type === "import"/);
});
