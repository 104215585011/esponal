import { access, readFile } from "node:fs/promises";
import assert from "node:assert/strict";
import test from "node:test";

const readText = (filePath) => readFile(filePath, "utf8");

test("TALK-003 adds archivedAt storage and cleanup tooling", async () => {
  const schema = await readText("prisma/schema.prisma");
  const featureList = await readText("feature_list.json");

  await access("scripts/cleanup-archived-sessions.mjs");
  await access("src/app/api/talk/cron/cleanup-archived/route.ts");

  const script = await readText("scripts/cleanup-archived-sessions.mjs");
  const cronRoute = await readText("src/app/api/talk/cron/cleanup-archived/route.ts");
  const vercel = await readText("vercel.json");

  assert.match(schema, /archivedAt\s+DateTime\?\s+@map\("archived_at"\)/);
  assert.match(script, /status:\s*"ARCHIVED"/);
  assert.match(script, /archivedAt:\s*\{\s*lt:\s*cutoff\s*\}/);
  assert.match(script, /deleteMany/);
  assert.match(cronRoute, /CRON_SECRET/);
  assert.match(cronRoute, /Authorization/);
  assert.match(cronRoute, /cleanupArchivedSessions/);
  assert.match(vercel, /\/api\/talk\/cron\/cleanup-archived/);
  assert.match(vercel, /0 3 \* \* \*/);
  assert.match(featureList, /archive 6 天后不删 \/ archive 8 天后删/);
});

test("TALK-003 archive and restore APIs keep ownership, archivedAt, and ACTIVE filtering", async () => {
  await access("src/app/api/talk/sessions/[id]/route.ts");
  await access("src/app/api/talk/sessions/[id]/restore/route.ts");

  const sessionRoute = await readText("src/app/api/talk/sessions/[id]/route.ts");
  const restoreRoute = await readText("src/app/api/talk/sessions/[id]/restore/route.ts");
  const service = await readText("src/lib/talk/session-service.ts");
  const historyRoute = await readText("src/app/api/talk/history/route.ts");
  const historyService = await readText("src/lib/talk/history-service.ts");
  const messageRoute = await readText("src/app/api/talk/message/route.ts");
  const chatService = await readText("src/lib/talk/chat-service.ts");

  assert.match(sessionRoute, /export async function DELETE/);
  assert.match(service, /archiveTalkSession/);
  assert.match(service, /status:\s*"ARCHIVED"/);
  assert.match(service, /archivedAt:\s*new Date\(\)/);

  assert.match(restoreRoute, /export async function POST/);
  assert.match(service, /restoreTalkSession/);
  assert.match(service, /status:\s*"ACTIVE"/);
  assert.match(service, /archivedAt:\s*null/);

  assert.match(historyRoute, /includeArchived/);
  assert.match(historyService, /includeArchived\?: boolean/);
  assert.match(historyService, /status:\s*input\.includeArchived \? undefined : "ACTIVE"/);

  assert.match(messageRoute, /status:\s*"ACTIVE"/);
  assert.match(chatService, /where:\s*\{[\s\S]*id:\s*input\.sessionId[\s\S]*userId:\s*input\.userId[\s\S]*characterId:\s*character\.id[\s\S]*status:\s*"ACTIVE"/);
});

test("TALK-003 sidebar exposes desktop hover archive, mobile always-visible archive, and restore drawer", async () => {
  const sidebar = await readText("src/app/talk/[characterId]/TalkSidebar.tsx");

  assert.match(sidebar, /group-hover:opacity-100/);
  assert.match(sidebar, /lg:opacity-0/);
  assert.match(sidebar, /opacity-100/);
  assert.match(sidebar, /🗑/);
  assert.match(sidebar, /归档此对话/);
  assert.match(sidebar, /归档后会从列表移除/);
  assert.match(sidebar, /底部「归档」抽屉里恢复/);
  assert.match(sidebar, /归档/);
  assert.match(sidebar, /恢复/);
  assert.match(sidebar, /includeArchived=true/);
  assert.match(sidebar, /\/api\/talk\/sessions\/\$\{session\.id\}/);
  assert.match(sidebar, /\/api\/talk\/sessions\/\$\{session\.id\}\/restore/);
});
