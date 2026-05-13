# Session Handoff — Esponal

> 每轮会话结束时填写，下一轮开始时先读。

---

## 当前已验证

- `INFRA-001` 脚手架：✅ 通过（`npm test` scaffold 测试通过）
- 所有其他功能：`not_started`

## 并行执行计划（PM 决策，2026-05-13）

以下任务可立即并行启动：

| 任务 | 交给谁 | 状态 |
|---|---|---|
| VOCAB-001 | Codex1 开发 | 🔴 立即开始 |
| COURSE-001 UI 评审 | Claude2 | 🔴 立即开始（与 VOCAB-001 并行）|
| COURSE-002 UI 评审 | Claude2 | 🔴 立即开始（与 VOCAB-001 并行）|
| VOCAB-002 UI 评审 | Claude2 | 🔴 立即开始（开发依赖 VOCAB-001，但评审可先行）|

EXT-001 等 VOCAB-001 完成后启动。

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
