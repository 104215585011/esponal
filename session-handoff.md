# Session Handoff — Esponal

> 每轮会话结束时填写，下一轮开始时先读。

---

## 当前已验证

- `INFRA-001`：✅ passing
- `VOCAB-001`：✅ passing（Codex2 真实数据库验收通过，2026-05-13）

## 并行执行计划（更新，2026-05-13）

| 任务 | 交给谁 | 状态 |
|---|---|---|
| VOCAB-001 | Codex1 | ✅ 完成 |
| COURSE-001 UI 评审 | Claude2 | ✅ 通过（2026-05-13）|
| COURSE-002 UI 评审 | Claude2 | ✅ 通过（2026-05-13）|
| VOCAB-002 UI 评审 | Claude2 | ✅ 通过（2026-05-13）|
| EXT-001 | Codex1 | 🔴 进行中 |
| COURSE-001 开发 | Codex1 | 📋 待启动（UI 已通过）|
| COURSE-002 开发 | Codex1 | 📋 待启动（UI 已通过）|
| VOCAB-002 开发 | Codex1 | 📋 待启动（UI 已通过，依赖 VOCAB-001 ✅）|

---

## Claude2 UI 评审 Reports（2026-05-13）

### UI 评审 Report：COURSE-001
**时间**：2026-05-13
**评审人**：Claude2
**结论**：✅ 通过

**设计规格（Codex1 实现参考）**：

**布局**：
- 页面 `max-w-3xl` 居中，`px-4`（移动）/ `px-8`（桌面）
- 两个 Section 用 `border-t border-gray-100` 分隔，不用卡片容器包裹整个 Section
- Section 标题中文：「发音规则」「高频词汇」，`text-xl font-semibold text-gray-800`，不加序号或进度数字
- 词条列表 `flex flex-col gap-3`，长滚动，不分页，不显示"第 X/300 条"

**词条卡片**：
- 白色背景，`rounded-xl shadow-sm border border-gray-100 p-4`
- 三行结构：① 西语单词（`text-lg font-bold text-gray-900`）+ 词性 badge（`text-xs bg-gray-100 text-gray-500`）+ 右侧音频按钮 ② 中文释义（`text-base text-gray-700`）③ 例句西语（`text-sm text-gray-500 italic`）+ 例句中文（`text-sm text-gray-400`）
- 名词在中文释义旁标注「（阴性）」「（阳性）」，`text-gray-400`，不做红绿色区分

**音频播放**：
- 圆形按钮直径 `36px`，`bg-emerald-50`，图标 `text-emerald-600`
- 播放中：方形停止符，`bg-emerald-100`，不做脉冲动画
- 错误状态：图标变灰，hover tooltip 显示「音频暂时不可用」

**发音规则**：
- 每条格式：规则名（中文粗体）+ 说明 + 示例（西语加粗 + 中文注音）
- 直接展示全部，不折叠

**颜色/字体**：
- 页面底色 `#F9FAFB`，卡片白色 `#FFFFFF`
- 强调色 `emerald-600` 仅用于音频按钮
- 中文字体优先 `"PingFang SC", "Microsoft YaHei", sans-serif`

**无压迫感检查**：
- 标题只写「阶段一：入门词汇与发音」，不出现进度条/打卡天数/掌握百分比
- 词条卡不标注已学/未学状态

**移动端**：词条不横排两列；音频按钮热区 ≥ `44x44px`；顶部无固定进度栏

---

### UI 评审 Report：COURSE-002
**时间**：2026-05-13
**评审人**：Claude2
**结论**：✅ 通过

**设计规格（Codex1 实现参考）**：

**布局**：
- 桌面端：左侧固定侧边栏 `220px`（话题导航）+ 右侧内容区 `max-w-2xl`
- 移动端：侧边栏替换为顶部下拉选择器（`<select>` 或 Dropdown）

**侧边栏**：
- 标题「语法话题」，分组：「动词变位」「名词性别」「常见辨析」
- 条目 `text-sm text-gray-700`，激活状态左侧 `3px solid emerald-500` 竖线，不加背景高亮

