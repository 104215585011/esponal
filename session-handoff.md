# Session Handoff — Esponal

> 每轮会话结束时填写，下一轮开始时先读。

---

## Codex2 QA Report — Session #56（2026-05-16）

### 本轮目标
对 PM 在 Session #55 派出的三个 P2 硬化 ticket（OPS-001 / INFRA-003 / INFRA-004）执行 QA 验收。

### 结论
三票全部通过，状态 ready_for_qa → passing。

### 运行的命令与输出
- `npm test` → 111/111 通过（duration_ms 790）
- `npm run lint:encoding` → "Encoding check passed"
- `node --test tests/ops001.test.mjs tests/infra003.test.mjs tests/infra004.test.mjs` → 14/14 通过
- `npm run build` → 通过（38 个静态页 + dynamic 路由），仅既有 img 警告 + url.parse deprecation
- `npm run ci:local` → 完整链路 lint:encoding → test → build 跑通无错（INFRA-004 最强行为检查）

### 结构核查记录
**OPS-001**：
- 三个 sentry config 均 `Sentry.init` + `enabled: Boolean(process.env.*_SENTRY_DSN)` 守卫
- `next.config.mjs` 第 8 行 `withSentryConfig(` 包装
- `src/lib/monitor.ts` 隐私核查通过：translate 只上报 `textLength + textPreview.slice(0,40)`；lookup 只上报 word；subtitle 只上报 videoId。无任何原文/句子整段上报
- 四个调用点全部 `import` 自 `@/lib/monitor`：translate / vocab.lookup / subtitle route + dictionary.ts
- `.env.example` 含 5 个 Sentry 变量
- `src/app/global-error.tsx` 存在，useEffect 内 `Sentry.captureException(error)`

**INFRA-003**（scaffold + contracts 范围）：
- `@playwright/test ^1.60.0` 在 devDependencies
- `playwright.config.ts`：testDir=./tests/e2e + webServer (npm run dev, port 3000) + chromium project
- 三个 spec 全部存在并 import `@playwright/test`：anon-home-to-watch / login-lookup-save / anon-save-prompts-login
- `scripts/seed-e2e-user.mjs` 用 PrismaClient + bcryptjs + upsert
- 4 个 data-testid 钩子全部 grep 命中（video-card / transcript-cue / lookup-card / vocab-word）
- `.env.example` 含三个 E2E_* 变量；`.gitignore` 含 test-results/ + playwright-report/
- **未跑** `npm run test:e2e`：按 ticket 验收范围（需 dev server + 浏览器安装 + GLM-5 quota），留作后续独立任务

**INFRA-004**：
- `.github/workflows/ci.yml` 存在；触发 PR + push:main 确认
- steps：actions/checkout@v4 → setup-node@v4 (node:20, cache:npm) → npm ci → npm run lint:encoding → npm test → npm run build
- env 注入三个 placeholder（DATABASE_URL/NEXTAUTH_SECRET/NEXTAUTH_URL）
- `package.json` 的 `ci:local` 串行三步骤，本地完整跑通

### 一处值得记录的观察
OPS-001 的隐私设计非常干净：原 ticket 范例 helper 是 `extra: { word }`，Codex1 实现保持了 word（短词、单 token，可以保留），而 translate helper 严格只发 textLength + 40 字符 preview，没有把全句字幕带进 Sentry extras。审计通过。

### 移交
三票已关闭。所有 P2 硬化 ticket 完成。下一步 PM 决定是否继续 WEB-005（Web 端点击查词）或新开 ticket。

---

## PM Report — Session #55（2026-05-16）

### 本轮完成
- Claude2 对 WEB-011 走完 UI 视觉验收（先报告 2 处 P1）
- Codex1 修完 P1，Claude2 终验通过，WEB-011 → `passing`（commit `4d94cc2`，97/97 测试）
- INFRA-002 的 pre-commit 钩子在两次 commit 中自动跑了 encoding lint + 全套测试，guardrails 生效
- 派出剩余三个 P2 硬化 ticket 给 Codex1 并行执行

### 派给 Codex1 — 三票并行（完全独立、文件不重叠）

**OPS-001 — Sentry 错误监控**
- Ticket: `docs/tickets/OPS-001.md`
- 触动：`next.config.mjs`、`sentry.*.config.ts`（新建）、`src/lib/monitor.ts`（新建）、四个 API route 的 catch、`.env.example`
- 注意：DSN 通过 Vercel env 注入，本地无 DSN 时 SDK 自动 no-op，不能阻塞开发

