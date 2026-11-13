# Esponal 项目全面诊断与改版意见书

> **诊断日期**：2026-11-13  
> **范围**：信息架构、移动端/桌面端界面、核心学习闭环、设计系统一致性、工程卫生  
> **原则**：严格遵守 [`UI-DESIGN-CONSTRAINTS.md`](./UI-DESIGN-CONSTRAINTS.md)（去游戏化、中文母语者友好、温暖克制）与 [`DESIGN-SYSTEM.md`](./DESIGN-SYSTEM.md)  
> **配套交互原型**：[`project-review-proposal.html`](./project-review-proposal.html)

---

## 一、总体评价

Esponal 已经具备非常扎实的产品底座：**从「字母发音 → 骨架课程 → 分级阅读 → YouTube 双语视频 → AI 对话 → 词库复习」的学习链路已经全部跑通**，近期又补齐了统一导入引擎（YouTube / PDF / EPUB）和移动端持久壳 `AppShell`。

当前项目的主要矛盾**不是“缺功能”，而是“收口与一致性”**：部分历史页面、过渡占位页、文档规范与最新实现之间出现了断层，导致新用户和老用户在切换桌面端/移动端、使用导入与复习功能时，会遇到入口分裂、心智负担甚至 404 死链。

---

## 二、核心问题与具体改动建议

### 1. 信息架构与路由分裂（P0）

| 现状问题 | 涉及文件 | 建议改动 |
|---|---|---|
| **双首页分裂**：桌面端「首页」指向 `/`，移动端 `AppShell` 底栏「首页」指向 `/home`。`/home` 无 `SiteHeader`，且仍带有开发占位文案（`正式首页在 P1 上线...`）。 | `src/app/page.tsx`<br>`src/app/home/page.tsx`<br>`src/app/components/shell/routes.ts` | **统一首页心智**：明确 `/` 为品牌落地页（未登录）/ 或统一将登录后桌面与移动端首页收口到同一套响应式结构；移除 `/home`、`/review`、`/me` 页面上的开发期占位说明文案，替换为真实数据与空状态引导。 |
| **`/settings` 死链（404）**：移动端 `/me` 页面与 `routes.ts` 均配置了 `/settings` 入口，但 `src/app/settings` 目录实际不存在。 | `src/app/me/page.tsx`<br>`src/app/components/shell/routes.ts` | **补齐 `/settings` 页面**（或在 `/me` 内直接承接偏好设置），提供默认播放倍速、暗色模式、双语字幕显示等轻量设置项。 |
| **未登录态假数据兜底**：`/` 页面在未登录时默认显示 `119 词`、`4 篇` 的硬编码数字，容易让新用户误以为账号已有历史记录。 | `src/app/page.tsx` (L162-163) | 未登录时隐藏个人统计数字，或展示客观的平台内容规模（如「27 个字母 · 9 个单元 · 分级短文」），登录后再显示个人客观累计。 |
| **复习与语料库入口割裂**：移动端底栏一级 Tab 是 `/review`（再跳 `/vocab/review`），而桌面端 `SiteNav` 只有 `语料库`（`/vocab`），没有直接的「复习」入口；且桌面端无法从顶栏直达 `/import`。 | `src/app/components/web/SiteNav.tsx`<br>`src/app/review/page.tsx` | 1. 在 `/vocab` 顶部提供醒目的「开始今日复习（N 词待复习）」操作区，或让 `/review` 成为统一的复习中枢（桌面+移动共用）。<br>2. 在桌面端 `SiteHeader` 增加轻量的「+ 导入」按钮（与移动端顶栏 `+` 号对称）。 |

---

### 2. 设计系统与禁区清单漂移（P1）