**首页卡片列表**：
- 话题卡片与词条卡同款样式（`rounded-xl shadow-sm border border-gray-100`）
- 每张卡：话题名（中文）+ 一句话简介 + 右箭头
- 顺序：动词变位（6个）→ 阴阳性规则 → ser vs estar 辨析

**变位表**：
- 用语义 `<table>`，无外边框，仅 `border-b border-gray-100` 行分隔，表头 `bg-gray-50`
- 列：人称代词（西语）| 人称说明（中文）| 变位形式 | 音频（可选）
- 人称列 `text-gray-500 text-sm`，变位形式列 `text-gray-900 font-medium text-base`
- 移动端 `overflow-x-auto` 横向滚动，第一列 `position: sticky left: 0`

**中文类比块**：
- 左侧 `3px solid emerald-200` 竖线，背景 `bg-emerald-50/40 rounded-r-lg p-3`
- 标题「中文类比」，`text-xs font-semibold text-emerald-700 uppercase tracking-wide`
- 默认展示，不折叠

**ser vs estar 页**：
- 对比双栏表格，左 `ser` / 右 `estar`，表头加中文副标题
- 每栏 3-4 例句，西语加粗，下方跟中文翻译 + 括号内解释用 ser/estar 的理由

**词库跳转**：词条卡底部 `text-xs text-emerald-600` 的「查看相关语法 →」链接

---

### UI 评审 Report：VOCAB-002
**时间**：2026-05-13
**评审人**：Claude2
**结论**：✅ 通过

**设计规格（Codex1 实现参考）**：

**布局**：
- `max-w-2xl` 居中，底色 `#F9FAFB`
- 标题「我的词库」（`text-2xl font-bold text-gray-900`），副标题「按词根归类，记录你遭遇过的词」（`text-sm text-gray-400`），无词条总数显示

**词条行**：
- 白色，`rounded-xl border border-gray-100 p-4 cursor-pointer`
- 左：词根（`text-base font-semibold text-gray-900`）+ 中文释义（`text-sm text-gray-500`）
- 右：「遭遇 X 次」（`text-xs text-gray-400`）+ 最近时间（`text-xs text-gray-300`）+ 展开箭头
- 不显示已掌握/未掌握状态
- 按最近遭遇时间倒序排列

**遭遇记录展开（Accordion）**：
- 点击行内向下展开，`max-height` 过渡 `200ms ease-out`，不跳新页
- 展开区：`bg-gray-50 rounded-b-xl px-4 py-3`
- 每条记录结构：
  - 行一：视频标题（`text-sm font-medium text-gray-700`）+ 时间戳 badge（`text-xs bg-gray-200 text-gray-500`）+ 右上角「跳回视频」（`text-xs text-emerald-600 font-medium`，hover 下划线）
  - 行二：西语原句（`text-sm text-gray-600 italic`）
  - 行三：中文翻译（`text-sm text-gray-400`）
  - 行间 `border-b border-gray-100`

**时间线**：日期变化处插入日期分隔文字（`text-xs text-gray-300 text-center`）+ 两侧线条

**空状态**：
- 居中区块，高度 ≥ `240px`，线条风格插图
- 主文案「还没有遭遇过词汇」（`text-base text-gray-500`）
- 副文案「看视频时遇到的词会自动收录到这里」（`text-sm text-gray-400`）
- 不加任何 CTA 按钮

**未登录**：服务端直接 redirect 到 `/api/auth/signin`，不前端跳转

**移动端**：「跳回视频」热区 ≥ `44x44px`；展开区 `px-3`

---

## 所有 Tickets

---

### Ticket: VOCAB-001 词汇数据模型
**交给**：Codex1（直接开发，无需 UI 评审）
**状态**：🔴 进行中

**目标**：建立词汇系统的数据层，支撑后续所有词库功能。

**用户可见行为**：
- 系统能存储用户的词条（词根 + 中文释义）
- 每个词条能记录多条遭遇记录（视频 URL + 时间戳 + 原句 + 中文翻译）
- 词条能存储见过的变位形态列表
- 能按用户 ID + 词根查询词条