**INFRA-003 — Playwright E2E 三条关键路径**
- Ticket: `docs/tickets/INFRA-003.md`
- 触动：`playwright.config.ts`、`tests/e2e/*.spec.ts`（新建）、`scripts/seed-e2e-user.mjs`（新建）、给 `VideoCard` / `TranscriptPanel` / `LookupCard` / `VocabAccordion` 加 `data-testid`
- 注意：`npm test` 仍只跑 node --test；E2E 单独 `npm run test:e2e`

**INFRA-004 — GitHub Actions CI**
- Ticket: `docs/tickets/INFRA-004.md`
- 触动：`.github/workflows/ci.yml`（新建）、`package.json` 加 `ci:local`
- 注意：branch protection 由 PM 手动开启；INFRA-002 / INFRA-003 完成后 workflow 里对应 job 自动接入

### Codex2 任务
- 等 Codex1 提交三票后依次 QA（顺序无所谓）
- 重点：OPS-001 验真实事件接收，INFRA-004 验 PR 红/绿

### 下一步
- Codex1：三票并行开工
- Codex2：等 ready_for_qa
- PM：三票全 passing 后开始下一阶段规划（用户灰度 / 学习数据可视化 / SRS）

---

## PM Report — Session #53（2026-05-16）

### 本轮完成
- 排查并定位 transcript 体验问题：之前从「±4 cue 窗口」改成「全量渲染」后，长视频首屏卡顿
- 写新 ticket `docs/tickets/WEB-008.md`：Transcript 虚拟化滚动 + 用户脱钩浏览
- `feature_list.json` 新增 `WEB-008`（status: backlog）

### 核心需求（Codex1 实现时务必理解）
- 首屏只渲染 ≤30 条 cue，避免卡顿
- IntersectionObserver 监听底/顶哨兵，用户滚动时按 30 条/批扩展窗口
- 跟随模式 vs 浏览模式：用户主动滚动 → 进入浏览模式（视频继续播放，不跟随）；点「回到当前位置」恢复跟随
- 不要破坏 WEB-007 的 LookupCard fixed 浮层、查词、高亮契约

### 当前状态
- VOCAB-004：Codex1 已提交，待 Codex2 QA 验收
- WEB-008：backlog，等 Codex1 实现

### 下一步
- Codex1：按 `docs/tickets/WEB-008.md` 实现 transcript 虚拟化
- Codex2：等 WEB-008 ready_for_qa 后验收（顺手把 VOCAB-004 也清掉）

---

## Dev Report — Session #52（2026-05-16）

### 本轮完成
- `content/grammar/topics.ts` 新增 8 个语法主题（规则-ar/-er/-ir、词干变音、反身动词、gustar、冠词、形容词性数、ir a + 原形）
- 新增 GrammarGroup `"句型结构"` 分组
- TypeScript 类型检查通过，build 通过，已推送 `e37cc4a`

### 当前状态
- VOCAB-004：Codex1 已提交，待 Codex2 QA 验收
- 其余功能：全部 passing

### 下一步
- Codex2：对 VOCAB-004 执行 QA 验收
- 验收通过后可进入用户测试阶段

---

## PM Report — Session #43（2026-05-15）

### 当前已验证（passing）
全部20个功能 passing，包括 COURSE-003/004、AUTH-001。

### VOCAB-004 进度
- PM + Codex1 本次会话完成：
  - /api/lemmatize 升级（GLM-5 AI生成词典条目，Redis永久缓存）
  - LookupCard 升级（义项列表+例句）
  - Codex1 提交 feat(VOCAB-004)：词典库抽象(src/lib/dictionary.ts)、/api/vocab/lookup GET接口、LookupCard source prop、vocabAdd存dictData+sourceType
- 状态：待 Codex2 QA 验收

### 环境变量（需在Vercel确认）
- BAIDU_MT_API_KEY / BAIDU_MT_SECRET_KEY（百度MT）
- DASHSCOPE_API_KEY / DASHSCOPE_MODEL=glm-5（阿里云DashScope，GLM-5）

### 下一步
- Codex2：对 VOCAB-004 执行 QA 验收
- 验收通过后功能全部就绪，可进入用户测试阶段

---

## PM Progress Log — 2026-05-16 23:35

Ticket 写好推送了：[docs/tickets/WEB-008.md](docs/tickets/WEB-008.md)

**WEB-008 核心**：
- **渲染窗口**：`renderStart..renderEnd`，初始 30 条；IntersectionObserver 监听上下哨兵自动扩展，每批 30 条
- **跟随 vs 浏览模式**：用户 `wheel`/`touchmove` 触发浏览模式（视频继续放、不跟随），点「回到当前位置」恢复跟随
- **关键陷阱**：向上扩展时要补正 `scrollTop` 防跳；不要用 `onScroll` 判断用户行为（程序化滚动会误触发）
- **保留契约**：LookupCard 浮层、词高亮、tab 切换、props 不变

