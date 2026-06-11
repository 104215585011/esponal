import assert from "node:assert/strict";
import { existsSync } from "node:fs";
import { readFile } from "node:fs/promises";
import test from "node:test";
import AdmZip from "adm-zip";

async function read(path) {
  return readFile(path, "utf8");
}

test("IMPORT-3 EPUB reader still exposes a same-origin parsed spine API for fallback/parser coverage", async () => {
  const helperPath = "src/lib/import/epub.ts";
  const routePath = "src/app/api/import/[id]/epub/route.ts";
  assert.equal(existsSync(helperPath), true, `${helperPath} missing`);
  assert.equal(existsSync(routePath), true, `${routePath} missing`);

  const helper = await read(helperPath);
  assert.match(helper, /AdmZip/);
  assert.match(helper, /META-INF\/container\.xml/);
  assert.match(helper, /parseEpubForReader/);
  assert.match(helper, /spine/);
  assert.match(helper, /chapters/);
  assert.match(helper, /stripEpubHtmlToText/);
  assert.match(helper, /sanitizeEpubHtmlChapter/);
  assert.doesNotMatch(helper, /dangerouslySetInnerHTML/);

  const route = await read(routePath);
  assert.match(route, /getServerSession\(getAuthOptions\(\)\)/);
  assert.match(route, /getImportedDocumentFileByIdForUser\(userId,\s*context\.params\.id\)/);
  assert.match(route, /document\.kind !== "epub"/);
  assert.match(route, /presignGet\(\{\s*key:\s*document\.ossKey\s*\}\)/);
  assert.match(route, /source_fetch_failed/);
  assert.match(route, /Imported EPUB source fetch failed/);
  assert.match(route, /parseEpubForReader/);
  assert.match(route, /NextResponse\.json\(\{\s*chapters/);
});

test("IMPORT-7 M1 client renders EPUB through epub.js instead of parsed chapter HTML", async () => {
  const client = await read("src/app/import/[id]/ImportReaderClient.tsx");
  const epub = await read("src/app/import/[id]/EpubReader.tsx");

  assert.match(client, /import \{ EpubReader,\s*type EpubChapter \} from "\.\/EpubReader"/);
  assert.match(client, /lastPosition:\s*`epub:\$\{epubChapterIndex\}:\$\{epubPageInChapter\}`/);
  assert.match(client, /epubChapterIndex/);
  assert.match(epub, /type EpubChapter/);
  assert.match(epub, /import\("epubjs"\)/);
  assert.match(epub, /fetch\(`\/api\/import\/\$\{documentId\}\/url`/);
  assert.match(epub, /payload\.url/);
  assert.match(epub, /book\.renderTo/);
  assert.match(epub, /flow:\s*"paginated"/);
  assert.match(epub, /spread:\s*"none"/);
  assert.match(epub, /setChapterList\(chapters\)/);
  assert.match(epub, /data-testid="import-epub-reader"/);
  assert.match(epub, /data-testid="import-epubjs-stage"/);
  assert.doesNotMatch(epub, /dangerouslySetInnerHTML/);
  assert.doesNotMatch(epub, /data-epub-word/);
});

test("IMPORT-3 EPUB parser extracts OPF spine chapters as readable text", async () => {
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
          <item id="chap1" href="chapters/one.xhtml#intro" media-type="application/xhtml+xml"/>
          <item id="chap2" href="chapters/two.xhtml" media-type="application/xhtml+xml"/>
        </manifest>
        <spine><itemref idref="chap1"/><itemref idref="chap2"/></spine>
      </package>
    `),
  );
  zip.addFile("OPS/chapters/one.xhtml", Buffer.from(`<html><head><title>Uno</title></head><body><h1>Uno</h1><p>Hola &amp; bienvenido.</p></body></html>`));
  zip.addFile("OPS/chapters/two.xhtml", Buffer.from(`<html><body><h2>Dos</h2><p>Adios.</p><script>bad()</script></body></html>`));

  const parsed = parseEpubForReader(new Uint8Array(zip.toBuffer()));

  assert.equal(parsed.chapters.length, 2);
  assert.equal(parsed.chapters[0].title, "Uno");
  assert.match(parsed.chapters[0].text, /Hola & bienvenido/);
  assert.match(parsed.chapters[0].html, /data-epub-word="Hola"/);
  assert.equal(parsed.chapters[1].title, "Dos");
  assert.match(parsed.chapters[1].text, /Adios/);
  assert.doesNotMatch(parsed.chapters[1].text, /bad/);
  assert.doesNotMatch(parsed.chapters[1].html, /script|bad/);
});
