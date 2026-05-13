# Esponal — 进度日志

> 每轮新会话先读本文件，每轮会话结束后更新。

## 当前已验证状态

**仓库根目录**：`C:\Users\wang\esponal`

**标准启动路径**：`npm run dev`（访问 http://localhost:3000）

**标准验证路径**：`npm test`

**当前最高优先级未完成功能**：`VOCAB-001`（词汇数据模型）

**当前 blocker**：无

**已验证通过的功能**：
- `INFRA-001`：项目脚手架（Next.js 14 + TypeScript + Prisma + Redis + NextAuth）

**待启动功能（按优先级）**：
1. `VOCAB-001` — 词汇数据模型
2. `COURSE-001` — 阶段一课程页面（需 UI 评审）
3. `COURSE-002` — 语法知识库（需 UI 评审）
4. `VOCAB-002` — 词库 Web 界面（需 UI 评审）
5. `EXT-001` — Chrome 插件脚手架

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