**技术细节**：
- 在 `prisma/schema.prisma` 新增两张表：`Word` 和 `WordEncounter`
- `Word` 表：id、userId、lemma（词根）、translation（中文释义）、forms（见过的变位形态，String[]）、status（new/learning/known）、createdAt、updatedAt
- `WordEncounter` 表：id、wordId、sourceUrl（视频链接）、timestampSec（秒数）、originalSentence、translatedSentence、createdAt
- 保留现有的 User/Account/Session/VerificationToken 表，不改动
- 在 `src/lib/vocab.ts` 提供 CRUD 工具函数：createWord、addEncounter、getWordsByUser、getWordWithEncounters
- 写测试：`tests/vocab.test.mjs`

**验收标准**：
- [ ] `npm run prisma:migrate` 成功
- [ ] `npm test` 通过（包含 vocab CRUD 测试）
- [ ] 能创建词条并关联遭遇记录
- [ ] 查询词根能返回该用户该词根下的所有变位形态和遭遇记录

**不要动**：现有 Prisma schema 中的认证表、`tests/scaffold.test.mjs`

**Codex1 实现记录 — 2026-05-13 11:10**

**改动原因**：PM 确认工作流文件若损坏应优先修复；经 Python UTF-8 读取和 JSON 解析验证，文件实际未损坏，仅 PowerShell 输出乱码。因此未重写文档内容，避免无意义 churn。

**本轮改动文件**：
- `.gitignore`：忽略本地 npm cache 目录 `.npm-cache`
- `package-lock.json`：安装依赖后生成锁文件
- `prisma/schema.prisma`：新增 `WordStatus`、`Word`、`WordEncounter`，并在 `User` 上增加 `words` 关系字段
- `prisma/migrations/20260513093000_add_vocab_models/migration.sql`：新增词汇模型迁移 SQL
- `src/lib/vocab.ts`：新增 `createWord`、`addEncounter`、`getWordsByUser`、`getWordWithEncounters`
- `tests/vocab.test.mjs`：新增 VOCAB-001 schema/lib 契约测试
- `claude-progress.md`、`session-handoff.md`：记录本轮进展和交接信息

**已验证**：
- `npm test`：8/8 通过
- `npm run lint`：通过，无 ESLint warnings/errors
- `npx prisma validate`（临时设置 `DATABASE_URL=postgresql://postgres:postgres@localhost:5432/espanol?schema=public`）：通过
- `npx prisma generate`：通过
- `npm run build`：通过
- `npx prisma migrate diff --from-empty --to-schema-datamodel prisma\schema.prisma --script`：可生成包含 `WordStatus`、`Word`、`WordEncounter` 的 SQL

**端口修复与迁移记录 — 2026-05-13 11:17**

**改动原因**：本机 `5432` 会持续被其他项目占用，PM 决定 Esponal 固定改用本机 `5433`，不停止其他项目容器。

**本轮补充改动**：
- `docker-compose.yml`：Esponal Postgres 改为 `5433:5432`
- `.env.example`：`DATABASE_URL` 改为 `localhost:5433`
- `.env`：本地同步为 `localhost:5433`，该文件被 `.gitignore` 忽略，不提交
- `.gitignore`：忽略 `.claude`
- Prisma migration 目录从 `20260513093000_add_vocab_models` 重命名为 `20260513113000_add_vocab_models`，确保排在已有 `20260513112000_init` 之后；否则 shadow DB 会先跑 VOCAB migration，导致 `User` 表不存在

**已验证**：
- `docker compose up -d postgres`：通过
- `docker ps`：`esponal-postgres-1` 映射为 `0.0.0.0:5433->5432/tcp`，`linguaai-postgres` 仍占用 `5432`，未被停止
- `npx prisma migrate dev --name add_vocab_models`：通过，依次应用 `20260513112000_init` 和 `20260513113000_add_vocab_models`
- `npm test`：8/8 通过

**下一步最佳动作**：
Codex2 测试 `VOCAB-001`。

## 测试 Report：VOCAB-001 词汇数据模型
**时间**：2026-05-13 11:23
**测试人**：Codex2

**结论**：通过