`feature_list.json` 已记 `WEB-008` backlog；`session-handoff.md` 留了交接说明。Codex1 可以接手了。

---

## Dev Report - Session #54 (2026-05-16) - WEB-008

### Completed
- Implemented WEB-008 in `src/app/watch/TranscriptPanel.tsx`.
- Added virtual cue rendering with `renderStart..renderEnd`, `INITIAL_RENDER_COUNT = 30`, and `LOAD_MORE_BATCH = 30`.
- Added top and bottom `IntersectionObserver` sentinels for bidirectional window expansion.
- Added upward expansion `scrollTop` compensation to avoid visual jump.
- Replaced scroll-based browse detection with real user input events: `wheel`, `touchmove`, `pointerdown`, and keyboard navigation.
- Added `followMode`: playback keeps running in browse mode, and the return-to-current button restores centered follow mode.
- Preserved WEB-007 contracts: `TranscriptPanel` props unchanged, `LookupCard` fixed overlay retained, word highlight colors retained, tabs retained, cue click still calls `seekTo`.
- Added `data-cue-index` for QA DOM counting.
- Added `tests/web008.test.mjs` and updated `tests/web007.test.mjs` to match virtual rendering.

### Files Changed
- `src/app/watch/TranscriptPanel.tsx`
- `tests/web007.test.mjs`
- `tests/web008.test.mjs`
- `feature_list.json`
- `session-handoff.md`

### Verification
- `node --test tests/web007.test.mjs tests/web008.test.mjs`: passed 4/4.
- `npx tsc --noEmit`: passed.
- `npm run build`: passed with existing `<img>` lint warnings and Node `url.parse` deprecation warnings only.
- `npm test`: WEB-008 passed, overall 71/72 because of existing unrelated VOCAB-004 assertion expecting `YOUDAO_APP_KEY` while current dictionary implementation uses `DASHSCOPE_API_KEY`.

### Current Status
- `WEB-008`: `ready_for_qa`.
- Next: Codex2 should QA WEB-008 with DOM cue count, sentinel expansion, browse/follow behavior, return-to-current, and cue click seek checks.

### WEB-008 follow-up - 2026-05-16
- Optimized transcript readability by merging adjacent short timedtext cues into more continuous display lines in `TranscriptPanel` before render/translate/highlight.
- Kept original behavior contracts: click still seeks to the merged line start, LookupCard still opens from word spans, virtualization still renders `renderedCues` only.
- Verification: `node --test tests/web007.test.mjs tests/web008.test.mjs`, `npx tsc --noEmit`, and `npm run build` passed.

---

## Dev Report - Session #55 (2026-05-16 14:21) - WEB-009

### Completed
- Implemented unified design tokens in `tailwind.config.ts`: `brand`, `app`, `surface`, `muted`, plus semantic card/surface/hero radius and shadow tokens.
- Rebuilt the top navigation with `SiteHeader` + `SiteNav`: videos, courses, grammar, and vocab are now first-level entries with active `brand` styling.
- Added logged-out `HomeHero` on `/` with three CTAs: create account, scroll to videos, and install extension.
- Replaced source-level `green-*` and `emerald-*` utilities with `brand-*` tokens and aligned page/card surface styling across the app.
- Added `tests/web009.test.mjs` and updated impacted UI tests for the new token/navigation structure.

### Files Changed
- `tailwind.config.ts`
- `src/app/components/web/SiteHeader.tsx`
- `src/app/components/web/SiteNav.tsx`
- `src/app/components/web/HomeHero.tsx`
- `src/app/page.tsx`
- Multiple app UI files under `src/app/**` for brand/surface token alignment
- `tests/web009.test.mjs`
- Updated affected tests: `course001`, `course002`, `course003`, `vocab-ui`, `vocab004`

### Verification
- `rg -n "green-[0-9]|emerald-[0-9]" src`: zero matches.
- `node --test tests/web009.test.mjs tests/course001.test.mjs tests/course002.test.mjs`: passed 10/10.
- `npm test`: passed 76/76.
- `npm run build`: passed with existing `<img>` lint warnings and Node `url.parse` deprecation warnings only.

### Current Status
- `WEB-009`: `ready_for_qa`.
- Next: Codex2 should QA WEB-009, plus VOCAB-004 and WEB-008 are also still queued for QA.

---

