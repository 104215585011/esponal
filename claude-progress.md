# Esponal — 进度日志

> 每轮新会话先读本文件，每轮会话结束后更新。

## 当前已验证状态

**仓库根目录**：`C:\Users\wang\esponal`

**标准启动路径**：`npm run dev`（访问 http://localhost:3000）

**标准验证路径**：`npm test`

**当前最高优先级未完成功能**：`EXT-001`（Chrome 插件脚手架）

**当前 blocker**：无

**已验证通过的功能**：
- `INFRA-001`：项目脚手架（Next.js 14 + TypeScript + Prisma + Redis + NextAuth）
- `VOCAB-001`：词汇数据模型（Word + WordEncounter 表、CRUD 函数、真实迁移通过）

**待启动功能（按优先级）**：
1. `EXT-001` — Chrome 插件脚手架（Codex1 可直接开始，无需 UI 评审）
2. `COURSE-001` — 阶段一课程页面（等 Claude2 UI 评审）
3. `COURSE-002` — 语法知识库（等 Claude2 UI 评审）
4. `VOCAB-002` — 词库 Web 界面（等 Claude2 UI 评审，VOCAB-001 依赖已满足）

---

## 会话记录

### 会话 #1 — 2026-05-13

**本轮目标**：产品设计 + 项目规范建立

**已完成**：
- 调研西语高效学习方法（SRS/FSRS、可理解输入、Sentence Mining、Shadowing）
- 研究竞品：Duolingo、LingQ、Language Reactor、DejaVocab
- 确定产品定位：兴趣驱动学习伴侣，非强制打卡课程
- 确定技术方案：Web 端入门包 + Chrome 插件 + 共享词库（方案 C）
- 完成产品设计文档：`docs/superpowers/specs/2026-05-13-esponal-design.md`
- 建立项目规范体系：CLAUDE.md、AGENTS.md、角色文件、feature_list.json 等

**运行过的验证**：`npm test`（scaffold 测试通过）

**已记录证据**：设计文档 commit `6689048`

**提交记录**：
- `6689048` Add product design spec for Esponal Spanish learning platform

**已知风险或未解决问题**：
- AI 内容生成（MiniMax API）质量需要人工审核机制
- YouTube 字幕提取：自动生成字幕准确率约 85-90%
- 西语词形还原：生僻词/俚语可能失败，需降级处理
- API Key 已在对话中出现，提醒用户修改密码

**下一步最佳动作**：
Claude1（PM）启动 `VOCAB-001` ticket，交给 Codex1 实现词汇数据模型（无 UI 评审需要）

### 会话 #2 — 2026-05-13

**本轮目标**：Codex1 实现 `VOCAB-001` 词汇数据模型，并确认工作流文件是否损坏。

**已完成**：
- 确认 `AGENTS.md`、角色文件、`claude-progress.md`、`feature_list.json`、`session-handoff.md`、产品设计文档在磁盘上为 UTF-8 可读；PowerShell 输出乱码不是文件内容损坏
- 确认 `feature_list.json` 可被 JSON 解析，未修改任何功能的 `status` 或 `evidence`
- 新增 Prisma 词汇模型：`WordStatus`、`Word`、`WordEncounter`
- 新增词汇迁移 SQL：`prisma/migrations/20260513093000_add_vocab_models/migration.sql`
- 新增词库工具函数：`createWord`、`addEncounter`、`getWordsByUser`、`getWordWithEncounters`
- 新增 `tests/vocab.test.mjs`
- 生成 `package-lock.json`

**运行过的验证**：
- `npm test`：8/8 通过
- `npm run lint`：通过
- `npx prisma validate`：通过（临时设置本地 `DATABASE_URL`）
- `npx prisma generate`：通过
- `npm run build`：通过
- `npx prisma migrate diff --from-empty --to-schema-datamodel prisma\schema.prisma --script`：通过，输出包含 VOCAB-001 相关 SQL