**验证步骤执行记录**：
1. 启动本地依赖服务并确认 5433 端口
   命令：`docker compose up -d postgres redis`
   输出：
   ```text
   Container esponal-redis-1 Running
   Container esponal-postgres-1 Running
   ```
   命令：`docker ps --format "table {{.Names}}\t{{.Image}}\t{{.Ports}}"`
   输出：
   ```text
   esponal-postgres-1        postgres:16-alpine      0.0.0.0:5433->5432/tcp, [::]:5433->5432/tcp
   esponal-redis-1           redis:7-alpine          0.0.0.0:6379->6379/tcp, [::]:6379->6379/tcp
   linguaai-postgres         postgres:17-bookworm    0.0.0.0:5432->5432/tcp, [::]:5432->5432/tcp
   ```
   结果：✅

2. 复制 `.env.example` 为 `.env`
   命令：`Copy-Item -Force .env.example .env`
   输出：无错误输出；`git status --short --ignored .env` 显示 `!! .env`
   结果：✅

3. 执行 Prisma 迁移
   命令：`npx prisma migrate dev`
   输出：
   ```text
   Environment variables loaded from .env
   Datasource "db": PostgreSQL database "espanol", schema "public" at "localhost:5433"
   Already in sync, no schema change or pending migration was found.
   ✔ Generated Prisma Client (v5.22.0) to .\node_modules\@prisma\client in 69ms
   ```
   结果：✅

4. 执行自动化测试
   命令：`npm test`
   输出：
   ```text
   ✔ package declares the INFRA-001 application stack
   ✔ welcome page is present in the Next.js App Router
   ✔ Prisma is configured for PostgreSQL with initial models
   ✔ initial Prisma migration is checked in
   ✔ environment example documents required local services
   ✔ Prisma schema defines vocabulary words owned by users
   ✔ Prisma schema defines word encounters linked to words
   ✔ vocab library exposes the ticket CRUD functions
   ℹ tests 8
   ℹ pass 8
   ℹ fail 0
   ```
   结果：✅

5. 执行真实数据库 CRUD 验证
   命令：临时 Node + Prisma 脚本创建 `User`、`Word`、`WordEncounter`，按 `userId+lemma` 查询并清理 QA 数据
   输出：
   ```json
   {
     "ok": true,
     "lemma": "ir",
     "forms": ["ir", "fui", "fueron", "vas"],
     "encounterCount": 1,
     "timestampSec": 222
   }
   ```
   结果：✅

**若失败，失败详情**：
- 无

**若通过，移交**：
- `VOCAB-001` 为非 UI 功能，已更新 `feature_list.json`：`status` 改为 `passing`，`evidence` 已填写。
- 下一步可由 PM 启动 `EXT-001` 或继续推进依赖 `VOCAB-001` 的后续任务。

---

### Ticket: COURSE-001 阶段一课程页面
**交给**：先到 Claude2 UI 评审，通过后给 Codex1 开发
**状态**：⏳ 等待 Claude2 评审

**目标**：零基础用户的第一个学习入口，发音规则 + 300 高频词，有音频，有中文解释。

**用户可见行为**：
- 访问 `/learn/phase-1` 看到课程页面
- 页面分两块：① 发音规则（中文解释，配示例音频）② 300 高频词列表（名词/动词/形容词各约 100）
- 每个词条显示：西语单词、中文释义、例句、音频播放按钮
- 点击音频按钮播放该词的 TTS 发音
- 页面无进度条、无打卡要求

**技术细节**：
- 词汇内容存为静态 JSON：`content/curriculum/phase1-words.json`
- 发音规则存为静态 MDX：`content/curriculum/pronunciation.mdx`
- 音频文件预生成（Azure TTS），存入 `public/audio/words/`，不实时调用 TTS
- 页面为 Server Component，数据直接从文件系统读
- 需要 `.env` 新增：`AZURE_TTS_KEY`、`AZURE_TTS_REGION`（音频预生成脚本用）

**验收标准**：
- [ ] `/learn/phase-1` 正常渲染，无报错
- [ ] 发音规则内容完整（覆盖西语所有字母发音）
- [ ] 至少 30 个词条有正确音频（MVP 验收，不要求 300 个全部有）
- [ ] 中文解释存在，语言准确
- [ ] 无强制进度元素（无进度条、无打卡提示）
- [ ] `npm test` 通过

