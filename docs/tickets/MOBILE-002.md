# MOBILE-002 — lectura 分级阅读 移动端重设计

**优先级**：P1（移动端重构 epic T1-②;每日留存引擎)
**区域**：`src/app/lectura/page.tsx`(列表)+ `src/app/lectura/[slug]`(文章)+ `LecturaReader.tsx` + `ReadingDock.tsx` + `ReadingPreferences.tsx` + `LecturaReadStatus.tsx`
**设计**：Gemini1（设计稿 `docs/tickets/MOBILE-002-design.md`)
**实现**：Codex1
**测试**：Codex2 + Gemini1 评审 + 用户真机 + PM 验收
**依赖**：MOBILE-000 地基(已 passing)
**预估**：1.5 天

---

## 背景与定位

- lectura 是**每日留存引擎**(产品理念:词汇靠阅读输入自然积累,不靠 SRS 打卡;用户每天读新文章 + 重读)。所以**移动端阅读体验必须丝滑、舒适、可坚持**。
- 目标用户:成人/学生自学者。调性:高效克制、专业、不游戏化。
- 阅读是 lectura 的全部——**排版/可读性是这张票的重中之重**(比 watch 更吃字体、行距、留白)。

## 复用 MOBILE-000 地基(不重造)

- **点词查词 → 直接用 MOBILE-000 的底部抽屉 LookupCard**(全站共享,已 passing)。
- **移动端 token**(`.pb-safe` / `.mobile-touch-target` / 44px / 安全区)直接用。
- **强调色 = 翡翠绿 brand**(全站已统一,勿再引入 sky 蓝)。
- 质量标杆:对齐 MOBILE-000/001 的精致度(用户对视觉要求高,别出半成品)。

## 用户可见行为(目标)

- 手机打开 `/lectura`(列表):分级文章卡片流清晰,A1/A2 等级标识、时长、已读状态一目了然,单手好点。
- 手机打开某篇文章(`/lectura/[slug]`):
  - **正文排版舒适**:合适字号/行距/段距/左右留白,长文阅读不累。
  - **点任意西语词 → 底部抽屉查词**(复用 MOBILE-000)。
  - **段落朗读**(AUDIO-001)在移动端顺手。
  - **阅读偏好**(字号等 ReadingPreferences)移动端可调。
  - **已读/重读**(LecturaReadStatus / 阅读记录)移动端清晰。
  - 阅读进度可感(滚动进度/已读标记)。
- 桌面端 lectura **不回退**(改动隔离,桌面样式/逻辑不动)。

## 待 Gemini1 设计(写进 MOBILE-002-design.md)

- 列表页移动端卡片流版式(等级徽章、时长、已读态、缩略/无缩略)。
- 文章页移动端:正文字号阶梯/行距/段距/左右 padding(给具体 Tailwind)、双语对照(如有中译)排版、当前段/朗读高亮。
- **阅读控制条(ReadingDock)移动端形态**:朗读、字号、已读等控件,拇指可达(底部?),与查词抽屉不打架。
- ReadingPreferences 移动端入口/形态。
- 沉浸阅读:是否隐藏顶栏/沉浸模式(可选)。

## 验收标准

- [ ] `/lectura` 列表 + 文章页移动端为专门设计的舒适阅读布局,符合 Gemini1 设计稿。
- [ ] 点词查词复用 MOBILE-000 底部抽屉,正常工作。
- [ ] 段落朗读、字号偏好、已读/重读在移动端可用、拇指可达。
- [ ] 正文排版舒适(字号/行距/留白),长文不累。
- [ ] 强调色统一翡翠绿;触摸目标≥44px;安全区适配。
- [ ] **桌面端 lectura 无回退**(样式/逻辑隔离)。
- [ ] **真机/设备模式实际打开列表+文章不崩**(error boundary 不触发)+ 渲染正常 —— 不可只凭 unit test 报全绿。
- [ ] `npm test` 全绿 + `npm run build` 通过 + `lint:encoding` 通过。

## 不在范围

- ❌ 其它页面移动端(MOBILE-003+)。
- ❌ 「学习路线集成每日阅读」(PATH-001,低优先 backlog)。
- ❌ 生成新读物功能。

## 流程(有 UI)

Claude1(本票)→ **Gemini1 设计稿** → Codex1 实现 → Codex2 测试(**含设备模式实际打开不崩**)→ Gemini1 评审 → 用户真机 → Claude1 验收。

> 【血泪教训,必读】
> 1. **改全站共享组件(如 LookupCard)只换该改的,桌面样式/逻辑不准动**——MOBILE-001 因给 MobileNav 误加 useSession 导致全移动端崩溃。
> 2. **单测多是 readFile+正则查源码字符串,测不出渲染崩溃**——Codex2 与验收**必须真机/设备模式实际打开页面**。
> 3. lectura/watch 区多 agent 并发,开工前确认最新代码;UTF-8;勿带 scratch 调试文件进仓库。