**未完成或阻塞**：
- 已解决：本机 `5432` 被 `linguaai-postgres` 占用，Esponal 已固定改用本机 `5433`。
- 已修正：VOCAB migration 时间戳原本早于 init migration，导致 shadow DB 先跑词库迁移时找不到 `User` 表；已重命名为 `20260513113000_add_vocab_models`。

**会话 #2 补充记录 — 2026-05-13 11:17**：
- `docker-compose.yml`：Postgres 改为 `5433:5432`
- `.env.example` 与本地 `.env`：`DATABASE_URL` 改为 `localhost:5433`
- `.gitignore`：加入 `.claude`
- `docker compose up -d postgres`：通过，`esponal-postgres-1` 映射到 `5433`
- `npx prisma migrate dev --name add_vocab_models`：通过，已应用 init + VOCAB migrations
- `npm test`：8/8 通过

**下一步最佳动作**：
交给 Codex2 测试 `VOCAB-001`。

### 会话 #3 — 2026-05-13

**本轮目标**：Codex2 验收 `VOCAB-001` 词汇数据模型。

**已完成**：
- 按 `ROLE-QA.md` 执行验收流程
- 确认 Esponal Postgres 使用本机 `5433`，Redis 使用 `6379`
- 复制 `.env.example` 为本地 `.env`
- 运行 `npx prisma migrate dev`，确认数据库与 schema 同步
- 运行 `npm test`，8/8 通过
- 使用临时 Prisma 脚本真实创建 `User`、`Word`、`WordEncounter`，并按 `userId+lemma` 查询验证 forms 与 encounters 返回正确
- 更新 `feature_list.json`：`VOCAB-001` 标记为 `passing` 并填写 evidence
- 在 `session-handoff.md` 写入测试 Report

**运行过的验证**：
- `docker compose up -d postgres redis`：通过
- `docker ps`：确认 `esponal-postgres-1` 为 `0.0.0.0:5433->5432/tcp`
- `npx prisma migrate dev`：通过，输出 `Already in sync, no schema change or pending migration was found.`
- `npm test`：8/8 通过
- 临时 Prisma CRUD 脚本：通过，返回 `ok: true`、`lemma: ir`、`forms: [ir, fui, fueron, vas]`、`encounterCount: 1`

**结论**：
`VOCAB-001` 通过 Codex2 验收。

**下一步最佳动作**：
由 PM 启动下一个最高优先级任务；按当前 handoff，`EXT-001` 可在 `VOCAB-001` 通过后启动，`COURSE-001/COURSE-002/VOCAB-002` 仍需 Claude2 UI 评审。

### 会话 #4 — 2026-05-13

**本轮目标**：Codex1 实现 `EXT-001` Chrome 插件脚手架。

**已完成**：
- 新增 `extension/` 独立插件目录
- 新增 Manifest V3 配置：`manifest.json`
- 新增 service worker：`background.js`
- 新增 YouTube watch 页面 content script：`content.js`
- 新增极简 popup：`popup.html`、`popup.js`
- 新增插件独立构建配置：`extension/package.json`、`extension/package-lock.json`
- 新增 `tests/extension.test.mjs`
- 更新 `feature_list.json`：`EXT-001` 标为 `ready_for_qa`，等待 Codex2 验收
- 更新 `session-handoff.md`：记录本轮改动与待 QA 项

**运行过的验证**：
- `npm test`：12/12 通过
- `npm install --cache ..\.npm-cache`（在 `extension/` 下）：通过
- `npm run build`（在 `extension/` 下）：通过

**未验证**：
- Chrome 扩展管理页加载
- YouTube 页面 icon 激活
- 浏览器 console 无 uncaught error
- background service worker 日志可见

**下一步最佳动作**：
交给 Codex2 验收 `EXT-001`。

### 会话 #5 — 2026-05-13

**本轮目标**：Codex2 独立验收 `EXT-001` Chrome 插件脚手架。