**需要 Claude2 评审**：是
**评审重点**：页面布局、词条卡片设计、音频播放交互、整体无压迫感设计

---

### Ticket: COURSE-002 语法知识库
**交给**：先到 Claude2 UI 评审，通过后给 Codex1 开发
**状态**：⏳ 等待 Claude2 评审

**目标**：针对中文母语者的西语语法参考，用中文写，用时查，不强迫学。

**用户可见行为**：
- 访问 `/grammar` 看到语法知识库首页，按话题分类
- 每个话题页有：规则说明（中文）+ 变位表 + 中文类比 + 例句
- 首期覆盖：ser/estar/tener/ir/querer/poder 现在时变位、阴阳性规则、ser vs estar 区别
- 从词库词条可以跳转到对应语法规则页

**技术细节**：
- 内容存为 MDX：`content/grammar/[slug].mdx`
- 路由：`/grammar`（首页）、`/grammar/[slug]`（具体规则）
- 内容由 PM 人工整理（非 AI 生成），Codex1 只负责页面渲染
- 页面为 Server Component + next-mdx-remote 渲染

**验收标准**：
- [ ] `/grammar` 首页显示所有语法话题列表
- [ ] 6 个动词的变位表页面存在且内容正确
- [ ] 阴阳性规则页面有中文类比解释
- [ ] ser vs estar 区别页面存在
- [ ] `npm test` 通过

**需要 Claude2 评审**：是
**评审重点**：知识库导航结构、变位表呈现方式、中文类比的排版

---

### Ticket: VOCAB-002 词库 Web 界面
**交给**：先到 Claude2 UI 评审，通过后给 Codex1 开发（开发依赖 VOCAB-001 完成）
**状态**：⏳ 等待 Claude2 评审（Claude2 可先评审，Codex1 等 VOCAB-001 完成再开发）

**目标**：用户看到自己积累的词汇，感受到学习在发生。

**用户可见行为**：
- 登录后访问 `/vocab` 看到自己的词条列表
- 词条按词根归类（不是按变位形式）
- 每个词条显示：词根、中文释义、遭遇次数、最近遭遇时间
- 点击词条展开遭遇记录：视频标题 + 时间戳 + 原句 + 中文翻译
- 未登录访问跳转登录页

**技术细节**：
- 路由：`src/app/vocab/page.tsx`（Server Component，服务端拉数据）
- 数据来自 `src/lib/vocab.ts` 的 getWordsByUser
- 依赖 VOCAB-001 完成

**验收标准**：
- [ ] 登录状态下 `/vocab` 显示当前用户词条
- [ ] 未登录访问跳转 `/api/auth/signin`
- [ ] 词条按词根归类，不重复
- [ ] 点击词条展开遭遇记录列表
- [ ] `npm test` 通过

**需要 Claude2 评审**：是
**评审重点**：词条列表布局、遭遇记录展开方式、空状态设计（没有词条时显示什么）

---

### Ticket: EXT-001 Chrome 插件脚手架
**交给**：Codex1（VOCAB-001 完成后启动，无需 UI 评审）
**状态**：📋 待启动（等 VOCAB-001 完成）

**目标**：建立插件工程基础，后续所有插件功能在此基础上开发。

**用户可见行为**：
- 在 Chrome 扩展管理页加载插件无报错
- 打开任意 YouTube 视频，插件 icon 显示激活状态
- 浏览器 console 无 uncaught error

**技术细节**：
- 插件目录：`extension/`，独立于 Next.js 项目
- Manifest V3 结构：
  - `extension/manifest.json`
  - `extension/background.js`（service worker）
  - `extension/content.js`（YouTube 页面注入）
  - `extension/popup.html` + `extension/popup.js`（点击插件 icon 的弹窗）
- content.js 注入条件：`https://www.youtube.com/watch*`
- 插件与 Web 服务通信用 `https://localhost:3000/api/` （开发环境）
- 构建脚本：`extension/package.json` + esbuild

**验收标准**：
- [ ] `chrome://extensions` 加载 `extension/` 目录无报错
- [ ] 打开 YouTube 视频页，插件 icon 激活
- [ ] console 无 uncaught error
- [ ] background.js 中打印启动日志可见

