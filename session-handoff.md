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