**已完成**：
- 读取 `AGENTS.md`、`roles/ROLE-QA.md`、`session-handoff.md`、`feature_list.json`
- 确认 `EXT-001` 当前状态为 `ready_for_qa`
- 检查 `extension/manifest.json`、`background.js`、`content.js`、`popup.html`、`popup.js`、`package.json`
- 运行 `npm test`：12/12 通过
- 运行 `npm run build`（在 `extension/` 下）：通过，输出 `dist\content.js`、`dist\background.js`、`dist\popup.js`
- 使用临时 Chrome profile + DevTools Protocol 尝试验证 YouTube watch 页面注入

**验收结果**：失败。

**失败证据**：
- Chrome 调试目标中曾出现 `Service Worker chrome-extension://fignfifoniblkonapihmkfakmlgkbkcf/service_worker.js`，说明扩展有被加载。
- YouTube 页面 reload 后，`document.documentElement.dataset.esponalExtensionReady` 返回 `null`。
- `document.documentElement.classList.contains("esponal-extension-ready")` 返回 `false`。
- CDP execution contexts 中没有 `chrome-extension://...` isolated context，说明 `content.js` 未在 YouTube watch 页面执行。

**当前状态**：
- `feature_list.json` 未改为 `passing`。
- `session-handoff.md` 已写入 EXT-001 失败 QA report。
- 下一步应返回 Codex1 修复 content script 未注入问题。

### 会话 #6 — 2026-05-13

**本轮目标**：Codex1 修复 Codex2 发现的 `EXT-001` content script 未注入问题。

**已完成**：
- 根据 Codex2 失败 report 定位到扩展缺少 YouTube host permission 的风险点
- `extension/manifest.json` 增加 `https://www.youtube.com/*` host permission
- `tests/extension.test.mjs` 同步验证 YouTube host permission
- `.gitignore` 增加 `.qa`
- `feature_list.json` 保持 `EXT-001` 为 `ready_for_qa`，更新 Codex1 修复 evidence
- `session-handoff.md` 写入 Codex1 修复记录

**运行过的验证**：
- `npm test`：12/12 通过
- `npm run build`（在 `extension/` 下）：通过
- Playwright bundled Chromium 加载当前 `extension/` 后打开 YouTube watch 页面，验证 service worker 为 `chrome-extension://.../background.js`，页面 marker 返回 `readyDataset: "true"`、`readyClass: true`

**未完成**：
- Codex2 子 agent 复验仍需执行；`EXT-001` 不能由 Codex1 自行标记 `passing`。

**下一步最佳动作**：
恢复/重启 Codex2 子 agent，对 `EXT-001` 做最终 QA。


### 会话 #7 — 2026-05-13

**本轮目标**：Codex2 复验 `EXT-001` Chrome 插件脚手架修复。

**已完成**：
- 重新读取 `AGENTS.md`、`roles/ROLE-QA.md`、`session-handoff.md`、`feature_list.json`
- 确认 `EXT-001` 修复后仍处于 `ready_for_qa`
- 运行 `npm test`：12/12 通过
- 运行 `npm run build`（`extension/`）：通过，生成 `dist/content.js`、`dist/background.js`、`dist/popup.js`
- 使用 Playwright bundled Chromium 加载 `C:\Users\wang\esponal\extension` 并打开 YouTube watch 页面
- 验证扩展 service worker 为 `chrome-extension://.../background.js`
- 验证 `document.documentElement.dataset.esponalExtensionReady === "true"`
- 验证 `document.documentElement.classList.contains("esponal-extension-ready") === true`
- 验证 `pageErrorCount = 0`
- 更新 `feature_list.json`：`EXT-001.status = passing`，填写 QA evidence
- 更新 `session-handoff.md`：写入完整 QA report

**剩余限制**：
- Chromium 自动化无法直接观察 toolbar icon 视觉激活状态；以扩展加载和 YouTube matched content script 成功注入作为功能证据。
- YouTube 页面出现 1 条资源 403 console error，不属于扩展 uncaught exception。

**结论**：`EXT-001` 通过 Codex2 复验。
