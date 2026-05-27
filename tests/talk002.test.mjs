import { access, readFile } from "node:fs/promises";
import assert from "node:assert/strict";
import test from "node:test";

const readText = (filePath) => readFile(filePath, "utf8");

test("TALK-002 exposes active session list API scoped to character", async () => {
  await access("src/app/api/talk/sessions/route.ts");
  const route = await readText("src/app/api/talk/sessions/route.ts");
  const service = await readText("src/lib/talk/session-service.ts");

  assert.match(route, /characterId/);
  assert.match(route, /getTalkCharacterById/);
  assert.match(route, /listActiveTalkSessions/);
  assert.match(route, /NextResponse\.json\(\{ items/);
  assert.match(service, /status:\s*"ACTIVE"/);
  assert.match(service, /characterId:\s*input\.characterId/);
  assert.match(service, /orderBy:\s*\{\s*updatedAt:\s*"desc"\s*\}/);
  assert.match(service, /lastMessagePreview/);
});

test("TALK-002 creates draft sessions and uses 30 character fallback titles", async () => {
  const route = await readText("src/app/api/talk/sessions/route.ts");
  const service = await readText("src/lib/talk/session-service.ts");
  const chatService = await readText("src/lib/talk/chat-service.ts");

  assert.match(route, /export async function POST/);
  assert.match(route, /createTalkSession/);
  assert.match(service, /DRAFT_TITLE = "新会话"/);
  assert.match(service, /title:\s*DRAFT_TITLE/);
  assert.match(chatService, /buildInitialSessionTitle/);
  assert.match(chatService, /\.slice\(0,\s*30\)/);
  assert.doesNotMatch(chatService, /input\.message\.slice\(0,\s*80\)/);
});

test("TALK-002 retitle API generates concise titles after enough turns", async () => {
  await access("src/app/api/talk/sessions/[id]/retitle/route.ts");
  const route = await readText("src/app/api/talk/sessions/[id]/retitle/route.ts");
  const service = await readText("src/lib/talk/session-service.ts");
  const modelClient = await readText("src/lib/talk/model-client.ts");

  assert.match(route, /export async function POST/);
  assert.match(route, /retitleTalkSession/);
  assert.match(service, /count/);
  assert.match(service, /_count:\s*\{[\s\S]*messages/);
  assert.match(service, /messages < 8/);
  assert.match(service, /generateSessionTitle/);
  assert.match(modelClient, /generateSessionTitle/);
  assert.match(modelClient, /5-10/);
});

test("TALK-002 page uses a 260px desktop sidebar and preserves max-w-3xl message width", async () => {
  const page = await readText("src/app/talk/[characterId]/page.tsx");
  const sidebar = await readText("src/app/talk/[characterId]/TalkSidebar.tsx");

  assert.match(page, /max-w-app-shell/);
  assert.match(page, /lg:flex/);
  assert.match(page, /lg:w-\[260px\]/);
  assert.match(page, /lg:shrink-0/);
  assert.match(page, /border-r border-gray-200/);
  assert.match(page, /flex-1/);
  assert.match(page, /mx-auto/);
  assert.match(page, /max-w-3xl/);
  assert.match(sidebar, /brand-/);
  assert.match(sidebar, /h-9/);
  assert.match(sidebar, /border-/);
});

test("TALK-002 client syncs URL session state and loads selected history", async () => {
  const client = await readText("src/app/talk/[characterId]/TalkClient.tsx");
  const sidebar = await readText("src/app/talk/[characterId]/TalkSidebar.tsx");

  assert.match(client, /initialSessionId/);
  assert.match(client, /useSearchParams/);
  assert.match(client, /\/api\/talk\/history\?sessionId=/);
  assert.match(client, /setMessages\(/);
  assert.match(sidebar, /router\.replace/);
  assert.match(sidebar, /\?session=\$\{session\.id\}/);
  assert.match(sidebar, /onSessionChange/);
});

test("TALK-002 mobile drawer is 80vw with a 20vw overlay and title fade", async () => {
  const sidebar = await readText("src/app/talk/[characterId]/TalkSidebar.tsx");
  const client = await readText("src/app/talk/[characterId]/TalkClient.tsx");

  assert.match(sidebar, /w-\[80vw\]/);
  assert.match(sidebar, /bg-black\/30/);
  assert.match(sidebar, /lg:hidden/);
  assert.match(sidebar, /还没有和 \{characterName\} 聊过/);
  assert.match(sidebar, /点上方/);
  assert.match(sidebar, /transition-opacity/);
  assert.match(sidebar, /duration-150/);
  assert.match(client, /\/api\/talk\/sessions\/\$\{completedSessionId\}\/retitle/);
});

test("TALK-002 rejects cross-character session history and continuation", async () => {
  const historyRoute = await readText("src/app/api/talk/history/route.ts");
  const historyService = await readText("src/lib/talk/history-service.ts");
  const messageRoute = await readText("src/app/api/talk/message/route.ts");
  const chatService = await readText("src/lib/talk/chat-service.ts");
  const client = await readText("src/app/talk/[characterId]/TalkClient.tsx");

  assert.match(historyRoute, /characterId/);
  assert.match(historyRoute, /getTalkCharacterById/);
  assert.match(historyRoute, /characterId,\s*\n\s*page/);

  assert.match(historyService, /characterId:\s*string/);
  assert.match(historyService, /characterId:\s*input\.characterId/);
  assert.match(historyService, /prisma\.chatSession\.count\(\{[\s\S]*characterId:\s*input\.characterId/);

  assert.match(messageRoute, /where:\s*\{[\s\S]*id:\s*sessionId[\s\S]*userId[\s\S]*characterId/);
  assert.match(chatService, /where:\s*\{[\s\S]*id:\s*input\.sessionId[\s\S]*userId:\s*input\.userId[\s\S]*characterId:\s*character\.id/);
  assert.match(chatService, /throw new Error\("SESSION_NOT_FOUND"\)/);

  assert.match(client, /item\.characterId !== characterId/);
  assert.match(client, /router\.replace\(`\/talk\/\$\{characterId\}`/);
  assert.match(client, /setStatusMessage\("无法访问该会话（角色不匹配）"\)/);
});
