import assert from "node:assert/strict";
import test from "node:test";
import { readFile } from "node:fs/promises";

async function readText(path) {
  return await readFile(path, "utf8");
}

test("PHRASE-001 SpanishText supports opt-in phrase spans without enabling talk", async () => {
  const spanishText = await readText("src/app/components/vocab/SpanishText.tsx");
  const grammarPage = await readText("src/app/grammar/[slug]/page.tsx");
  const talkPage = await readText("src/app/talk/[characterId]/TalkClient.tsx");

  assert.match(spanishText, /enablePhrases\?: boolean/);
  const phraseText = await readText("src/app/components/vocab/PhraseText.tsx");
  assert.match(phraseText, /\/api\/lexicon\/detect-phrases/);
  assert.match(phraseText, /phrase-highlight inline bg-amber-100\/50 dark:bg-amber-950\/30/);
  assert.match(spanishText, /event\.stopPropagation\(\)/);
  assert.match(grammarPage, /enablePhrases=\{true\}/);
  assert.doesNotMatch(talkPage, /enablePhrases=\{true\}/);
});

test("PHRASE-001 LookupCard exposes phrase accent, badge, and two-layer stack classes", async () => {
  const lookupCard = await readText("src/app/watch/LookupCard.tsx");

  assert.match(lookupCard, /lookupKind\?: "word" \| "phrase"/);
  assert.match(lookupCard, /absolute top-0 left-0 right-0 h-1 bg-amber-500 dark:bg-amber-600/);
  assert.match(lookupCard, /bg-amber-50 dark:bg-amber-950\/40 border border-amber-200\/30/);
  assert.match(lookupCard, /scale-\[0\.96\] -translate-y-3 opacity-40 blur-\[0\.5px\]/);
  assert.match(lookupCard, /cards\.slice\(-2\)/);
});

test("PHRASE-001 four approved surfaces call phrase detection and preserve word lookup", async () => {
  const phraseText = await readText("src/app/components/vocab/PhraseText.tsx").catch(() => "");
  assert.match(phraseText, /\/api\/lexicon\/detect-phrases/);

  const targets = [
    "src/app/lectura/LecturaReader.tsx",
    "src/app/watch/SubtitlePanel.tsx",
    "src/app/watch/TranscriptPanel.tsx",
    "src/app/dissect/DissectorClient.tsx"
  ];

  for (const target of targets) {
    const source = await readText(target);
    assert.match(source, /usePhraseSpans|buildPhraseSegments/, `${target} should detect phrases`);
    assert.match(source, /PHRASE_HIGHLIGHT_CLASSES/, `${target} should render phrase highlights`);
    assert.match(source, /LookupCard/, `${target} should keep lookup cards wired`);
  }
});
