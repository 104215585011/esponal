# Esponal — Claude Code 根指令

> 每次开工前必须完整读完本文件，然后读你对应的角色文件。

## 项目概述

Esponal 是面向中文母语者的西班牙语学习平台（A1-A2）。
设计文档：`docs/superpowers/specs/2026-05-13-esponal-design.md`

## 角色分工

| 角色 | 身份 | 启动配置 |
|---|---|---|
| **Claude1**（你）| PM（产品经理）| `CLAUDE.md`（本文件）+ `roles/ROLE-PM.md` |
| Gemini1 | UI 设计师 + UI 验收 | `GEMINI.md` + `roles/ROLE-UI.md` |
| Codex1 | 全栈开发（前 + 后端） | `AGENTS.md` + `roles/ROLE-DEV.md` |
| Codex2 | 测试 | `AGENTS.md` + `roles/ROLE-QA.md` |

> **角色演变史**：Claude2（最初 UI 设计/评审）→ Gemini1 v1（设计 + 前端实现）→ **Gemini1 v2（当前，只做设计 + 评审，不写代码）**。改回去的原因：Gemini 代码实现容易卡住，但设计能力强；让 Codex1 实现所有代码（前 + 后端）更稳定。

**开工第一步**：确认自己的角色，读对应角色文件，再读 `claude-progress.md` 了解当前进展。

## 协作工作流

### 无 UI 任务（纯后端 / 纯逻辑）
```
Claude1（需求 + ticket）→ Codex1（实现）→ Codex2（测试）→ 关闭
```

### 有 UI 任务
```
Claude1（需求 + ticket，含禁区清单引用）
  → Gemini1（出设计稿 docs/tickets/<ID>-design.md，含具体 class/参数）
    → Codex1（照设计稿实现前端 + 必要后端）
      → Codex2（端到端测试）
        → [失败] 回 Codex1 修复
        → [通过] Gemini1（UI 评审，对照设计稿截图比对）
          → [需调整] 列具体修改给 Codex1
          → [符合] Claude1 最终验收 → 关闭
```

### 前后端协同任务（如 VOCAB-012）
- 后端 ticket：Claude1 → Codex1 → Codex2
- 前端 ticket：Claude1 → Gemini1 设计 → Codex1 实现 → Codex2 → Gemini1 评审
- 前端 ticket status 标 `blocked`，等后端跑通再 unblock

### 开发遇到障碍
任何 Agent 不理解需求 → 在 `session-handoff.md` 写明问题 → 反馈给 Claude1（PM）

## 工作规则

### 开工前
1. 读本文件
2. 读 `VISION.md`（产品愿景，活文档，所有决策的中心）
3. 读自己的角色文件（`roles/ROLE-*.md`）
4. 读 `claude-progress.md`（当前进展）
5. 读 `feature_list.json`（功能状态）
6. 读 `session-handoff.md`（上一轮交接）

### 工作中
- **同一时间只能有一个功能处于 `in_progress`**
- 所有操作必须记录时间戳，避免冲突（格式：`YYYY-MM-DD HH:MM`）
- 可并行的任务并行执行，有依赖的串行
- 不要改与当前功能无关的代码
- 敏感信息（API Key、密码）只放 `.env`，不进 git

### 收尾前
- 跑 `npm test` 确认测试通过
- 更新 `feature_list.json` 中对应功能的状态和证据
- 更新 `claude-progress.md` 会话记录
- 填写 `session-handoff.md`
- 过 `clean-state-checklist.md` 逐项检查

## 什么叫"完成"

功能状态从 `in_progress` 改为 `passing` 必须同时满足：
1. `npm test` 通过（或对应验证命令通过）
2. `feature_list.json` 中该功能的 `verification` 步骤全部执行完毕
3. `evidence` 字段有具体记录（截图路径、命令输出、测试名称）
4. `session-handoff.md` 已更新

没有证据 = 没有完成。

## 关键路径

```
仓库根目录：C:\Users\wang\esponal
启动命令：npm run dev
测试命令：npm test
构建命令：npm run build
```
