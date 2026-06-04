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

test("TALK-002 page preserves the desktop shell while routing through a mobile character shell", async () => {
  const page = await readText("src/app/talk/[characterId]/page.tsx");
  const shell = await readText("src/app/talk/[characterId]/TalkCharacterShell.tsx");
  const sidebar = await readText("src/app/talk/[characterId]/TalkSidebar.tsx");

  assert.match(page, /TalkCharacterShell/);
  assert.match(shell, /max-w-app-shell/);
  assert.match(shell, /md:flex/);
  assert.match(shell, /md:w-\[260px\]/);
  assert.match(shell, /md:shrink-0/);
  assert.match(shell, /border-r border-zinc-200/);
  assert.match(shell, /flex-1/);
  assert.match(shell, /mx-auto/);
  assert.match(shell, /max-w-3xl/);
  assert.match(sidebar, /brand-/);
  assert.match(sidebar, /h-11 md:h-9/);
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

test("TALK-002 mobile drawer is controlled from the page shell and uses the new 82vw layout", async () => {
  const shell = await readText("src/app/talk/[characterId]/TalkCharacterShell.tsx");
  const sidebar = await readText("src/app/talk/[characterId]/TalkSidebar.tsx");
  const client = await readText("src/app/talk/[characterId]/TalkClient.tsx");

  assert.match(shell, /const \[sessionsOpen, setSessionsOpen\] = useState\(false\)/);
  assert.match(shell, /aria-label="对话记录"/);
  assert.match(sidebar, /w-\[82vw\]/);
  assert.match(sidebar, /bg-black\/40/);
  assert.match(sidebar, /md:hidden/);
  assert.match(sidebar, /还没和 \{characterName\} 聊过/);
  assert.match(sidebar, /点上面「新对话」开始/);
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