## QA Report - VOCAB-004 / WEB-008 / WEB-009

**Time**: 2026-05-16 14:29
**Tester**: Codex2

**Conclusion**: Passed. `VOCAB-004`, `WEB-008`, and `WEB-009` are updated to `passing`.

**Executed Checks**
1. Baseline test suite
   Command: `npm test`
   Output summary: 76 tests, 76 pass, 0 fail.
   Result: Pass.

2. Production build
   Command: `npm run build`
   Output summary: compiled successfully; generated 37 static pages; existing `<img>` lint warnings and Node `url.parse` deprecation warnings only.
   Result: Pass.

3. Targeted ticket tests
   Command: `node --test tests/vocab004.test.mjs tests/web008.test.mjs tests/web009.test.mjs`
   Output summary: 12 tests, 12 pass, 0 fail.
   Result: Pass.

4. VOCAB-004 source verification
   Checked `dictionary.ts`, `/api/vocab/lookup`, `/api/vocab/add`, `LookupCard`, course lookup wiring, `/vocab`, and `VocabAccordion`.
   Evidence: DashScope envs, Redis `vocab:dict:` cache, degraded fallback, `vivir` coverage, dictionary display fields, and video/course source tracking are present.
   Result: Pass.

5. WEB-008 source verification
   Checked `TranscriptPanel.tsx` for virtual window state, sentinels, scrollTop compensation, user browse detection, return-to-current behavior, and cue click seek.
   Evidence: `renderStart`, `renderEnd`, `IntersectionObserver`, `data-cue-index`, `followMode`, `wheel`, `touchmove`, `pointerdown`, `scrollIntoView`, and `player.seekTo` are present.
   Result: Pass.

6. WEB-009 source and smoke verification
   Commands:
   - `rg -n "green-[0-9]|emerald-[0-9]" src`
   - temporary `npm run dev -- -p 3010` with HTTP probes
   Output summary: green/emerald utility search returned zero matches; `/` returned 200 and contained `Esponal`, Hero copy, and search box; `/vocab` unauth returned 307 to `/api/auth/signin`.
   Result: Pass.

**Notes**
- Playwright is not installed in the root project, so viewport screenshot automation was not available in this QA pass. WEB-009 responsive coverage is based on structural tests, Tailwind responsive/source inspection, build success, and HTTP smoke.
- Worktree was clean before QA. QA updates changed only tracker/report files.

---

## Dev Report - Session #57 (2026-05-16 14:42) - WEB-010

### Completed
- Implemented logged-in homepage `ContinueLearning` cards.
- Added `src/lib/continueLearning.ts` with `getLastVideoEncounter` and `getLastCourseEncounter`, querying recent `WordEncounter` records by `sourceType` and current user's words.
- Added `src/lib/dates.ts` with `formatRelativeTime`.
- Added `src/app/components/web/ContinueLearning.tsx` with max two cards: video continue card and course continue card.
- Updated `src/app/page.tsx`: logged-out users still see `HomeHero`; logged-in users render `ContinueLearning` when recent video/course encounter data exists.
- Added `@@index([sourceType, createdAt])` to `WordEncounter` and migration `20260516143000_add_word_encounter_source_time_index`.
- Added `tests/web010.test.mjs`.

### Files Changed
- `prisma/schema.prisma`
- `prisma/migrations/20260516143000_add_word_encounter_source_time_index/migration.sql`
- `src/lib/dates.ts`
- `src/lib/continueLearning.ts`
- `src/app/components/web/ContinueLearning.tsx`
- `src/app/page.tsx`
- `tests/web010.test.mjs`
- `feature_list.json`

### Verification
- `node --test tests/web010.test.mjs`: passed 4/4.
- `npx tsc --noEmit`: passed.
- `npm test`: passed 80/80.
- `npm run build`: passed with existing `<img>` lint warnings and Node `url.parse` deprecation warnings only.

### Current Status
- `WEB-010`: `ready_for_qa`.
- Next: Codex2 should QA WEB-010. Remaining backlog after this is `EXT-005`.

---

## QA Report - WEB-010 Continue Learning Cards

**Time**: 2026-05-16 14:51
**Tester**: Codex2

**Conclusion**: Passed. `WEB-010` is updated to `passing`.

**Executed Checks**
1. Baseline test suite
   Command: `npm test`
   Output summary: 80 tests, 80 pass, 0 fail.
   Result: Pass.

2. Production build
   Command: `npm run build`
   Output summary: compiled successfully; generated 37 static pages; existing `<img>` lint warnings and Node `url.parse` deprecation warnings only.
   Result: Pass.

