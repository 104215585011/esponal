import { existsSync } from "node:fs";
import { readFile } from "node:fs/promises";
import assert from "node:assert/strict";
import test from "node:test";

const readText = (path) => readFile(path, "utf8");

test("VOCAB-009 Phase A adds SpanishText component with reviewed props and visual constraints", async () => {
  const source = await readText("src/app/components/vocab/SpanishText.tsx");

  assert.match(source, /export function SpanishText/);
  assert.match(source, /text:/);
  assert.match(source, /translation\?:/);
  assert.match(source, /source\?:/);
  assert.match(source, /className\?:/);
  assert.match(source, /wordClassName\?:/);
  assert.match(source, /interactionDensity\?:\s*"inline"\s*\|\s*"dense"\s*\|\s*"readOnly"/);
  assert.match(source, /enableKeyboard\?:/);
  assert.doesNotMatch(source, /readOnly\?:/);
  assert.match(source, /@media \(hover: none\)/);
  assert.match(source, /bg-brand-50\/40/);
  assert.doesNotMatch(source, /hover:underline/);
  assert.match(source, /max-w-\[min\(20rem,calc\(100vw-2rem\)\)\]/);
  assert.match(source, /savedFormsPromise\s*=\s*null/);
  assert.match(source, /TODO:.*roving tabindex/i);
});

test("VOCAB-009 Phase A extends lookup source types and vocab save sourceType handling", async () => {
  const lookupCard = await readText("src/app/watch/LookupCard.tsx");
  const route = await readText("src/app/api/vocab/add/route.ts");
  const lib = await readText("src/lib/vocab.ts");

  assert.match(lookupCard, /type:\s*"dissect"/);
  assert.match(lookupCard, /type:\s*"grammar"/);
  assert.match(route, /"dissect"/);
  assert.match(route, /"grammar"/);
  assert.match(lib, /"dissect"/);
  assert.match(lib, /"grammar"/);
});

test("VOCAB-009 Phase A removes CourseLookupText and migrates existing course callers", async () => {
  assert.equal(
    existsSync("src/app/learn/[slug]/CourseLookupText.tsx"),
    false,
    "CourseLookupText should be deleted after SpanishText migration"
  );

  const learnPage = await readText("src/app/learn/[slug]/page.tsx");
  const foundationDay = await readText("src/app/learn/foundation/[day]/page.tsx");

  assert.match(learnPage, /SpanishText/);
  assert.match(foundationDay, /SpanishText/);
  assert.doesNotMatch(learnPage, /CourseLookupText/);
  assert.doesNotMatch(foundationDay, /CourseLookupText/);
});

test("VOCAB-009 Phase A leaves high-risk already validated readers untouched", async () => {
  const lectura = await readText("src/app/lectura/LecturaReader.tsx");
  const dissect = await readText("src/app/dissect/DissectorClient.tsx");

  assert.doesNotMatch(lectura, /SpanishText/);
  assert.doesNotMatch(dissect, /SpanishText/);
  assert.match(dissect, /LookupCard/);
  assert.match(dissect, /activePopover/);
  assert.match(dissect, /activeContent/);
});

test("VOCAB-009 Phase B wires SpanishText into only explicit grammar detail Spanish fields", async () => {
  const detail = await readText("src/app/grammar/[slug]/page.tsx");

  assert.match(detail, /import \{ SpanishText \} from "@\/app\/components\/vocab\/SpanishText"/);
  assert.match(detail, /source=\{\{\s*type:\s*"grammar"/);
  assert.match(detail, /topicSlug:\s*topic\.slug/);
  assert.match(detail, /url:\s*`\/grammar\/\$\{topic\.slug\}`/);

  assert.match(detail, /text=\{row\.pronoun\}/);
  assert.match(detail, /text=\{row\.form\}/);
  assert.match(detail, /text=\{example\.spanish\}/);
  assert.match(detail, /text=\{item\.spanish\}/);
  assert.match(detail, /interactionDensity="dense"/);
  assert.match(detail, /enableKeyboard=\{true\}/);

  assert.match(detail, /\{topic\.intro\}/);
  assert.match(detail, /\{topic\.analogy\}/);
  assert.match(detail, /\{rule\}/);
  assert.match(detail, /\{example\.chinese\}/);
  assert.match(detail, /\{example\.reason\}/);
});

test("VOCAB-009 Phase B keeps the grammar list page out of SpanishText", async () => {
  const list = await readText("src/app/grammar/page.tsx");

  assert.doesNotMatch(list, /SpanishText/);
});
