// Timestamp: 2026-05-29 01:37
import { existsSync } from "node:fs";
import { readFile } from "node:fs/promises";
import assert from "node:assert/strict";
import test from "node:test";

const readText = (path) => readFile(path, "utf8");

test("LEX-003 LookupCard has relatedPhrases and usageNote fields in types", async () => {
  const lookupCard = await readText("src/app/watch/LookupCard.tsx");

  assert.match(lookupCard, /relatedPhrases\?: RelatedPhrase\[\]/);
  assert.match(lookupCard, /usageNote\?: string \| null/);
  assert.match(lookupCard, /onRelatedPhraseClick\?: \(lemma: string, kind: "collocation" \| "phrase" \| "idiom"\) => void/);
});

test("LEX-003 LookupCard renders relatedPhrases section and usageNote block", async () => {
  const lookupCard = await readText("src/app/watch/LookupCard.tsx");

  // relatedPhrases rendering
  assert.match(lookupCard, /lookupKind === "word"/);
  assert.match(lookupCard, /相关搭配/);
  assert.match(lookupCard, /phrase\.translationZh/);
  assert.match(lookupCard, /onRelatedPhraseClick\?\.(\(\s*phrase\.lemma,\s*phrase\.kind\s*\))/);

  // usageNote rendering
  assert.match(lookupCard, /用法提示/);
  assert.match(lookupCard, /border-l-2 border-brand-500/);
});

test("LEX-003 all surface/integration files wire onRelatedPhraseClick callback", async () => {
  const targets = [
    "src/app/components/vocab/SpanishText.tsx",
    "src/app/lectura/LecturaReader.tsx",
    "src/app/lectura/ReadingDock.tsx",
    "src/app/watch/SubtitlePanel.tsx",
    "src/app/watch/TranscriptPanel.tsx",
    "src/app/dissect/DissectorClient.tsx"
  ];

  for (const target of targets) {
    assert.ok(existsSync(target), `${target} should exist`);
    const source = await readText(target);
    assert.match(source, /onRelatedPhraseClick/, `${target} should specify/forward onRelatedPhraseClick`);
  }
});
