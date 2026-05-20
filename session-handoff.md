## Dev Report: VOCAB-008 saved-word underline
**Time**: 2026-05-20 15:14
**Developer**: Codex1

**Status**: Ready for QA. Implemented saved-word underline marking on Lectura and course pages.

**Changed files**:
- src/lib/vocab.ts
- src/app/api/vocab/highlight/route.ts
- src/app/lectura/LecturaReader.tsx
- src/app/learn/[slug]/CourseLookupText.tsx
- src/app/globals.css
- scripts/backfill-verb-forms.mjs
- package.json
- tests/vocab008.test.mjs
- feature_list.json
- claude-progress.md
- session-handoff.md

**Implementation notes**:
- Verb saves now merge lemma, incoming forms, and all tryConjugateVerb forms into Word.forms after lowercase normalization.
- GET /api/vocab/highlight returns { savedForms } for the current user and an empty list for guests, with private max-age=60 caching.
- LecturaReader and CourseLookupText load savedForms into a normalized savedSet and apply the shared .saved-word class while preserving LookupCard click behavior.
- Added an idempotent backfill script for existing verb entries plus npm run backfill:verb-forms.

**Verification executed**:
1. TDD red check: node --test tests/vocab008.test.mjs failed 6/6 before implementation.
2. Focused VOCAB-008 test: node --test tests/vocab008.test.mjs -> tests 6, pass 6, fail 0.
3. Regression chain: node --test tests/vocab005.test.mjs tests/vocab004.test.mjs tests/ext004.test.mjs tests/read001.test.mjs -> tests 19, pass 19, fail 0.
4. Encoding: npm run lint:encoding -> Encoding check passed.
5. Full suite: npm test -> tests 159, pass 159, fail 0.
6. Build: npm run build -> compiled successfully; only existing <img> and Sentry warnings.
7. Script syntax: node --check scripts/backfill-verb-forms.mjs -> pass.

**Remaining QA note**:
- npm run backfill:verb-forms starts correctly, but this local machine cannot open the Prisma DB TLS connection: 安全包中没有可用的凭证. Re-run the backfill in an environment with a working DATABASE_URL before production rollout.

---

## QA Report: VOCAB-007 AI lemmatizer
**Time**: 2026-05-20 13:33
**Tester**: Codex2

**Conclusion**: Passed. `VOCAB-007` is verified and marked `passing`.

**Verification executed**:
1. Encoding check
   Command: `npm run lint:encoding`
   Output: `Encoding check passed`
   Result: pass
2. VOCAB-007 focused tests
   Command: `node --test tests/vocab007.test.mjs`
   Output: `tests 5`, `pass 5`, `fail 0`
   Result: pass
3. Regression chain
   Command: `node --test tests/vocab007.test.mjs tests/vocab005.test.mjs tests/vocab004.test.mjs`
   Output: `tests 15`, `pass 15`, `fail 0`
   Result: pass
4. Full suite
   Command: `npm test`
   Output: `tests 153`, `pass 153`, `fail 0`
   Result: pass
5. Production build
   Command: `npm run build`
   Output: compiled successfully, generated 48 static pages, route table emitted
   Result: pass; warnings are existing `<img>` lint warnings and Sentry instrumentation warnings
6. TypeScript follow-up
   Command: `npx tsc --noEmit`
   Output: exit 0 after `npm run build` generated `.next/types`
   Result: pass

**Source contract checks**:
- Prompt contains `saw the word` and `Identify its lemma`, using the surface `word`.
- `RawAIEntry` contains `lemma?: string` and `morphInfo?: string`.
- AI lemma extraction uses `parsed.lemma`, a `typeof parsed.lemma === "string"` guard, and `hintLemma` fallback.
- Dictionary implementation uses `vocab:dict:v3:`; no implementation `v2` cache key remains.
- `lookupDictionary` has two `safeCacheGet` calls: one for `hintLemma`, one for `aiLemma`.
- Degraded path still uses lemma-dict translation and returns `degraded: true`.

**Behavior sampling**:
- Skipped live DashScope lookup because `DASHSCOPE_API_KEY` was not present in the shell environment. This is not counted as a failure because the ticket's required contract and regression checks passed.

**Handoff**:
- Updated `feature_list.json`: `VOCAB-007.status = passing` with evidence.
- No push performed; PM decides push timing.

---

# Session Handoff — Esponal

---

## PM Report — Session #63 (2026-05-20 09:30)

### 本轮完成
- 确认 VOCAB-005 状态残留 `ready_for_qa`（Codex2 QA 已于 2026-05-19 通过，但 feature_list.json 未更新）
- 修正：将 VOCAB-005 → `passing`（commit `577b990`）
- 总状态：**38 个功能全部 passing**，1 个 blocked（CONTENT-001）；`npm test` 143/143
- 写好下一阶段 ticket：**VOCAB-006 — SRS 词库复习（FSRS 变位卡）**

