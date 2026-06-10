import assert from "node:assert/strict";
import { existsSync } from "node:fs";
import { readFile } from "node:fs/promises";
import test from "node:test";
import AdmZip from "adm-zip";

async function read(path) {
  return readFile(path, "utf8");
}

test("IMPORT-3 EPUB reader exposes a same-origin parsed spine API", async () => {
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
  assert.doesNotMatch(helper, /dangerouslySetInnerHTML/);

  const route = await read(routePath);
  assert.match(route, /getServerSession\(getAuthOptions\(\)\)/);
  assert.match(route, /getImportedDocumentByIdForUser\(userId,\s*context\.params\.id\)/);
  assert.match(route, /document\.kind !== "epub"/);
  assert.match(route, /presignGet\(\{\s*key:\s*document\.ossKey\s*\}\)/);
  assert.match(route, /source_fetch_failed/);
  assert.match(route, /Imported EPUB source fetch failed/);
  assert.match(route, /parseEpubForReader/);
  assert.match(route, /NextResponse\.json\(\{\s*chapters/);
});

test("IMPORT-3 client renders EPUB chapters instead of the接入中 fallback", async () => {
  const client = await read("src/app/import/[id]/ImportReaderClient.tsx");

  assert.match(client, /type EpubChapter/);
  assert.match(client, /epubChapters,\s*setEpubChapters/);
  assert.match(client, /fetch\(`\/api\/import\/\$\{documentId\}\/epub`/);
  assert.match(client, /const chapters = payload\.chapters/);
  assert.match(client, /setEpubChapters\(chapters\)/);
  assert.match(client, /lastPosition:\s*`epub:\$\{epubChapterIndex\}`/);
  assert.match(client, /activeEpubChapter/);
  assert.match(client, /data-testid="import-epub-reader"/);
  assert.match(client, /whitespace-pre-wrap/);
  assert.match(client, /epubChapterIndex/);
  assert.doesNotMatch(client, /EPUB 阅读器正在接入/);
  assert.doesNotMatch(client, /完整的 EPUB 翻页和点词阅读器会继续接入/);
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
  zip.addFile("OPS/chapters/two.xhtml", Buffer.from(`<html><body><h2>Dos</h2><p>Adiós.</p><script>bad()</script></body></html>`));

  const parsed = parseEpubForReader(new Uint8Array(zip.toBuffer()));

  assert.equal(parsed.chapters.length, 2);
  assert.equal(parsed.chapters[0].title, "Uno");
  assert.match(parsed.chapters[0].text, /Hola & bienvenido/);
  assert.equal(parsed.chapters[1].title, "Dos");
  assert.match(parsed.chapters[1].text, /Adiós/);
  assert.doesNotMatch(parsed.chapters[1].text, /bad/);
});