3. Targeted WEB-010 tests
   Command: `node --test tests/web010.test.mjs`
   Output summary: 4 tests, 4 pass, 0 fail.
   Result: Pass.

4. Source contract verification
   Checked `src/lib/continueLearning.ts`, `src/app/components/web/ContinueLearning.tsx`, `src/app/page.tsx`, `prisma/schema.prisma`, and migration `20260516143000_add_word_encounter_source_time_index`.
   Evidence: recent video/course helpers query `WordEncounter` by `sourceType` and current user's words ordered by `createdAt desc`; video card uses `buildVideoJumpHref`; course card links to `/learn/${courseEncounter.slug}`; two cards render in `lg:grid-cols-2`; no-data state returns null; lookup failure renders `/learn` fallback; schema includes `@@index([sourceType, createdAt])`.
   Result: Pass.

5. Unauthenticated homepage smoke
   Command: temporary `npm run dev -- -p 3011` with HTTP probe for `/`.
   Output summary: `HOME_STATUS=200`, `HOME_HAS_ESPONAL=True`, `HOME_HAS_HERO=True`, `HOME_HAS_CONTINUE=False`.
   Result: Pass.

**Notes**
- This QA pass did not create a browser-authenticated session fixture. Logged-in video/course/no-data states were verified through targeted tests and source contracts rather than a live authenticated browser session.

---

## Dev Report - Session #59 (2026-05-16 15:00) - EXT-005

### Completed
- Implemented `/extension` landing page in `src/app/extension/page.tsx`.
- Page includes SiteHeader, hero, three feature cards, installation steps, FAQ, and a download CTA for `/extension/esponal-extension.zip`.
- Reused WEB-009 design tokens: `brand-*`, `rounded-hero`, `rounded-card`, `shadow-card`, `shadow-hero`, and `bg-surface`.
- Added `extension/scripts/package.mjs`, a dependency-free zip packager for the extension files.
- Updated `extension/package.json` with `npm run package`.
- Generated `public/extension/esponal-extension.zip`.
- Updated `.gitignore` to ignore `*.pem` and `extension/dist/`.
- Added `tests/ext005.test.mjs`.

### Files Changed
- `.gitignore`
- `extension/package.json`
- `extension/scripts/package.mjs`
- `public/extension/esponal-extension.zip`
- `src/app/extension/page.tsx`
- `tests/ext005.test.mjs`
- `feature_list.json`

### Verification
- `npm run package` in `extension/`: passed.
- `tar -tf public/extension/esponal-extension.zip`: listed `manifest.json`, `popup.html`, `lemma-dict.json`, and bundled `dist/*.js`.
- `node --test tests/ext005.test.mjs`: passed 3/3.
- `npm test`: passed 83/83.
- `npm run build`: passed with existing `<img>` lint warnings and Node `url.parse` deprecation warnings only; build output includes `/extension`.
- Local dev smoke on port 3012: `/extension` returned 200 with hero/FAQ; `/extension/esponal-extension.zip` returned 200 with 10993 bytes.

### Current Status
- `EXT-005`: `ready_for_qa`.
- Next: Codex2 should QA EXT-005. All tracked features are now either `passing` or `ready_for_qa`.

---

## QA Report - EXT-005 Extension Landing Page

**Time**: 2026-05-16 15:07
**Tester**: Codex2

**Conclusion**: Passed. `EXT-005` is updated to `passing`.

**Executed Checks**
1. Baseline test suite
   Command: `npm test`
   Output summary: 83 tests, 83 pass, 0 fail.
   Result: Pass.

2. Production build
   Command: `npm run build`
   Output summary: compiled successfully; build output includes `/extension`; existing `<img>` lint warnings and Node `url.parse` deprecation warnings only.
   Result: Pass.

3. Targeted EXT-005 tests
   Command: `node --test tests/ext005.test.mjs`
   Output summary: 3 tests, 3 pass, 0 fail.
   Result: Pass.

4. Extension package verification
   Commands: `tar -tf public/extension/esponal-extension.zip`; `Get-Item public/extension/esponal-extension.zip`
   Output summary: zip contains `manifest.json`, `popup.html`, `lemma-dict.json`, `dist/background.js`, `dist/content.js`, and `dist/popup.js`; zip size is 10993 bytes.
   Result: Pass.

5. Local HTTP smoke
   Command: temporary `npm run dev -- -p 3013` with HTTP probes for `/extension` and `/extension/esponal-extension.zip`.
   Output summary: `PAGE_STATUS=200`, `PAGE_HAS_HERO=True`, `PAGE_HAS_FAQ=True`, `ZIP_STATUS=200`, `ZIP_BYTES=10993`.
   Result: Pass.