**不需要 UI 评审**：插件 popup 极简即可，后续再优化

---

### Ticket: EXT-002 YouTube 双语字幕叠加
**交给**：先到 Claude2 UI 评审，通过后给 Codex1 开发（依赖 EXT-001）
**状态**：📋 待启动（EXT-001 完成后，Claude2 评审 → Codex1 开发）

**目标**：这是插件的核心体验，用户在 YouTube 上看西语视频时自动看到中西双语字幕。

**用户可见行为**：
- 打开有官方字幕的西语 YouTube 视频，双语字幕自动出现（不需要用户操作）
- 打开无官方字幕的视频，自动降级使用 YouTube 自动生成字幕
- 中文翻译准确（MiniMax API）
- 字幕跟随视频进度实时更新
- 可点击插件 icon 切换显示/隐藏中文翻译

**技术细节**：
- content.js 拦截 YouTube 字幕请求（XMLHttpRequest 拦截或 IntersectionObserver 监听字幕 DOM）
- 字幕文本发送到 `/api/translate`（Next.js API Route），由服务端调用 MiniMax 翻译，避免在插件暴露 API Key
- 翻译结果缓存在 Redis（key: `subtitle:hash(原文)`，TTL 7天），避免重复翻译
- 字幕 DOM 注入位置在 YouTube 原有字幕容器下方
- 不修改 YouTube 原有字幕，只叠加新元素

**验收标准**：
- [ ] 有字幕西语视频：双语字幕自动显示，跟随进度
- [ ] 无字幕视频：降级处理，不报错
- [ ] 抽查 3 条字幕翻译，语义正确
- [ ] 切换显示/隐藏中文功能正常
- [ ] `/api/translate` 路由存在，参数校验到位

**需要 Claude2 评审**：是
**评审重点**：双语字幕的位置和样式（不遮挡画面、不影响 YouTube 原有字幕）

---

### Ticket: EXT-003 词形还原 + 点击查词
**交给**：先到 Claude2 UI 评审，通过后给 Codex1 开发（依赖 EXT-002、VOCAB-001）
**状态**：📋 待启动

**目标**：点击字幕中任意词，立刻知道它是什么、能加入自己的词库。

**用户可见行为**：
- 点击字幕中任意西语词，弹出查词卡片
- 卡片显示：词根、当前变位形式说明（中文）、中文释义、「加入我的词库」按钮
- 点击「加入我的词库」，词条和遭遇记录保存成功
- 卡片不打断视频播放（视频继续，卡片浮动显示）
- 点击卡片外部关闭卡片

**技术细节**：
- content.js 给字幕中每个词包裹 `<span>` 标签，绑定点击事件
- 点击后调用 `/api/lemmatize`：入参词形 → 返回词根 + 变位说明 + 释义
- `/api/lemmatize` 服务端集成 spacy Python 服务（HTTP 调用），或 MVP 阶段先用规则词典
- MVP 阶段：内置高频 1000 词的词根映射 JSON，覆盖率约 70%，未匹配词显示"暂不支持"
- 「加入词库」调用 `/api/vocab/add`（需登录态，cookie 传递）

**验收标准**：
- [ ] 点击 `fui` 弹出卡片，显示词根 `ir`，标注「简单过去时 / 第一人称单数」
- [ ] 点击 `hablan` 弹出卡片，显示词根 `hablar`
- [ ] 点击「加入我的词库」后，刷新 `/vocab` 页面能看到该词条
- [ ] 视频播放不被中断
- [ ] 点击卡片外关闭

**需要 Claude2 评审**：是
**评审重点**：查词卡片的设计（位置、内容排版、关闭方式）

---

### Ticket: EXT-004 已学词高亮
**交给**：先到 Claude2 UI 评审确定颜色方案，通过后给 Codex1 开发（依赖 EXT-002、VOCAB-001、COURSE-001）
**状态**：📋 待启动

**目标**：让用户在看视频时感受到积累——认识的词会闪光。

