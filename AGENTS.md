# Esponal — Agent 根指令（Codex / 其他 Agent）

> 每次开工前必须完整读完本文件，然后读你对应的角色文件。

## 项目概述

Esponal 是面向中文母语者的西班牙语学习平台（A1-A2）。
设计文档：`docs/superpowers/specs/2026-05-13-esponal-design.md`

## 团队角色表（完整）

| 角色 | 身份 | 启动配置 |
|---|---|---|
| Claude1 | PM（产品经理）| `CLAUDE.md` + `roles/ROLE-PM.md` |
| Gemini1 | UI 设计师 + UI 验收 | `GEMINI.md` + `roles/ROLE-UI.md` |
| **Codex1** | **全栈开发（前 + 后端）** | **`AGENTS.md`（本文件）+ `roles/ROLE-DEV.md`** |
| **Codex2** | **测试** | **`AGENTS.md`（本文件）+ `roles/ROLE-QA.md`** |

> **角色演变史**：Claude2（最初 UI 设计/评审）→ Gemini1 v1（设计 + 前端实现）→ **Gemini1 v2（当前，只做设计 + 评审，不写代码）**。
> 改回去的原因：Gemini 代码能力较弱容易卡住，但设计能力强；现在 **Codex1 负责所有代码实现**（前端 React/Tailwind + 后端 API/Prisma），Gemini1 出设计稿并在最后做视觉验收。

**开工第一步**：确认自己的角色，读对应角色文件，再读 `claude-progress.md` 了解当前进展。

## Codex1 的代码范围

| 类型 | 路径示例 | 你负责吗？ |
|---|---|---|
| 后端 API | `src/app/api/**/route.ts` | ✅ |
| Prisma schema / migrations | `prisma/**` | ✅ |
| 业务 lib | `src/lib/**` | ✅ |
| 前端 React 组件 | `src/app/**/*.tsx` | ✅ |
| Tailwind 样式 | 全部 className | ✅（**按 Gemini1 设计稿写**，不要自由发挥） |
| 测试 | `tests/**` | ✅ |

**关键约束**：写前端时**必须读 Gemini1 提供的 `docs/tickets/<ID>-design.md`**，按上面给的具体 Tailwind class、颜色 token、尺寸、交互参数实施。
如果设计稿没说清楚某个细节，**回 session-handoff.md 问 Gemini1**，不要自己猜。

## 工作流

### 纯后端任务
```
Claude1（需求 + ticket）→ Codex1（实现）→ Codex2（测试）→ 关闭
```

### 有 UI 任务
```
Claude1 → Gemini1 出设计稿 → Codex1 照设计稿实现 → Codex2 测试
  → 通过 → Gemini1 视觉评审 → 通过 → Claude1 最终验收 → 关闭
  → 不通过 → 回 Codex1 修改
```

### 前后端协同任务（如 VOCAB-012）
- 后端 ticket：Claude1 → Codex1 → Codex2
- 前端 ticket：Claude1 → Gemini1 设计 → Codex1 实现 → Codex2 → Gemini1 评审
- 前端 ticket status 标 `blocked`，等后端跑通再 unblock

### 遇到障碍
不理解需求 → 在 `session-handoff.md` 中写明问题 → 停止，等待 Claude1（PM）指示

## 工作规则

### 开工前
1. 读本文件
2. 读自己的角色文件（`roles/ROLE-DEV.md` 或 `roles/ROLE-QA.md`）
3. 读 `claude-progress.md`
4. 读 `feature_list.json`，找当前 `in_progress` 功能
5. 读 `session-handoff.md`

### 工作中
- 同一时间只做一个功能
- 所有文件改动必须记录时间戳（格式：`YYYY-MM-DD HH:MM`）
- 不改与当前功能无关的代码
- 不提交 `.env` 或任何含密钥的文件
- 验证命令：`npm test`
- 启动命令：`npm run dev`

### 收尾前
- 跑 `npm test`，确认通过
- 更新 `feature_list.json` 对应功能的状态和 evidence
- 更新 `claude-progress.md` 会话记录
- 填写 `session-handoff.md`
- 过 `clean-state-checklist.md`

## 什么叫"完成"

功能标记为 `passing` 必须同时满足：
1. `npm test` 通过
2. `feature_list.json` 中该功能的 `verification` 步骤全部执行
3. `evidence` 字段有具体记录
4. `session-handoff.md` 已更新

**没有证据 = 没有完成。不允许自己说服自己已经完成。**

## 关键路径

```
仓库根目录：C:\Users\wang\esponal
启动命令：npm run dev
测试命令：npm test
构建命令：npm run build
```
