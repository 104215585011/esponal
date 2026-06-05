import { existsSync } from "node:fs";
import { readFile } from "node:fs/promises";
import assert from "node:assert/strict";
import test from "node:test";

const readText = (filePath) => readFile(filePath, "utf8");

test("CREDITS-FE-002 exposes an authenticated credit transactions API with cursor pagination", async () => {
  const routePath = "src/app/api/credits/transactions/route.ts";
  assert.equal(existsSync(routePath), true, `${routePath} missing`);

  const routeSource = await readText(routePath);
  assert.match(routeSource, /getServerSession/);
  assert.match(routeSource, /getAuthOptions/);
  assert.match(routeSource, /cursor/);
  assert.match(routeSource, /limit/);
  assert.match(routeSource, /getCreditTransactionsPage/);

  const historySource = await readText("src/lib/credits/history.ts");
  assert.match(historySource, /take:\s*safeLimit \+ 1/);
  assert.match(historySource, /orderBy:\s*\[\s*\{\s*createdAt:\s*"desc"/);
  assert.match(historySource, /id:\s*"desc"/);
  assert.match(historySource, /where:\s*\{\s*userId\s*\}/);
  assert.match(historySource, /nextCursor/);
  assert.match(historySource, /deltaDisplay/);
  assert.match(historySource, /balanceAfterDisplay/);
});

test("CREDITS-FE-002 centralizes reason and refType label mapping for ledger rows", async () => {
  const labelsPath = "src/lib/credits/labels.ts";
  assert.equal(existsSync(labelsPath), true, `${labelsPath} missing`);

  const source = await readText(labelsPath);
  assert.match(source, /grant/);
  assert.match(source, /signup/);
  assert.match(source, /注册赠送|娉ㄥ唽璧犻€?/);
  assert.match(source, /refill/);
  assert.match(source, /月度配额补充|鏈堝害閰嶉琛ュ厖/);
  assert.match(source, /talk_turn/);
  assert.match(source, /AI 对话|AI 瀵硅瘽/);
  assert.match(source, /tts/);
  assert.match(source, /发音朗读|鍙戦煶鏈楄/);
  assert.match(source, /lookup_fallback/);
  assert.match(source, /phrase_extract/);
  assert.match(source, /video_unlock/);
  assert.match(source, /配额消费|閰嶉娑堣垂/);
});

test("CREDITS-FE-002 adds an account credits page with summary card, grouped ledger, and membership jump", async () => {
  const pagePath = "src/app/account/credits/page.tsx";
  assert.equal(existsSync(pagePath), true, `${pagePath} missing`);

  const pageSource = await readText(pagePath);
  assert.match(pageSource, /SiteHeader/);
  assert.match(pageSource, /getCreditSummary/);
  assert.match(pageSource, /transactions/);
  assert.match(pageSource, /nextCursor/);
  assert.match(pageSource, /管理会员|绠＄悊浼氬憳/);

  const clientSource = await readText("src/app/account/credits/CreditHistoryClient.tsx");
  assert.match(clientSource, /加载更多|鍔犺浇鏇村/);
  assert.match(clientSource, /还没有配额记录|杩樻病鏈夐厤棰濊褰?/);
  assert.match(clientSource, /今天|浠婂ぉ/);
  assert.match(clientSource, /更早|鏇存棭/);
});

test("CREDITS-FE-002 routes mobile drawer and desktop balance pill to the account credits page", async () => {
  const headerSource = await readText("src/app/components/web/SiteHeader.tsx");
  const navSource = await readText("src/app/components/web/MobileNav.tsx");

  assert.match(headerSource, /href="\/account\/credits"/);
  assert.match(navSource, /href="\/account\/credits"/);
  assert.match(navSource, /积分账户|绉垎璐︽埛/);
});