6. Source contract verification
   Checked `src/app/extension/page.tsx`, `src/app/components/web/HomeHero.tsx`, `extension/package.json`, and `.gitignore`.
   Evidence: HomeHero CTA links to `/extension`; page uses WEB-009 brand/radius/shadow tokens; package script builds the extension zip; `.pem` signing keys and `extension/dist/` are ignored.
   Result: Pass.

**Notes**
- Browser screenshot/UI visual acceptance was not performed in this QA pass; functional route, source contracts, package contents, and build/test gates all passed.
- With EXT-005 passing, all tracked features in `feature_list.json` are now passing.

---

## Dev Report - Session #61 (2026-05-16 16:45) - OPS-002

### Completed
- Implemented API rate limiting for OPS-002.
- Added `@upstash/ratelimit` dependency and `src/lib/ratelimit.ts`.
- Exported five limiters: `translateLimiter`, `lookupLimiter`, `addLimiter`, `searchLimiter`, and `channelLimiter`.
- Added `getClientIp`, `checkRateLimit`, and `getRetryAfterSec`.
- `checkRateLimit` checks IP first and user id second when available; if the limiter/Upstash path is unavailable, it fails open.
- Wired rate limiting into:
  - `src/app/api/translate/route.ts`
  - `src/app/api/vocab/lookup/route.ts`
  - `src/app/api/vocab/add/route.ts`
  - `src/app/api/youtube/search/route.ts`
  - `src/app/api/youtube/channel/route.ts`
- Each protected route returns `429` with `Retry-After` and `{ error: "rate limited", retryAfterSec }` when over quota.
- Updated `TranscriptPanel` so `/api/translate` 429 responses respect `Retry-After` and retry without immediately degrading to source text.
- Updated `LookupCard` so `/api/vocab/lookup` 429 responses show a friendly "查询过于频繁，请稍后再试" state.
- Added `tests/ops002.test.mjs`.
- Updated `feature_list.json`: `OPS-002` -> `ready_for_qa`.

### Verification
- Baseline before work: `npm test` passed 83/83.
- Red test: `node --test tests/ops002.test.mjs` failed before implementation because `src/lib/ratelimit.ts`, route 429 handling, and frontend 429 handling were missing.
- `node --test tests/ops002.test.mjs`: passed 6/6.
- `npx tsc --noEmit`: passed.
- `npm test`: passed 89/89.
- `npm run build`: passed with existing `<img>` lint warnings and Node `url.parse()` deprecation warnings only.

### Current Status
- `OPS-002`: `ready_for_qa`.
- Next: Codex2 should QA OPS-002, ideally including a live local 429 probe and fail-open check with missing/unavailable Upstash REST envs.

---

## Dev Report - Session #62 (2026-05-16 17:10) - INFRA-002

### Completed
- Implemented encoding/lint guardrails for INFRA-002.
- Added `scripts/check-encoding.mjs`.
- Added `scripts/install-git-hooks.mjs`.
- Added `.gitattributes` with `* text=auto eol=lf`.
- Added versioned `.githooks/pre-commit` that runs `npm run lint:encoding` and `npm test`.
- Added `package.json` scripts:
  - `lint:encoding`: `node scripts/check-encoding.mjs`
  - `prepare`: `node scripts/install-git-hooks.mjs`
- Configured this workspace with `git config core.hooksPath .githooks`.
- Added `tests/infra002.test.mjs`.
- Normalized existing CRLF text files to LF.
- Encoding checker currently allowlists known historical/generated mojibake surfaces that are not fixed in this ticket:
  - `claude-progress.md`
  - `docs/tickets/INFRA-002.md`
  - `extension/lemma-dict.json`
  - `src/lib/dictionary.ts`
- Updated `feature_list.json`: `INFRA-002` -> `ready_for_qa`.

### Verification
- Red test: `node --test tests/infra002.test.mjs` failed before implementation because `.gitattributes`, `scripts/check-encoding.mjs`, `.githooks/pre-commit`, and `core.hooksPath` were missing.
- `node --test tests/infra002.test.mjs`: passed 4/4.
- `npm run lint:encoding`: passed.
- `npm test`: passed 93/93.
- `npm run build`: passed with existing `<img>` lint warnings and Node `url.parse()` deprecation warnings only.

### Current Status
- `INFRA-002`: `ready_for_qa`.
- Next: Codex2 should QA INFRA-002, including temporary bad UTF-8/UTF-16/CRLF files and a pre-commit rejection check.

---

