import { readFile } from "node:fs/promises";
import assert from "node:assert/strict";
import test from "node:test";

const readText = (filePath) => readFile(filePath, "utf8");

test("TALK-001 wires SpanishText into completed Spanish assistant messages only", async () => {
  const source = await readText("src/app/talk/[characterId]/TalkClient.tsx");

  assert.match(source, /import \{ SpanishText \} from "@\/app\/components\/vocab\/SpanishText"/);
  assert.match(source, /function isSpanishLookupCharacter/);
  assert.match(source, /characterId === "carlos"/);
  assert.match(source, /characterId\.startsWith\("es-"\)/);
  assert.match(source, /message\.role === "assistant"/);
  assert.match(source, /const isAssistantStreaming = streaming && index === messages\.length - 1 && !isUser/);
  assert.match(source, /!isAssistantStreaming/);
  assert.match(source, /<SpanishText/);
  assert.match(source, /type:\s*"talk"/);
  assert.match(source, /characterId/);
  assert.match(source, /sessionId:/);
  assert.match(source, /messageIndex:\s*index/);
  assert.match(source, /sentence:\s*message\.content/);
});

test("TALK-001 keeps non-Spanish characters and user messages as plain text", async () => {
  const source = await readText("src/app/talk/[characterId]/TalkClient.tsx");

  assert.match(source, /const canLookupAssistantMessage =[\s\S]*!isUser[\s\S]*isSpanishLookupCharacter/);
  assert.match(source, /canLookupAssistantMessage \?/);
  assert.match(source, /<p className="whitespace-pre-wrap text-\[15px\] leading-relaxed">/);
});

test("TALK-001 extends lookup source metadata through the vocab save path", async () => {
  const lookupCard = await readText("src/app/watch/LookupCard.tsx");
  const route = await readText("src/app/api/vocab/add/route.ts");
  const lib = await readText("src/lib/vocab.ts");

  assert.match(lookupCard, /type:\s*"talk"/);
  assert.match(lookupCard, /characterId: string/);
  assert.match(lookupCard, /sessionId: string/);
  assert.match(lookupCard, /messageIndex: number/);
  assert.match(lookupCard, /talk:\$\{resolvedSource\.characterId\}:\$\{resolvedSource\.sessionId\}:m\$\{resolvedSource\.messageIndex\}/);
  assert.match(route, /body\.sourceType === "talk"/);
  assert.match(lib, /"talk"/);
});

test("TALK-001 vocab history displays talk source as talk dot character name", async () => {
  const source = await readText("src/app/components/vocab/VocabAccordion.tsx");

  assert.match(source, /TALK_SOURCE_NAMES/);
  assert.match(source, /carlos:\s*"Carlos"/);
  assert.match(source, /encounter\.sourceType === "talk"/);
  assert.match(source, /talk · \$\{talkName\}/);
  assert.match(source, /badgeLabel =[\s\S]*\? "talk"/);
});
