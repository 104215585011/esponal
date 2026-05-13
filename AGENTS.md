# Esponal — Agent 根指令（Codex / 其他 Agent）

> 每次开工前必须完整读完本文件，然后读你对应的角色文件。

## 项目概述

Esponal 是面向中文母语者的西班牙语学习平台（A1-A2）。
设计文档：`docs/superpowers/specs/2026-05-13-esponal-design.md`

## 你的角色

| 角色 | 身份 | 读哪个文件 |
|---|---|---|
| Codex1 | 开发 | `roles/ROLE-DEV.md` |
| Codex2 | 测试 | `roles/ROLE-QA.md` |

**开工第一步**：确认自己的角色，读对应角色文件，再读 `claude-progress.md` 了解当前进展。

## 工作流

### 无 UI 任务
```
Claude1（需求 + ticket）→ Codex1（实现）→ Codex2（测试）
```

### 有 UI 任务
```
Claude1 → Claude2（评审）→ Codex1（实现）→ Codex2（测试 report）→ Claude2（UI 验收）
```

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