### VOCAB-006 核心要点（Codex1 开工必读）
- Ticket: `docs/tickets/VOCAB-006.md`
- 安装 `ts-fsrs`（MIT）：`npm install ts-fsrs`
- Prisma：Word 模型新增 8 个 SRS 字段（srsState/srsDue/srsStability/srsDifficulty/srsElapsedDays/srsScheduledDays/srsReps/srsLapses/srsLastReview）
- 新建 `src/lib/srs.ts`（initCard / scheduleCard 封装 ts-fsrs）
- 新建 `GET /api/vocab/review`（返回今日到期词，max 20）
- 新建 `POST /api/vocab/review/[wordId]`（提交评分，更新 SRS 字段）
- 新建 `/vocab/review/page.tsx`（翻牌式复习页：正面 lemma + 🔊，背面义项/例句/变位，四档评分，完成屏）
- 更新 `/vocab/page.tsx`：顶部加「N 词待复习」徽章（N=0 时不显示）
- TDD：先写 `tests/vocab006.test.mjs` 失败，再实现
- 不在本票范围：统计图、推送、参数设置

### 下一步
- **Codex1**：按 `docs/tickets/VOCAB-006.md` 实现 VOCAB-006
- **Codex2**：等 Codex1 提交 ready_for_qa 后验收
- **PM**：VOCAB-006 通过后考虑（a）学习数据看板 (b）更多 Lectura 故事 (c）语法练习

---

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
## Codex1 Dev Report - WEB-012 (2026-05-17 22:30)

### Goal
Use the user's local Whisper install at `C:\Users\10421\model` to reduce missing subtitles in the web player.

### Conclusion
Implemented local Whisper fallback for `/api/subtitle`. Status: `WEB-012` is `ready_for_qa`.

### What Changed
- Added `scripts/transcribe-whisper.py` to load the configured Whisper model and output JSON cues.
- Added `src/lib/localWhisper.ts` to call `yt-dlp`, cache downloaded YouTube audio under `.cache/whisper`, call the local Python Whisper script, and validate cue output.
- Updated `src/app/api/subtitle/route.ts`: Apify manual/ASR still runs first; local Whisper runs when Apify output is empty, very sparse, or has a large cue gap; `forceWhisper=1` bypasses Apify for manual testing; cache key bumped to `subtitle:v4:*`.
- Added `.env.example` documentation for `LOCAL_WHISPER_ENABLED`, `LOCAL_WHISPER_PYTHON`, `LOCAL_WHISPER_MODEL_PATH`, `LOCAL_WHISPER_CACHE_DIR`, and `YTDLP_PATH`.
- Updated local ignored `.env` to enable this machine's Whisper install:
  - `LOCAL_WHISPER_PYTHON=C:\Users\10421\model\.venv\Scripts\python.exe`
  - `LOCAL_WHISPER_MODEL_PATH=C:\Users\10421\model\models\whisper\large-v3-turbo.pt`
- Added `tests/web012-whisper.test.mjs`.
- Updated `feature_list.json` and `claude-progress.md`.

### Verification
- `node --test tests\web012-whisper.test.mjs` passed 3/3.
- `node --test tests\web004.test.mjs tests\web007.test.mjs tests\web012-whisper.test.mjs` passed 7/7.
- `npm run lint:encoding` passed.
- `npm test` passed 114/114.
- `npm run build` passed with existing `<img>` warnings, Sentry migration notices, and local Redis connection warnings only.
- Local Whisper smoke passed: `scripts/transcribe-whisper.py` transcribed `public\audio\units\unidad-1\hola.mp3` with `large-v3-turbo.pt` and returned JSON cues.

### Next
- Codex2 should QA `WEB-012`.
- If network access is available, run a live short-video check with `/api/subtitle?v=VIDEO_ID&lang=es&forceWhisper=1`.
- Do not commit `.env` or `.cache/whisper`.

---
## Codex1 Dev Report - WEB-012 Remote API Follow-up (2026-05-17 22:55)

### Goal
Make the local Whisper install usable by the Vercel deployment through a public HTTPS tunnel.

### Completed
- Added `scripts/local-whisper-api.py`, a Python stdlib `HTTPServer` wrapper around local Whisper.
- API endpoints:
  - `GET /health`
  - `POST /transcribe` with `{ "videoId": "...", "lang": "es" }`
  - optional `Authorization: Bearer <token>`.
- Updated `src/lib/localWhisper.ts` so `LOCAL_WHISPER_API_URL` is tried first. Direct local Python spawn remains available for local dev.
- Updated `.env.example` with `LOCAL_WHISPER_API_URL`, `LOCAL_WHISPER_API_TOKEN`, and `LOCAL_WHISPER_API_TIMEOUT_MS`.
- Updated `tests/web012-whisper.test.mjs`.

### How To Run For Vercel
1. Start the API on the user's PC:
   `C:\Users\10421\model\.venv\Scripts\python.exe scripts\local-whisper-api.py --host 127.0.0.1 --port 8017 --model C:\Users\10421\model\models\whisper\large-v3-turbo.pt --ytdlp C:\Users\10421\AppData\Local\Python\pythoncore-3.14-64\Scripts\yt-dlp.exe --token <token>`
2. Expose it with a tunnel:
   `cloudflared tunnel --url http://127.0.0.1:8017`
   or `ngrok http 8017`.
3. In Vercel env vars set:
   `LOCAL_WHISPER_ENABLED=1`
   `LOCAL_WHISPER_API_URL=https://<tunnel-host>`
   `LOCAL_WHISPER_API_TOKEN=<token>`
   `LOCAL_WHISPER_API_TIMEOUT_MS=900000`
4. Redeploy Vercel.

### Verification
- `node --test tests\web012-whisper.test.mjs` passed 3/3.
- `npm test` passed 114/114.
- `npm run build` passed with existing warnings only.
- `npm run lint:encoding` passed.
- `python scripts\local-whisper-api.py --help` printed CLI usage successfully.

---

## Codex1 Dev Report - EXT-006 Subtitle Harvester (2026-05-18 16:07)

### Goal
Implement the YouTube subtitle harvester plugin path: open a YouTube watch page without playback, collect Spanish caption json3 through the user's browser session, and write validated cues into Redis through `/api/subtitle/ingest`.

### Completed
- Added `extension/parseJson3.js`.
- Added `extension/harvest.js` with page-script bridge for `ytInitialPlayerResponse`, Spanish track selection, `credentials: "include"` subtitle fetch, ingest POST, and `chrome.storage.local` last-harvest metadata.
- Added `extension/scripts/build.mjs` and updated `extension/package.json` so package-time env injection works for `EXT_INGEST_TOKEN` and `ESPONAL_APP_ORIGIN`.
- Updated `extension/manifest.json` to register `dist/harvest.js` on YouTube watch pages.
- Updated `extension/popup.html` / `extension/popup.js` to show the latest harvest video id and timestamp.
- Updated `extension/scripts/package.mjs` so the extension zip includes source files plus `dist/harvest.js`.
- Added `src/app/api/subtitle/ingest/route.ts`: token auth, rate limit, 500KB payload cap, cue count/shape validation, write-once cache behavior, and 30-day Redis TTL.
- Added `ingestLimiter` to `src/lib/ratelimit.ts`.
- Updated `.env.example` with `EXT_INGEST_TOKEN` and `ESPONAL_APP_ORIGIN`.
- Added `tests/ext006.test.mjs`; updated `tests/extension.test.mjs`.
- Updated `feature_list.json`: `EXT-006.status = ready_for_qa`.

### Verification
- Baseline before work: `npm test` passed 114/114.
- Red test before implementation: `node --test tests\ext006.test.mjs` failed 5/5 for missing EXT-006 surfaces.
- `node --test tests\ext006.test.mjs`: passed 5/5.
- `node --test tests\extension.test.mjs tests\ext005.test.mjs tests\ext006.test.mjs`: passed 12/12.
- `npm run build` in `extension/`: passed.
- `npm run package` in `extension/`: passed after filesystem approval; zip now contains `dist/harvest.js`.
- `npm test`: passed 119/119.
- `npm run lint:encoding`: passed.
- `npm run build`: passed; only existing `<img>` warnings and Sentry migration warnings remain.

### Current Status
- `EXT-006`: `ready_for_qa`.
- Codex2 should QA the route contracts and run the live harvester scenario when a shared token and browser extension test setup are available.

---

## Codex1 Dev Report - EXT-007 Token Removal + Harvest Automation (2026-05-18 16:28)

### Goal
Remove the public ingest token from EXT-006 and add a Playwright bootstrap command so PM can batch-open YouTube videos in a persistent Chrome profile and trigger subtitle harvest automatically.

### Completed
- Removed token auth from `src/app/api/subtitle/ingest/route.ts`.
- Removed token header from `extension/harvest.js`.
- Removed token define from `extension/scripts/build.mjs`.
- Removed `EXT_INGEST_TOKEN` from `.env.example`.
- Added `scripts/bootstrap-harvest.mjs`.
- Added root `npm run harvest`.
- Added `.cache/harvest-chrome-profile/` to `.gitignore`.
- Updated `tests/ext006.test.mjs` and added `tests/ext007.test.mjs`.
- Rebuilt/repackaged `public/extension/esponal-extension.zip`.
- Updated `feature_list.json`: `EXT-007.status = ready_for_qa`.

### Bootstrap Script Behavior
- Uses `chromium.launchPersistentContext` with `headless: false`.
- Loads `extension/dist` with `--disable-extensions-except` and `--load-extension`.
- Stores YouTube cookies in `.cache/harvest-chrome-profile`.
- Supports `--channels=all`, `--channel=CHANNEL_ID`, `--videos=a,b,c`, and `--videos-from-file=path`.
- Uses the local app origin `/api/youtube/channel` to resolve channel videos; override with `--app-origin=...` if needed.
- Writes failed ids to `.cache/harvest-failures.log`.

### Verification
- Baseline before work: `npm test` passed 119/119.
- Red test before implementation: `node --test tests\ext006.test.mjs tests\ext007.test.mjs` failed on token remnants and missing script.
- `node --test tests\ext006.test.mjs tests\ext007.test.mjs`: passed 9/9.
- `rg -n "EXT_INGEST_TOKEN|X-Esponal-Ingest-Token" src extension tests`: zero matches.
- `npm run build` in `extension/`: passed.
- `npm run package` in `extension/`: passed; zip contains `dist/harvest.js`.
- `node scripts\bootstrap-harvest.mjs`: no-arg guard ran and exited with usage.
- `npm test`: passed 123/123.
- `npm run lint:encoding`: passed.
- `npm run build`: passed with existing `<img>` and Sentry migration warnings only.

### Current Status
- `EXT-007`: `ready_for_qa`.
- Behavior-layer harvest still needs PM/manual verification with a real YouTube login session.

---

## Codex1 -> Codex2 / PM Handoff (2026-05-19 10:28)

**Feature**: `READ-001-FIX`
**Status**: `ready_for_qa`

### What Changed
- Updated [src/app/lectura/page.tsx](C:/Users/wang/esponal/src/app/lectura/page.tsx) to `export const dynamic = "force-dynamic"`.
- Updated [src/app/lectura/[slug]/page.tsx](C:/Users/wang/esponal/src/app/lectura/[slug]/page.tsx) to `export const dynamic = "force-dynamic"`.
- Added four regression assertions in [tests/read001.test.mjs](C:/Users/wang/esponal/tests/read001.test.mjs) to require `force-dynamic` and reject `force-static` on both Lectura pages.
- Updated `feature_list.json` and `claude-progress.md` with fix evidence.

### Why
- `SiteHeader` calls `getServerSession(getAuthOptions())`.
- With `force-static`, the Lectura pages were pre-rendered at build time and never had request cookies, so logged-in users on Vercel were rendered as guests.
- `force-dynamic` restores per-request session reading while keeping the rest of the page logic unchanged.

### Verification
- Red test: `node --test tests/read001.test.mjs` failed 2/7 before the code fix because both pages still declared `force-static`.
- Green test: `node --test tests/read001.test.mjs` passed 7/7 after the fix.
- Full suite: `npm test` passed 121/121.
- Production build: `npm run build` passed; Next build output now shows both `/lectura` and `/lectura/[slug]` as `? (Dynamic)`.
- Existing unrelated warnings remain: `<img>` lint warnings and Sentry instrumentation migration warnings.

### QA Ask
- Codex2: verify the regression contract and confirm the two Lectura pages stay `force-dynamic`.
- PM: on Vercel, log in and open `/lectura`; expected result is avatar at top-right and vocab nav going directly to `/vocab` instead of the sign-in redirect.

### PM Update
- PM has completed the Vercel acceptance check and approved `READ-001-FIX`.
- Codex2 can use that acceptance result to finish QA and flip the ticket to `passing` after updating project records.

## Codex1 -> Codex2 / PM Handoff (2026-05-19 11:02)

**Feature**: `WEB-013`
**Status**: `ready_for_qa`

### What Changed
- Added [MobileNav.tsx](C:/Users/wang/esponal/src/app/components/web/MobileNav.tsx) for small-screen navigation.
- Updated [SiteNav.tsx](C:/Users/wang/esponal/src/app/components/web/SiteNav.tsx) to render desktop nav as `hidden lg:flex` and a `lg:hidden` mobile branch.
- Updated [SiteHeader.tsx](C:/Users/wang/esponal/src/app/components/web/SiteHeader.tsx) so the desktop search form is hidden below `lg`.
- Added [tests/web013.test.mjs](C:/Users/wang/esponal/tests/web013.test.mjs).
- Updated `feature_list.json` and `claude-progress.md`.

### Behavior
- On `< lg`, the header now exposes a hamburger button instead of relying on the desktop nav.
- Opening the drawer locks body scroll, clicking the overlay closes it, pressing `Escape` closes it, and clicking a nav link closes it.
- Active menu items still use `text-brand-600`.
- Desktop nav behavior remains unchanged.

### Verification
- Red test: `node --test tests/web013.test.mjs` failed 3/3 before implementation.
- Green tests: `node --test tests/web013.test.mjs tests/web009.test.mjs` passed 7/7.
- Full suite: `npm test` passed 124/124.
- Build: `npm run build` passed; only existing `<img>` warnings and existing Sentry instrumentation warnings remain.

### QA Ask
- Codex2: verify the contract and, if possible, do a quick viewport smoke at 1280px / 768px / 375px.
- PM: after QA, the next ticket on this mobile line is `PWA-001`.

## Codex1 -> Codex2 / PM Handoff (2026-05-19 11:34)

**Feature**: `PWA-001`
**Status**: `ready_for_qa`

### What Changed
- Added [public/manifest.webmanifest](C:/Users/wang/esponal/public/manifest.webmanifest).
- Added four generated app icons in [public/icons](C:/Users/wang/esponal/public/icons).
- Added [src/app/components/web/ServiceWorkerRegister.tsx](C:/Users/wang/esponal/src/app/components/web/ServiceWorkerRegister.tsx) and [public/sw.js](C:/Users/wang/esponal/public/sw.js), with [src/sw.ts](C:/Users/wang/esponal/src/sw.ts) as the source copy.
- Added [src/app/components/web/InstallPrompt.tsx](C:/Users/wang/esponal/src/app/components/web/InstallPrompt.tsx) and mounted it from [HomeHero.tsx](C:/Users/wang/esponal/src/app/components/web/HomeHero.tsx).
- Added [src/app/offline/page.tsx](C:/Users/wang/esponal/src/app/offline/page.tsx).
- Added [scripts/generate-icons.mjs](C:/Users/wang/esponal/scripts/generate-icons.mjs).
- Updated [src/app/layout.tsx](C:/Users/wang/esponal/src/app/layout.tsx) with manifest metadata, Apple web app metadata, and `viewport.themeColor`.
- Updated `feature_list.json` and `claude-progress.md`.

### Behavior
- Supported mobile browsers can now see install metadata and an in-app install entry point when `beforeinstallprompt` is available.
- The service worker precaches the shell, caches visited navigations for offline reopen, serves a dedicated `/offline` fallback when navigation misses the cache, and keeps auth/vocab APIs network-only.
- The temporary icon set is green-square + white `E`, generated locally and ready to be replaced by final brand assets later.

### Verification
- Red test: `node --test tests/pwa001.test.mjs` failed 5/5 before implementation.
- Green tests: `node --test tests/pwa001.test.mjs` passed 5/5; `node --test tests/pwa001.test.mjs tests/web013.test.mjs tests/web009.test.mjs` passed 12/12.
- Full suite: `npm test` passed 129/129.
- Encoding: `npm run lint:encoding` passed.
- Build: `npm run build` passed and now includes `/offline`.
- Existing unrelated warnings remain: `<img>` lint warnings and Sentry instrumentation migration warnings.

### QA Ask
- Codex2: verify manifest/service-worker/install-prompt contracts from source and file outputs.
- PM: mobile acceptance should cover installability, standalone launch, icon appearance, and offline reopening of a previously visited Lectura page.

---

## Codex2 QA Report - WEB-013 / PWA-001

**Time**: 2026-05-19 12:10
**Tester**: Codex2

**Conclusion**: Passed. `WEB-013` and `PWA-001` are updated to `passing` in `feature_list.json`.

### Executed Checks
1. Targeted ticket tests
   Command: `node --test tests/web013.test.mjs tests/pwa001.test.mjs tests/web009.test.mjs`
   Output summary: 12 tests, 12 pass, 0 fail.
   Result: Pass.

2. Full baseline suite
   Command: `npm test`
   Output summary: 129 tests, 129 pass, 0 fail.
   Result: Pass.

3. Encoding guard
   Command: `npm run lint:encoding`
   Output summary: `Encoding check passed`.
   Result: Pass.

4. Production build
   Command: `npm run build`
   Output summary: compiled successfully; generated 45 static pages and listed `/offline`; only existing `<img>` warnings and existing Sentry instrumentation migration warnings.
   Result: Pass.

5. WEB-013 source contract verification
   Method: source review plus Node REPL contract script.
   Evidence: `MobileNav.tsx` starts with `"use client"`; contains five entries (`/`, `/learn`, `/lectura`, `/grammar`, auth-aware vocab); Escape closes via `document.addEventListener("keydown")`; body scroll locks with `document.body.style.overflow = "hidden"` and restores on cleanup; overlay/link close paths call `setOpen(false)`; `SiteNav.tsx` contains desktop `hidden lg:flex` and mobile `lg:hidden`; `SiteHeader.tsx` search form is `hidden lg:flex`.
   Result: Pass.

6. PWA-001 source/file contract verification
   Method: source/file review plus Node REPL contract script.
   Evidence: `public/manifest.webmanifest` parses as JSON and includes required install fields; four manifest icons exist and are all >1KB (`1129`, `4792`, `1039`, `5133` bytes); `ServiceWorkerRegister.tsx` registers `/sw.js`; `public/sw.js` and `src/sw.ts` exist; `/offline` page exists; `InstallPrompt.tsx` listens for `beforeinstallprompt`, calls `preventDefault()`, and invokes `event.prompt()`; `HomeHero.tsx` mounts `InstallPrompt`; `layout.tsx` exports manifest, viewport `themeColor`, Apple web app metadata, and mounts `ServiceWorkerRegister`.
   Result: Pass.

### Warnings / Risk Notes
- Build warnings are not introduced by this round: existing `<img>` lint warnings remain in `SiteHeader` and `learn/[slug]`; existing Sentry instrumentation migration warnings remain.
- `npm test` still prints existing Node `MODULE_TYPELESS_PACKAGE_JSON` warnings for TS/ESM test imports; not related to WEB-013/PWA-001.
- PM real-device acceptance remains valuable for PWA behavior that cannot be fully proven by contract tests: Android installability, Lighthouse PWA score, standalone launch, icon appearance, and offline reopening of a previously visited Lectura page.

### Handoff
- No blockers found for contract QA.
- Next best action: PM mobile device acceptance for install/offline behavior.

## Codex1 -> Codex2 / PM Handoff (2026-05-19 11:33)

**Feature**: `AUDIO-001`
**Status**: `ready_for_qa`

### What Changed
- Added [generate-lectura-audio.mjs](C:/Users/wang/esponal/scripts/generate-lectura-audio.mjs) and root `npm run audio:lectura`.
- Generated 35 MP3 files in [public/audio/lectura](C:/Users/wang/esponal/public/audio/lectura).
- Added [speak.ts](C:/Users/wang/esponal/src/lib/speak.ts) for browser Web Speech pronunciation.
- Updated [LecturaReader.tsx](C:/Users/wang/esponal/src/app/lectura/LecturaReader.tsx) with per-paragraph playback, one-active-audio behavior, and active paragraph highlight.
- Updated [LookupCard.tsx](C:/Users/wang/esponal/src/app/watch/LookupCard.tsx) with lemma and example sentence speech buttons.
- Updated [src/sw.ts](C:/Users/wang/esponal/src/sw.ts) and [public/sw.js](C:/Users/wang/esponal/public/sw.js) to cache `/audio/lectura/*.mp3`.
- Added [audio001.test.mjs](C:/Users/wang/esponal/tests/audio001.test.mjs).
- Updated `feature_list.json`: `AUDIO-001` -> `ready_for_qa`.

### Verification
- Baseline before work: `npm test` passed 129/129.
- Red test: `node --test tests/audio001.test.mjs` failed 5/5 before implementation.
- Audio generation: `npm run audio:lectura` generated 35 MP3 files; minimum size is 23040 bytes.
- Targeted tests: `node --test tests/audio001.test.mjs tests/read001.test.mjs tests/vocab004.test.mjs tests/web005.test.mjs tests/pwa001.test.mjs` passed 25/25.
- Full suite: `npm test` passed 134/134.
- Encoding: `npm run lint:encoding` passed.
- Build: `npm run build` passed; existing unrelated `<img>` and Sentry warnings remain.

### QA Ask
- Codex2: verify source/file contracts and audio file count/size.
- Browser smoke: open `/lectura/la-tortuga-y-la-liebre`, click two paragraph audio buttons and confirm the second stops/replaces the first; open a LookupCard and confirm pronunciation buttons appear on a browser with Spanish Web Speech voices.
- PM/device smoke: after deployment and PWA install, revisit a cached Lectura page in airplane mode and confirm paragraph audio still plays.

## Codex1 -> Codex2 / PM Handoff (2026-05-19 14:03)

**Feature**: `AUDIO-002`
**Status**: `ready_for_qa`

### What Changed
- Added [route.ts](C:/Users/wang/esponal/src/app/api/tts/route.ts) for `/api/tts`.
- Rewrote [speak.ts](C:/Users/wang/esponal/src/lib/speak.ts) so LookupCard audio always plays `/api/tts?text=...` through `new Audio`.
- Added dedicated `ttsLimiter` in [ratelimit.ts](C:/Users/wang/esponal/src/lib/ratelimit.ts).
- Updated [src/sw.ts](C:/Users/wang/esponal/src/sw.ts) and [public/sw.js](C:/Users/wang/esponal/public/sw.js) to cache `/api/tts?text=` responses.
- Added [audio002.test.mjs](C:/Users/wang/esponal/tests/audio002.test.mjs).
- Adjusted [audio001.test.mjs](C:/Users/wang/esponal/tests/audio001.test.mjs) so AUDIO-002 can replace Web Speech internals while preserving the LookupCard call contract.
- Updated `feature_list.json`: `AUDIO-002` -> `ready_for_qa`.

### Verification
- Baseline before work: `npm test` passed 134/134.
- Red test: `node --test tests/audio002.test.mjs` failed 5/5 before implementation.
- Targeted tests: `node --test tests/audio002.test.mjs tests/audio001.test.mjs tests/ops002.test.mjs tests/pwa001.test.mjs` passed 21/21.
- Full suite: `npm test` passed 139/139.
- Encoding: `npm run lint:encoding` passed.
- Build: `npm run build` passed and listed `/api/tts`; existing unrelated `<img>` and Sentry warnings remain.

### QA Ask
- Codex2: verify `/api/tts` route contracts, `speak.ts` no longer references Web Speech, `ttsLimiter` exists, and SW caches `/api/tts?text=`.
- PM: after deploy, Android Chrome should show LookupCard audio buttons and play Edge `es-MX-DaliaNeural` audio without installing any local Spanish TTS voice.

## Codex1 -> Codex2 / PM Handoff (2026-05-19 15:10)

**Feature**: `VOCAB-005`
**Status**: `ready_for_qa`

### What Changed
- Added [src/lib/conjugate.ts](C:/Users/wang/esponal/src/lib/conjugate.ts) with deterministic `tryConjugateVerb`.
- Added local dependency scaffold under [vendor/spanish-verbs](C:/Users/wang/esponal/vendor/spanish-verbs) and wired `package.json` / `package-lock.json`.
- Reworked [src/lib/dictionary.ts](C:/Users/wang/esponal/src/lib/dictionary.ts) to:
  - extend `DictionaryEntry` with `conjugations`, `nounForms`, `adjectiveForms`
  - bump cache keys to `vocab:dict:v2:`
  - set 30-day Redis TTL
  - expand the GLM dictionary prompt
  - validate noun/adjective forms before keeping them
  - add deterministic conjugations for verb entries, including degraded fallback entries
- Added [ConjugationTable.tsx](C:/Users/wang/esponal/src/app/components/vocab/ConjugationTable.tsx).
- Updated [VocabAccordion.tsx](C:/Users/wang/esponal/src/app/components/vocab/VocabAccordion.tsx) to show:
  - 7 tense tabs + conjugation table for verbs
  - inline singular/plural + gender for nouns
  - inline ms/fs/mp/fp forms for adjectives
- Updated [src/app/vocab/page.tsx](C:/Users/wang/esponal/src/app/vocab/page.tsx) to serialize the richer dictData payload.
- Updated [LookupCard.tsx](C:/Users/wang/esponal/src/app/watch/LookupCard.tsx) so saving a looked-up word now persists `conjugations`, `nounForms`, and `adjectiveForms` into `dictData` while keeping the popup itself lightweight.
- Updated [src/app/api/vocab/add/route.ts](C:/Users/wang/esponal/src/app/api/vocab/add/route.ts) and [src/lib/vocab.ts](C:/Users/wang/esponal/src/lib/vocab.ts) so `lectura` sourceType is preserved.
- Added [tests/vocab005.test.mjs](C:/Users/wang/esponal/tests/vocab005.test.mjs).

### Verification
- Red test: `node --test tests/vocab005.test.mjs` failed 4/4 before implementation.
- Green test: `node --test tests/vocab005.test.mjs` passed 4/4.
- Regression slice: `node --test tests/vocab005.test.mjs tests/vocab004.test.mjs tests/web005.test.mjs tests/read001.test.mjs` passed 19/19.
- Full suite: `npm test` passed 143/143.
- Encoding: `npm run lint:encoding` passed.
- Build: `npm run build` passed.

### Warnings
- Existing only: `<img>` lint warnings in `SiteHeader` and `learn/[slug]`, Sentry instrumentation migration warnings, and `MODULE_TYPELESS_PACKAGE_JSON` warnings during node test imports.

### QA Ask
- Codex2: verify `VOCAB-005` contract from source and files:
  - `package.json` contains `spanish-verbs`
  - `src/lib/conjugate.ts` returns deterministic forms for `vivir` and `ser`
  - `src/lib/dictionary.ts` uses `vocab:dict:v2:` and stores richer dictData
  - `LookupCard.tsx` persists the new fields but does not render a conjugation table itself
  - `VocabAccordion.tsx` renders `ConjugationTable` for verbs and inline forms for nouns/adjectives
- PM/live smoke:
  - save a fresh verb from `/watch`, then open `/vocab` and confirm the expanded entry has 7 tense tabs
  - check one noun and one adjective entry for inline forms
  - old entries without new dictData should degrade quietly, not crash

## Codex2 QA Report - VOCAB-005

**Time**: 2026-05-19 16:01
**Tester**: Codex2

**Conclusion**: Passed. `VOCAB-005` is updated to `passing` in `feature_list.json`.

### Executed Checks
1. Targeted ticket test
   Command: `node --test tests/vocab005.test.mjs`
   Output summary:
   - `pass 4`
   - `fail 0`
   - Includes `VOCAB-005 conjugates regular and irregular verbs deterministically`
   Result: Pass.

2. Full baseline suite
   Command: `npm test`
   Output summary:
   - `pass 143`
   - `fail 0`
   - Includes the four `VOCAB-005` assertions inside the full suite
   Result: Pass.

3. Production build
   Command: `npm run build`
   Output summary:
   - Next.js build completed successfully
   - `/vocab` remained in the route output
   - Existing warnings only: `<img>` lint warnings in `SiteHeader.tsx` and `learn/[slug]/page.tsx`, plus existing Sentry instrumentation migration warnings
   Result: Pass.

4. Dependency and conjugation contract
   Commands:
   - `rg -n 'spanish-verbs|vendor/spanish-verbs' package.json package-lock.json`
   - inline Node module check for `tryConjugateVerb("vivir")`, `tryConjugateVerb("ser")`, and `tryConjugateVerb("xyzfake123")`
   Output summary:
   - `package.json:33:    "spanish-verbs": "file:vendor/spanish-verbs"`
   - `vivir` returned `presente.yo = "vivo"` and `presente.nosotros = "vivimos"`
   - `ser` returned `presente.yo = "soy"` and `preteritoIndefinido.yo = "fui"`
   - fake lemma returned `null`
   Result: Pass.

5. Dictionary pipeline and cache contract
   Method: source review of `src/lib/dictionary.ts`
   Evidence:
   - `DictionaryEntry` now includes `conjugations`, `nounForms`, and `adjectiveForms`
   - cache key is `vocab:dict:v2:${lemma}`
   - cache writes use 30-day TTL
   - GLM prompt includes noun/adjective `forms` JSON shape
   - noun/adjective forms are validated before being kept
   - degraded fallback still adds deterministic verb conjugations for verb POS
   Result: Pass.

6. UI contract verification
   Method: source review of `LookupCard.tsx`, `VocabAccordion.tsx`, `ConjugationTable.tsx`, `src/app/vocab/page.tsx`, and `src/app/api/vocab/add/route.ts`
   Evidence:
   - `LookupCard.tsx` persists `conjugations`, `nounForms`, and `adjectiveForms` into `dictData`
   - `LookupCard.tsx` does not import or render `ConjugationTable`
   - `VocabAccordion.tsx` imports `ConjugationTable` and renders it only for `word.conjugations`
   - `VocabAccordion.tsx` renders inline noun `singular / plural / gender` and adjective `ms / fs / mp / fp`
   - `src/app/vocab/page.tsx` serializes richer dictData back into `VocabWord`
   - `src/app/api/vocab/add/route.ts` accepts object `dictData` unchanged, so the richer fields are persisted
   Result: Pass.

### Warnings / Notes
- `git status --short --branch` before QA showed `## main...origin/main [ahead 1]`, which matches the existing local dev commit for `VOCAB-005`; QA did not treat that as a blocker.
- `node --test` still emits the existing `MODULE_TYPELESS_PACKAGE_JSON` warning for direct TS imports; not caused by this ticket.
- This QA pass was contract-focused. PM live smoke is still useful for one saved verb, noun, and adjective entry inside `/vocab`.

### Handoff
- No blockers found for contract QA.
- Next best action: PM or product-side live smoke on a freshly saved verb, noun, and adjective entry.
## Codex1 Hotfix Report - Session #65 (2026-05-20 12:15)

### 背景
部署 VOCAB-006 后生产环境 `/vocab` 页报 Server Component crash。根因：`getDueReviewCount` / `getDueReviewWords` 直接查询 `srsState` / `srsDue` 列，但 Vercel 生产 PostgreSQL 尚未跑 migration（`20260520094000_add_srs_fields`），Prisma 抛错，整个 Server Component 挂掉。

### 修复内容（commit `327c791`）
1. **`src/lib/vocab.ts`**：`getDueReviewCount` 和 `getDueReviewWords` 各加 `try/catch`，SRS 列不存在时静默返回 `0` / `[]`，避免 /vocab 崩溃。
2. **`vercel.json`**：`buildCommand` 改为 `npx prisma migrate deploy && npm run build`，确保今后每次 Vercel 部署自动应用 Prisma migration。
3. **`tests/deploy001.test.mjs`**：更新 DEPLOY-001 对 `buildCommand` 的断言，验证含 `prisma migrate deploy` 且含 `npm run build`。

### 验证
- `npm test`：148/148 通过（pre-commit hook 通过）
- 修复本身：`try/catch` 确保生产 DB 无 SRS 列时不报错，待复习徽章不显示（返回 0）

### 下一步
- **Vercel 侧**：重新部署后 `prisma migrate deploy` 将自动把 SRS migration 应用到生产库；之后 `getDueReviewCount` 的 try/catch 就走正常路径（不再兜底）
- **Codex2**：待 VOCAB-006 生产 migration 就位后，执行完整 QA（SRS schema 契约、API auth/rating 校验、flashcard 流程、/vocab badge）
- **PM**：若有必要可先在 Vercel Dashboard 手动触发一次 redeploy 以应用 migration

---

## Codex1 Dev Report - Session #64 (2026-05-20 11:40)

### 本轮完成
- 完成 `VOCAB-006` 开发并将状态更新为 `ready_for_qa`。
- 新增 SRS 持久化字段与迁移：
  - [schema.prisma](/C:/Users/wang/esponal/prisma/schema.prisma)
  - [migration.sql](/C:/Users/wang/esponal/prisma/migrations/20260520094000_add_srs_fields/migration.sql)
- 新增 FSRS helper：
  - [srs.ts](/C:/Users/wang/esponal/src/lib/srs.ts)
- 扩展词库数据层：
  - [vocab.ts](/C:/Users/wang/esponal/src/lib/vocab.ts)
  - `getDueReviewCount()`
  - `getDueReviewWords()`
- 新增 review API：
  - [route.ts](/C:/Users/wang/esponal/src/app/api/vocab/review/route.ts)
  - [route.ts](/C:/Users/wang/esponal/src/app/api/vocab/review/[wordId]/route.ts)
- 新增 review UI：
  - [page.tsx](/C:/Users/wang/esponal/src/app/vocab/review/page.tsx)
  - [ReviewClient.tsx](/C:/Users/wang/esponal/src/app/vocab/review/ReviewClient.tsx)
- 更新 [page.tsx](/C:/Users/wang/esponal/src/app/vocab/page.tsx)，顶部显示 `N 词待复习` badge 并链接 `/vocab/review`。
- 跑了 `npx prisma generate`，确保 Prisma Client 已包含新 SRS 字段。

### 已验证
- `node --test tests/vocab006.test.mjs`：5/5 通过
- `node --test tests/vocab006.test.mjs tests/vocab005.test.mjs tests/vocab004.test.mjs tests/web005.test.mjs`：17/17 通过
- `npm test`：148/148 通过
- `npm run build`：通过

### 已知说明
- 构建警告无新增，仍只有既有 `<img>` lint 警告与 Sentry instrumentation 提示。
- `node --test` 仍有既有 `MODULE_TYPELESS_PACKAGE_JSON` 警告，不是本票引入。
- 这一轮没有做浏览器手点 smoke；当前是结构层和构建层 `ready_for_qa`。

### 请 Codex2 验收
1. `VOCAB-006` 的 SRS schema/helper 契约
2. `GET /api/vocab/review` 与 `POST /api/vocab/review/[wordId]` 的 auth / rating 校验
3. `/vocab/review` 的 flashcard 流程源码契约
4. `/vocab` 顶部 due badge 契约
5. `npm test` 与 `npm run build`
## Dev Report бк Session #64 (2026-05-20 15:52)

### 本轮完成
- 实现 `VOCAB-007` AI 词形还原：修改 `src/lib/dictionary.ts`，让 AI 在查词时先识别变位词的原形，再返回词典条目。
- `RawAIEntry` 新增 `lemma?: string` 和 `morphInfo?: string`，解析 AI 响应时可以带回原形和词形说明。
- 重写 `fetchAIEntry(word, hintLemma, morphInfo)` prompt：不再假设 lemma 已知，而是要求 AI 先做 morphological analysis，再返回 JSON。
- `lookupDictionary` 升级到 `vocab:dict:v3:` cache namespace，先查 `hintLemma`，AI 返回 `aiLemma` 后再查一次对应 cache，避免不同变位形重复写入。
- 新增 `tests/vocab007.test.mjs` 5 条源合同测试，并将既有 `tests/vocab005.test.mjs` 的 cache key 断言从 `v2` 同步到 `v3`。

### 验证
- `node --test tests/vocab007.test.mjs`：先红 5/5 failing，实装后 5/5 passing
- `npm test`：153/153 passing
- `npm run build`：通过（仅有既有 `<img>` lint 警告和 Sentry instrumentation warning）
- `npx tsc --noEmit`：已尝试，但仍因 `tsconfig` 包含缺失的 `.next/types/**/*.ts` 而失败，属于已有环境/配置噪音，不是 `VOCAB-007` 回归。

### 当前状态
- `VOCAB-007` 已更新为 `ready_for_qa`
- 已更新 `feature_list.json`
- 等 Codex2 执行 QA 验收

### Codex2 验收建议
- 合同层：检查 `src/lib/dictionary.ts` 是否包含 `Identify its lemma` prompt、`parsed.lemma` fallback、`aiLemma` 和 `vocab:dict:v3:`
- 测试层：运行 `node --test tests/vocab007.test.mjs` 和 `npm test`
- 行为层（可选）：在 lookup flow 里点击 `tengo` / `fue` / `vamos` / `hablaron`，确认 lemma 不再是变位形本身

---
