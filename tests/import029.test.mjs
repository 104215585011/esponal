import assert from "node:assert/strict";
import { existsSync } from "node:fs";
import { readFile } from "node:fs/promises";
import test from "node:test";
import AdmZip from "adm-zip";

async function read(path) {
  return readFile(path, "utf8");
}

test("IMPORT-5 EPUB parser preserves sanitized image HTML and clickable word hooks", async () => {
  const { parseEpubForReader } = await import("../src/lib/import/epub.ts");
  const zip = new AdmZip();
  zip.addFile(
    "META-INF/container.xml",
    Buffer.from(`<?xml version="1.0"?><container><rootfiles><rootfile full-path="OPS/package.opf"/></rootfiles></container>`),
  );
  zip.addFile(
    "OPS/package.opf",
    Buffer.from(`
      <package>
        <manifest>
          <item id="chap1" href="chapters/one.xhtml" media-type="application/xhtml+xml"/>
          <item id="cover" href="images/cover.png" media-type="image/png"/>
        </manifest>
        <spine><itemref idref="chap1"/></spine>
      </package>
    `),
  );
  zip.addFile(
    "OPS/chapters/one.xhtml",
    Buffer.from(`
      <html><head><title>Uno</title></head>
        <body>
          <h1 onclick="bad()">Hola mundo</h1>
          <p>Me llamo Ana.</p>
          <img src="../images/cover.png" onerror="alert(1)" alt="Portada"/>
          <script>alert("xss")</script>
        </body>
      </html>
    `),
  );
  zip.addFile("OPS/images/cover.png", Buffer.from([0x89, 0x50, 0x4e, 0x47]));

  const parsed = parseEpubForReader(new Uint8Array(zip.toBuffer()));
  const chapter = parsed.chapters[0];

  assert.match(chapter.html, /<img[^>]+src="data:image\/png;base64,/);
  assert.match(chapter.html, /data-epub-word="Hola"/);
  assert.match(chapter.html, /data-epub-word="llamo"/);
  assert.doesNotMatch(chapter.html, /<script/i);
  assert.doesNotMatch(chapter.html, /onerror|onclick/i);
  assert.match(chapter.text, /Me llamo Ana/);
});

test("IMPORT-5 reader is split into PDF and EPUB components with a thin dispatcher", async () => {
  const clientPath = "src/app/import/[id]/ImportReaderClient.tsx";
  const pdfPath = "src/app/import/[id]/PdfReader.tsx";
  const epubPath = "src/app/import/[id]/EpubReader.tsx";

  assert.equal(existsSync(pdfPath), true, `${pdfPath} missing`);
  assert.equal(existsSync(epubPath), true, `${epubPath} missing`);

  const client = await read(clientPath);
  const pdf = await read(pdfPath);
  const epub = await read(epubPath);

  assert.match(client, /import \{ PdfReader \} from "\.\/PdfReader"/);
  assert.match(client, /import \{ EpubReader,\s*type EpubChapter \} from "\.\/EpubReader"/);
  assert.match(client, /kind === "pdf" \? \(/);
  assert.doesNotMatch(client, /pdfjs-dist\/build\/pdf\.mjs/);
  assert.doesNotMatch(client, /parseEpubForReader/);
  assert.ok(client.split(/\r?\n/).length < 320, "ImportReaderClient should stay a reader shell, not absorb PDF/EPUB internals");

  assert.match(pdf, /pdfjs-dist\/build\/pdf\.mjs/);
  assert.match(pdf, /LookupCardStack/);
  assert.match(pdf, /data-testid="import-pdf-text-layer"/);
  assert.ok(pdf.split(/\r?\n/).length < 400, "PdfReader should stay under 400 lines");

  assert.match(epub, /import\("epubjs"\)/);
  assert.match(epub, /book\.renderTo/);
  assert.match(epub, /flow:\s*"paginated"/);
  assert.match(epub, /data-testid="import-epubjs-stage"/);
  assert.doesNotMatch(epub, /dangerouslySetInnerHTML/);
  assert.doesNotMatch(epub, /data-epub-word/);
  assert.ok(epub.split(/\r?\n/).length < 400, "EpubReader should stay under 400 lines");
});