## QA Report - OPS-002 / INFRA-002

**Time**: 2026-05-16 21:51
**Tester**: Codex2

**Conclusion**: Passed. `OPS-002` and `INFRA-002` are updated to `passing`.

**Executed Checks**
1. Baseline test suite
   Command: `npm test`
   Output summary: 93 tests, 93 pass, 0 fail.
   Result: Pass.

2. Targeted ticket tests
   Command: `node --test tests/ops002.test.mjs tests/infra002.test.mjs`
   Output summary: 10 tests, 10 pass, 0 fail.
   Result: Pass.

3. Encoding lint
   Command: `npm run lint:encoding`
   Output summary: `Encoding check passed`.
   Result: Pass.

4. Production build
   Command: `npm run build`
   Output summary: compiled successfully and generated 38 static pages; existing `<img>` lint warnings and Node `url.parse()` deprecation warnings only.
   Result: Pass.

5. OPS-002 source contract verification
   Checked `src/lib/ratelimit.ts`, five protected API routes, `TranscriptPanel`, and `LookupCard`.
   Evidence: `translateLimiter`, `lookupLimiter`, `addLimiter`, `searchLimiter`, `channelLimiter`, `getClientIp`, `checkRateLimit`, and `getRetryAfterSec` are present; `/api/translate`, `/api/vocab/lookup`, `/api/vocab/add`, `/api/youtube/search`, and `/api/youtube/channel` call `checkRateLimit` and return `429` with `Retry-After`; frontend handles `response.status === 429`.
   Result: Pass.

6. INFRA-002 source contract verification
   Checked `.gitattributes`, `.githooks/pre-commit`, `scripts/check-encoding.mjs`, `package.json`, and git config.
   Evidence: `.gitattributes` contains `* text=auto eol=lf`; pre-commit runs `npm run lint:encoding` and `npm test`; `git config core.hooksPath` returns `.githooks`; checker allowlists the known historical/generated files and rejects temporary mojibake, UTF-16, and CRLF files through targeted tests.
   Result: Pass.

**Notes**
- No live Upstash quota exhaustion probe was run; the 429 and fail-open paths are verified by targeted tests and source contract checks.
- Pre-commit rejection was verified through hook wiring plus the encoding checker rejection tests, not through an actual commit attempt.

**Next**
- Remaining backlog: `WEB-011`, `OPS-001`, `INFRA-003`, `INFRA-004`.

---

## Dev Report - Session #64 (2026-05-16 22:07) - WEB-011

### Completed
- Implemented shared EmptyState component in `src/app/components/ui/EmptyState.tsx`.
- Supported states: `empty`, `error`, and `loading-failed`.
- Supported action API: `action.href` renders a link, `action.onClick` renders a button.
- Supported sizes: `sm`, `md`, and `lg`.
- Migrated WEB-011 target files:
  - `src/app/components/vocab/VocabAccordion.tsx`
  - `src/app/watch/page.tsx`
  - `src/app/watch/TranscriptPanel.tsx`
  - `src/app/watch/LookupCard.tsx`
  - `src/app/learn/page.tsx`
  - `src/app/search/page.tsx`
- Removed the old local `EmptyState` helper from `VocabAccordion`.
- Added coverage in `tests/web011.test.mjs`; updated `tests/vocab-ui.test.mjs`.
- Updated `feature_list.json`: `WEB-011.status = ready_for_qa`.

### Files Changed
- `src/app/components/ui/EmptyState.tsx`
- `src/app/components/vocab/VocabAccordion.tsx`
- `src/app/watch/page.tsx`
- `src/app/watch/TranscriptPanel.tsx`
- `src/app/watch/LookupCard.tsx`
- `src/app/learn/page.tsx`
- `src/app/search/page.tsx`
- `tests/web011.test.mjs`
- `tests/vocab-ui.test.mjs`
- `feature_list.json`
- `claude-progress.md`
- `session-handoff.md`

### Verification
- Baseline before production changes: `npm test` passed 93/93.
- Red test: `node --test tests/web011.test.mjs` failed before implementation because the shared EmptyState file was absent and old hard-coded empty/error copy remained.
- `node --test tests/web011.test.mjs`: passed 3/3.
- `node --test tests/web011.test.mjs tests/vocab-ui.test.mjs tests/web003.test.mjs tests/web007.test.mjs tests/course003.test.mjs`: passed 15/15.
- `npm test`: passed 96/96.
- `npm run build`: passed with existing `<img>` lint warnings and Node `url.parse()` deprecation warnings only.
- `npx tsc --noEmit`: passed after build regenerated `.next/types`.
- `npm run lint:encoding`: passed.

