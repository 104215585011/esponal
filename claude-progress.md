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
