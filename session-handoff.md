# Session Handoff — Esponal

> 每轮会话结束时填写，下一轮开始时先读。

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