| 现状问题 | 涉及文件 | 建议改动 |
|---|---|---|
| **禁区清单回潮**：`DesktopLearningStepCard` 中仍渲染了 SVG 圆形进度环（`percentage`），与 `UI-DESIGN-CONSTRAINTS.md` §1「不要把进度百分比/进度环放在显眼位置」冲突。 | `src/app/page.tsx` (L94-118)<br>`docs/UI-DESIGN-CONSTRAINTS.md` | 移除 `DesktopLearningStepCard` 内的环形进度 SVG，仅保留静态、克制的文字标签（如 `已收藏 89 词`、`已读 4 篇`），与移动端样式保持一致。 |
| **桌面顶栏过载**：`SiteHeader` 在 `lg:` 下同时承载 Logo + 8 个导航项 + 分隔线 + 搜索框 + 倍速控件 + 主题切换 + 配额胶囊 + 头像，小屏桌面（1024px–1280px）视觉拥挤。 | `src/app/components/web/SiteHeader.tsx`<br>`src/app/components/web/SiteNav.tsx` | 将导航收敛为 **5 个核心学习场景**（首页 / 视频 / 阅读 / 课程 / 对话）+ **工具下拉或二级区**（语料库、拆解、语法、字母），将「倍速控制」下沉到视频/音频播放器内而非常驻全站顶栏。 |
| **文档与 Token 漂移**：`DESIGN-SYSTEM.md` 仍记录 `Inter` / `Outfit` 字体，但 `layout.tsx` 与 `tailwind.config.ts` 已改为 `Plus Jakarta Sans` + `Noto Sans SC`；`globals.css` 浅色底为 `#FAF9F6`，而 `tailwind.config.ts` `app` token 为 `#F9FAFB`。 | `docs/DESIGN-SYSTEM.md`<br>`src/app/globals.css`<br>`tailwind.config.ts` | 同步更新 `DESIGN-SYSTEM.md` 字体与色值说明；统一全站浅色背景 token（建议统一为 `#F9FAFB` 或将 `#FAF9F6` 正式写入 `tailwind.config.ts`）。 |

---

### 3. 核心学习闭环断点（P1）

1. **首页缺少「继续上次学习」动态中枢**
   - 代码库中已有 `src/lib/continueLearning.ts`，但 `/` 和 `/home` 都没有把用户最近一次的阅读、视频或课程接续放到首屏。
   - **建议**：在已登录用户的首页首屏增加一张「继续学习」横向卡片，直接承接上次未读完的 Lectura 短文、导入文档或视频时间点。
2. **EPUB 阅读器尚不支持点词查义**
   - `claude-progress.md` 显示 EPUB 已完成章节解析与翻页，但与 PDF / Lectura / Watch 相比，缺少核心的「点击单词查义 + 一键收藏到语料库」交互。
   - **建议**：在 `ImportReaderClient` 的 EPUB 章节文本渲染层复用分词与 `LookupCard` 逻辑，补齐“导入电子书 → 点词收藏 → 复习”闭环。
3. **Watch 页面的 Mock 残留**
   - `src/app/watch/page.tsx` 仍存在硬编码的 `MOCK_CHAPTERS` 示例数组，建议在无真实章节数据时隐藏章节面板或改为「当前字幕段落导航」，避免出现与视频内容无关的固定标题（如“阿根廷口音的特点”）。

---

### 4. 工程与代码卫生（P2）

- **根目录清理**：根目录存在较多历史遗留文件（`mockup-*.html`、`scratch_screenshots.cjs`、`test_out.txt`、`debug.log`、`.tmp-*`），建议统一归档到 `docs/archive/` 或纳入 `.gitignore` 清理，保持仓库整洁。
- **大文件拆分**：`src/app/watch/WatchClient.tsx`（712 行）承担了 YouTube Iframe API 加载、字幕同步、查词状态等多重职责，建议拆分为 `useYouTubePlayer` hook 与查词状态 hook。
- **进程/文档归档**：`session-handoff.md`（~900KB）与 `claude-progress.md`（~450KB）体量较大，建议按里程碑月度归档，减少每次会话检索开销。

---

## 三、推荐实施路线图

| 阶段 | 目标 | 关键交付 |
|---|---|---|
| **Phase 1 · 止血与一致化（1–2 天）** | 消除死链、假数据与占位文案 | 补齐 `/settings`；清理 `/home`、`/review`、`/me` 占位文案；移除 `/` 未登录假数据与进度环 SVG；同步 `DESIGN-SYSTEM.md`。 |
| **Phase 2 · 桌面/移动中枢收敛（2–3 天）** | 降低导航拥挤，强化「继续学习」 | 精简 `SiteHeader` 导航项并加入桌面端「+ 导入」入口；首页接入 `continueLearning` 接续卡片；统一 `/review` 与 `/vocab/review`。 |
| **Phase 3 · 闭环补完（3–5 天）** | 打通导入阅读与视频细节 | EPUB 阅读器接入点词查义与收藏；移除 Watch `MOCK_CHAPTERS`；拆分 `WatchClient.tsx` 与清理根目录临时文件。 |
