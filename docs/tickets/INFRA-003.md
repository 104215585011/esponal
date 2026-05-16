# INFRA-003 — 关键路径 E2E 测试（Playwright）

**优先级**：P2 | **负责人**：Codex1 | **日期**：2026-05-16
**前置依赖**：无

---

## 背景

当前 80+ 测试主要是「读文件 + grep 正则断言」结构合同测试，几个问题：
- 不验证真实交互（点击、跳转、状态变化）
- 改 UI 内部实现就要同步改测试，但用户行为没变（测试在测代码而不是测行为）
- 没法检测"组件们组合起来跑通了吗"

本 ticket 补 3 条关键用户路径的 E2E（Playwright），跑真浏览器，断言**用户看到的东西**。

---

## 一、Playwright 安装与配置

```bash
npm install -D @playwright/test
npx playwright install --with-deps chromium
```

`playwright.config.ts`：
```ts
import { defineConfig } from "@playwright/test";

export default defineConfig({
  testDir: "./tests/e2e",
  timeout: 30_000,
  fullyParallel: false,  // dev server 串行，避免端口冲突
  reporter: "list",
  use: {
    baseURL: "http://localhost:3000",
    screenshot: "only-on-failure",
    trace: "retain-on-failure",
  },
  webServer: {
    command: "npm run dev",
    url: "http://localhost:3000",
    timeout: 60_000,
    reuseExistingServer: !process.env.CI,
  },
});
```

---

## 二、覆盖的关键路径

### E2E-1：未登录用户首页 → 视频 → transcript

```ts
test("anon user can open homepage, click a video, see transcript", async ({ page }) => {
  await page.goto("/");
  await expect(page.locator("text=用真实的西语视频")).toBeVisible(); // hero
  await page.locator("[data-testid=video-card]").first().click();
  await expect(page).toHaveURL(/\/watch\?v=/);
  await expect(page.locator("iframe[src*='youtube.com/embed']")).toBeVisible();
  await expect(page.locator("[data-testid=transcript-cue]").first()).toBeVisible({ timeout: 15_000 });
});
```

### E2E-2：登录 → 点词 → 加入生词 → /vocab 看到

```ts
test("logged-in user can lookup a word, save it, see it in /vocab", async ({ page }) => {
  // 用预先 seed 好的测试账号
  await page.goto("/auth/sign-in");
  await page.fill("input[type=email]", process.env.E2E_USER_EMAIL!);
  await page.fill("input[type=password]", process.env.E2E_USER_PASSWORD!);
  await page.click("button[type=submit]");
  await expect(page).toHaveURL("/");

  // 打开一个固定的测试视频
  await page.goto("/watch?v=" + process.env.E2E_TEST_VIDEO_ID!);

  // 等 transcript 加载
  const firstCue = page.locator("[data-testid=transcript-cue]").first();
  await expect(firstCue).toBeVisible({ timeout: 15_000 });

  // 点第一个可查的词
  await firstCue.locator("[role=button]").first().click();

  // 看到 LookupCard
  await expect(page.locator("[data-testid=lookup-card]")).toBeVisible();

  // 点"加入我的词库"
  await page.locator("text=加入我的词库").click();
  await expect(page.locator("text=已加入词库")).toBeVisible();

  // 去 /vocab 验证
  await page.goto("/vocab");
  await expect(page.locator("[data-testid=vocab-word]")).toHaveCount({ atLeast: 1 });
});
```

### E2E-3：未登录点"加入词库" → 引导登录

```ts
test("anon user clicking 加入词库 sees inline sign-in CTA with callback", async ({ page }) => {
  await page.goto("/watch?v=" + process.env.E2E_TEST_VIDEO_ID!);
  const firstCue = page.locator("[data-testid=transcript-cue]").first();
  await expect(firstCue).toBeVisible({ timeout: 15_000 });
  await firstCue.locator("[role=button]").first().click();
  await page.locator("text=加入我的词库").click();

  // 看到登录 CTA
  await expect(page.locator("text=登录 / 注册")).toBeVisible();
  const signInLink = page.locator("a:has-text('登录 / 注册')");
  await expect(signInLink).toHaveAttribute("href", /\/auth\/sign-in\?callbackUrl=/);
});
```

---

## 三、新增 data-testid

为了 E2E 断言稳定，给关键节点加 `data-testid`：

- `VideoCard.tsx`：`data-testid="video-card"`
- `TranscriptPanel.tsx` 每个 cue 行：`data-testid="transcript-cue"`
- `LookupCard.tsx` 根容器：`data-testid="lookup-card"`
- `VocabAccordion.tsx` 每个词条：`data-testid="vocab-word"`

不影响视觉，纯测试 hook。

---

## 四、测试账号 seeding

需要一个固定的测试账号 + 测试视频 ID：

环境变量（`.env.local`，不进 git）：
```
E2E_USER_EMAIL=e2e@esponal.test
E2E_USER_PASSWORD=test-e2e-password-2026
E2E_TEST_VIDEO_ID=dQw4w9WgXcQ  # 或任一已知有西语字幕的视频
```

Seed 脚本 `scripts/seed-e2e-user.mjs`：
```ts
import { PrismaClient } from "@prisma/client";
import bcrypt from "bcryptjs";
const prisma = new PrismaClient();
const email = "e2e@esponal.test";
const password = await bcrypt.hash("test-e2e-password-2026", 10);
await prisma.user.upsert({
  where: { email },
  create: { email, password, name: "E2E User" },
  update: { password },
});
```

CI 启动前跑：`node scripts/seed-e2e-user.mjs && npx playwright test`。

---

## 五、文件清单

**新增**：
- `playwright.config.ts`
- `tests/e2e/anon-home-to-watch.spec.ts`
- `tests/e2e/login-lookup-save.spec.ts`
- `tests/e2e/anon-save-prompts-login.spec.ts`
- `scripts/seed-e2e-user.mjs`

**修改**：
- `package.json`：加 `@playwright/test` + script `"test:e2e": "playwright test"` + `"seed:e2e": "node scripts/seed-e2e-user.mjs"`
- `.env.example`：加 E2E 变量
- `.gitignore`：加 `test-results/` `playwright-report/`
- 给 `VideoCard.tsx` / `TranscriptPanel.tsx` / `LookupCard.tsx` / `VocabAccordion.tsx` 加 `data-testid`

---

## 六、运行约定

- `npm test`：仍只跑现有 node --test（快）
- `npm run test:e2e`：跑 Playwright（慢，需要 dev server 起着）
- CI（INFRA-004）会分两步：先 node --test，再 e2e

---

## 七、验收（Codex2 用）

1. `npm test` 通过（不变）
2. `npm run seed:e2e` 成功
3. `npm run dev` 启动后，`npx playwright test` 3 个 spec 全过
4. 故意改 LookupCard 删掉"加入我的词库"按钮，E2E-2 红
5. `npm run build` 通过

---

## 八、不在本 ticket 范围内

- 视觉回归（Percy / Chromatic）
- 移动端 E2E（responsive 单独验）
- 并发用户负载测试
- 翻译/字幕等外部 API 真实联调（mock 或用稳定测试视频）

---

## 注意事项

- 不要在 E2E 里硬编码视频标题（YouTube 标题可能改），用结构化选择器
- transcript 加载有 ~3-10s 不确定性，统一用 `toBeVisible({ timeout: 15_000 })`
- LookupCard 调用 GLM-5 真实 API，跑得慢且消耗 quota——CI 上限制并发，或考虑 mock `/api/vocab/lookup`