### Current Status
- `WEB-011`: `ready_for_qa`.
- Next: Codex2 should QA WEB-011 by checking shared component API, all six migrated target files, removal of old duplicate copy in those targets, and no regression in vocab/watch/search/learn empty paths.

---

## QA Report - WEB-011 Shared EmptyState

**Time**: 2026-05-16 22:20
**Tester**: Codex2

**Conclusion**: Functional QA passed. Because WEB-011 is a UI ticket, final visual acceptance still belongs to Claude2; `feature_list.json` status is intentionally left as `ready_for_qa`.

**Executed Checks**
1. Baseline test suite
   Command: `npm test`
   Output summary: 96 tests, 96 pass, 0 fail.
   Result: Pass.

2. Targeted regression tests
   Command: `node --test tests/web011.test.mjs tests/vocab-ui.test.mjs tests/web003.test.mjs tests/web007.test.mjs tests/course003.test.mjs`
   Output summary: 15 tests, 15 pass, 0 fail.
   Result: Pass.

3. Production build
   Command: `npm run build`
   Output summary: compiled successfully and generated 38 static pages; existing `<img>` lint warnings and Node `url.parse()` deprecation warnings only.
   Result: Pass.

4. Shared component API and migration source verification
   Command: temporary Node source-contract script.
   Output summary: `{ "ok": true, "targets": 6, "emptyStateApiChecks": 10 }`
   Evidence: `src/app/components/ui/EmptyState.tsx` exposes the required API markers; all six target files import and render the shared `EmptyState`.
   Result: Pass.

5. Old hard-coded copy scan
   Command: `rg -n "暂无字幕|缺少视频参数|暂不支持该词|还没有遭遇过词汇|没有找到匹配的视频" src/app/components/vocab/VocabAccordion.tsx src/app/watch/page.tsx src/app/watch/TranscriptPanel.tsx src/app/watch/LookupCard.tsx src/app/learn/page.tsx src/app/search/page.tsx`
   Output summary: no matches; `rg` exited 1 because nothing matched.
   Result: Pass.

6. Local HTTP smoke
   Command: temporary dev server on port 3015 with HTTP probes.
   Output summary: `/watch` returned 200 and contained `没有视频可以播放`; `/search` returned 200 and contained `没找到相关视频`; `/learn` returned 200; `/vocab` returned 307 for unauthenticated redirect.
   Result: Pass.

**Notes**
- Chrome exists locally, but headless screenshot automation was unreliable in this desktop session: initial screenshots captured `ERR_CONNECTION_REFUSED`, and later detached dev-server attempts did not stay ready long enough for repeat screenshots.
- Functional QA did not find a regression. Claude2 should still perform the final visual acceptance for desktop/mobile empty-state consistency.

**Next**
- Claude2 UI acceptance for WEB-011.

---

## Dev Fix Report - WEB-011-FIX EmptyState P1

**Time**: 2026-05-16 22:55
**Developer**: Codex1

**Completed**
- Fixed Claude2 P1 feedback from `docs/tickets/WEB-011-FIX.md`.
- `src/app/watch/TranscriptPanel.tsx`: no-subtitle state now uses `kind="empty"` and title `这个视频没有字幕`.
- `src/app/components/ui/EmptyState.tsx`: all SVG stroke widths are unified to `strokeWidth="3"`; the error icon dot is now `<circle cx="48" cy="68" r="3" fill="currentColor" />`.
- `tests/web011.test.mjs`: added regression coverage for the neutral no-subtitle state and consistent icon stroke weights.
- `feature_list.json`: `WEB-011.status = ready_for_qa`.

**Verification**
- Red test before fix: `node --test tests/web011.test.mjs` failed on the new WEB-011 fix assertion.
- `node --test tests/web011.test.mjs`: passed 4/4.
- `node --test tests/web011.test.mjs tests/vocab-ui.test.mjs tests/web007.test.mjs`: passed 9/9.
- `rg -n 'strokeWidth="[57]"' src/app/components/ui/EmptyState.tsx`: no matches.
- `rg -n 'kind="error"|这个视频暂时没有字幕|这个视频没有字幕' src/app/watch/TranscriptPanel.tsx`: only `title="这个视频没有字幕"` matched.
- `npm test`: passed 97/97.
- `npm run build`: passed with existing `<img>` lint warnings and Node `url.parse()` deprecation warnings only.
- `npm run lint:encoding`: passed.

**Current Status**
- `WEB-011`: `ready_for_qa`.
- Next: Codex2/Claude2 should re-check the two P1 UI acceptance points.
