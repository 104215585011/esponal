import assert from "node:assert/strict";
import test from "node:test";
import AdmZip from "adm-zip";
import { PDFDocument, StandardFonts } from "pdf-lib";

function makeEpubBuffer() {
  const zip = new AdmZip();
  zip.addFile("mimetype", Buffer.from("application/epub+zip"));
  zip.addFile(
    "META-INF/container.xml",
    Buffer.from(`<?xml version="1.0" encoding="UTF-8"?>
<container version="1.0" xmlns="urn:oasis:names:tc:opendocument:xmlns:container">
  <rootfiles>
    <rootfile full-path="OEBPS/content.opf" media-type="application/oebps-package+xml"/>
  </rootfiles>
</container>`),
  );
  zip.addFile(
    "OEBPS/content.opf",
    Buffer.from(`<?xml version="1.0" encoding="UTF-8"?>
<package version="3.0" xmlns="http://www.idpf.org/2007/opf" unique-identifier="BookId">
  <metadata xmlns:dc="http://purl.org/dc/elements/1.1/">
    <dc:title>Mini Libro</dc:title>
  </metadata>
  <manifest>
    <item id="chapter-1" href="chapter1.xhtml" media-type="application/xhtml+xml"/>
    <item id="chapter-2" href="chapter2.xhtml" media-type="application/xhtml+xml"/>
  </manifest>
  <spine>
    <itemref idref="chapter-1"/>
    <itemref idref="chapter-2"/>
  </spine>
</package>`),
  );
  zip.addFile(
    "OEBPS/chapter1.xhtml",
    Buffer.from(`<html xmlns="http://www.w3.org/1999/xhtml"><body><h1>Capítulo uno</h1><p>Hola desde el primer capítulo.</p></body></html>`),
  );
  zip.addFile(
    "OEBPS/chapter2.xhtml",
    Buffer.from(`<html xmlns="http://www.w3.org/1999/xhtml"><body><p>Seguimos con el segundo capítulo.</p><p>Más texto útil.</p></body></html>`),
  );
  return zip.toBuffer();
}

async function makePdfBuffer() {
  const pdf = await PDFDocument.create();
  const font = await pdf.embedFont(StandardFonts.Helvetica);
  const page1 = pdf.addPage([400, 400]);
  page1.drawText("Hola desde la primera pagina", { x: 40, y: 320, size: 18, font });
  const page2 = pdf.addPage([400, 400]);
  page2.drawText("Seguimos en la segunda pagina", { x: 40, y: 320, size: 18, font });
  const bytes = await pdf.save();
  return Buffer.from(bytes);
}

test("IMPORT-1 paginateImportedText keeps nearby paragraphs together and starts a new page near the target", async () => {
  const { paginateImportedText } = await import("../src/lib/import/paginate.ts");
  const text = [
    "Uno dos tres.",
    "Cuatro cinco seis.",
    "Siete ocho nueve diez once doce trece catorce quince dieciseis.",
  ].join("\n\n");

  const pages = paginateImportedText(text, { targetCharsPerPage: 40 });

  assert.equal(pages.length, 2);
  assert.match(pages[0], /Uno dos tres\./);
  assert.match(pages[0], /Cuatro cinco seis\./);
  assert.doesNotMatch(pages[0], /Siete ocho nueve/);
  assert.match(pages[1], /Siete ocho nueve diez/);
});

test("IMPORT-1 parseImportedDocument extracts ordered chapter text from a real EPUB zip", async () => {
  const { parseImportedDocument } = await import("../src/lib/import/parse.ts");
  const file = new File([makeEpubBuffer()], "mini-libro.epub", {
    type: "application/epub+zip",
  });

  const parsed = await parseImportedDocument(file);

  assert.equal(parsed.kind, "epub");
  assert.equal(parsed.title, "Mini Libro");
  assert.ok(parsed.pages.length >= 1);
  assert.match(parsed.pages.join("\n"), /Capítulo uno/);
  assert.match(parsed.pages.join("\n"), /Hola desde el primer capítulo\./);
  assert.match(parsed.pages.join("\n"), /Seguimos con el segundo capítulo\./);
});

test("IMPORT-1 parseImportedDocument keeps text PDF pages separate and readable", async () => {
  const { parseImportedDocument } = await import("../src/lib/import/parse.ts");
  const file = new File([await makePdfBuffer()], "dos-paginas.pdf", {
    type: "application/pdf",
  });

  const parsed = await parseImportedDocument(file);

  assert.equal(parsed.kind, "pdf_text");
  assert.equal(parsed.title, "dos-paginas");
  assert.equal(parsed.pages.length, 2);
  assert.match(parsed.pages[0], /Hola desde la primera pagina/i);
  assert.match(parsed.pages[1], /Seguimos en la segunda pagina/i);
});