**用户可见行为**：
- 字幕中，课程里学过的词显示绿色（柔和，不刺眼）
- 词库里保存过的词显示蓝色
- 陌生词不高亮，保持原色
- 高亮不影响字幕可读性

**技术细节**：
- content.js 在渲染字幕词 span 时，调用 `/api/vocab/highlight`（传入词列表，返回各词状态：course/saved/unknown）
- 批量查询，避免每词一次请求
- 颜色方案由 Claude2 确定后写入 content.css

**验收标准**：
- [ ] 课程词绿色高亮，词库词蓝色高亮，陌生词无高亮
- [ ] 高亮在不同 YouTube 背景色下均可读
- [ ] 批量查询接口响应 < 300ms（本地环境）
- [ ] `npm test` 通过

**需要 Claude2 评审**：是（颜色方案必须先定）

---

### Ticket: VOCAB-003 遭遇记录跳回视频
**交给**：Codex1 开发（依赖 VOCAB-002、EXT-003 完成）
**状态**：📋 待启动

**目标**：让词库不只是一个列表，而是有记忆的时间线。

**用户可见行为**：
- 在 `/vocab` 页面点击某条遭遇记录
- 跳转到原 YouTube 视频，并定位到该时间戳（`?t=秒数`）
- 在新标签页打开

**技术细节**：
- 遭遇记录存储时已有 `sourceUrl` + `timestampSec`
- 跳转链接格式：`https://www.youtube.com/watch?v=VIDEO_ID&t=SECONDS`
- 纯前端拼接，无需后端

**验收标准**：
- [ ] 点击遭遇记录，新标签页打开 YouTube 并跳转到正确时间（误差 < 2 秒）
- [ ] 链接格式正确，不报 404

**不需要 UI 评审**：纯链接跳转，无复杂交互

---

## 不要动的东西

- `.env.example` 的格式（新增变量同步更新它）
- `tests/scaffold.test.mjs`（不改已通过的测试）
- `prisma/schema.prisma` 现有的 User/Account/Session/VerificationToken 表

## 命令参考

```bash
npm run dev          # 启动开发服务器
npm test             # 跑测试
npm run prisma:migrate   # 数据库迁移
npm run prisma:generate  # 生成 Prisma Client
npm run build        # 构建
```

---

*最后更新：2026-05-13，会话 #2，Claude1（PM）*

---

## Codex1 实现记录：EXT-001 Chrome 插件脚手架
**时间**：2026-05-13 11:31
**执行人**：Codex1

**状态**：ready_for_qa，等待 Codex2 验收

**本轮目标**：建立 `extension/` 独立插件工程基础，满足 Manifest V3、YouTube watch 页面 content script 注入、background 启动日志、极简 popup、esbuild 构建脚本。

**本轮改动文件**：
- `extension/manifest.json`：新增 Manifest V3 配置，content script 只匹配 `https://www.youtube.com/watch*`
- `extension/background.js`：新增 service worker 启动/安装日志
- `extension/content.js`：新增 YouTube 页面 ready marker 和开发 API base URL `https://localhost:3000/api/`
- `extension/popup.html`：新增极简 popup
- `extension/popup.js`：新增打开本地 Web App 的按钮行为
- `extension/package.json`：新增独立 esbuild 构建脚本
- `extension/package-lock.json`：锁定插件依赖
- `tests/extension.test.mjs`：新增 EXT-001 scaffold 测试
- `feature_list.json`：`EXT-001` 改为 `ready_for_qa`，填写 Codex1 evidence

**已验证**：
- `npm test`：12/12 通过
- `npm install --cache ..\.npm-cache`（在 `extension/` 下）：通过
- `npm run build`（在 `extension/` 下）：通过，输出 `dist\content.js`、`dist\background.js`、`dist\popup.js`

**未验证，交给 Codex2**：
- `chrome://extensions` 加载 `extension/` 目录无报错
- 打开 YouTube 视频页后插件 icon 激活
- 浏览器 console 无 uncaught error
- background.js 启动日志在扩展 service worker 控制台可见

**下一步最佳动作**：
Codex2 按 `ROLE-QA.md` 验收 `EXT-001`。若通过，更新 `feature_list.json` 为 `passing` 并补 QA evidence。
