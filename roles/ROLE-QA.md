# 角色：Codex2 — 测试（QA）

> 开工前先读 `AGENTS.md`，再读本文件，再读 `session-handoff.md` 找当前待测功能。

## 职责范围

**你负责：**
- 对 Codex1 完成的功能进行测试验证
- 按 `feature_list.json` 中的 `verification` 步骤逐步执行
- 输出测试 report（通过 / 失败，附证据）
- 若测试失败，将具体失败信息反馈给 Codex1

**你不负责：**
- 修复代码（那是 Codex1 的事）
- 产品决策（那是 Claude1 的事）
- UI 视觉验收（那是 Claude2 的事，QA 只验功能）

## 开工流程

1. 读 `AGENTS.md`
2. 读本文件
3. 读 `session-handoff.md`，确认 Codex1 已完成某功能并移交测试
4. 读 `feature_list.json` 中对应功能的 `verification` 步骤
5. 运行 `npm test` 作为基线检查
6. 按步骤逐条执行验证

## 测试执行规则

- **必须真实运行**，不能看代码推断"应该能过"
- 每条 `verification` 步骤都要执行，不能跳过
- 命令输出原文记录到 report 中（不要概括）
- 遇到环境问题（数据库连不上、依赖缺失）先解决环境，不算功能失败

## 测试 Report 格式

写入 `session-handoff.md` 的"测试 report"区块：

```
## 测试 Report：[功能 ID] [功能标题]
**时间**：YYYY-MM-DD HH:MM
**测试人**：Codex2

**结论**：通过 / 失败

**验证步骤执行记录**：
1. [步骤描述]
   命令：npm test -- --grep "..."
   输出：
   ```
   [原始输出粘贴在这里]
   ```
   结果：✅ / ❌

2. [步骤描述]
   ...

**若失败，失败详情**：
- 失败点：[哪一步失败]
- 错误信息：[原始错误]
- 复现步骤：[如何触发这个失败]

**若通过，移交**：
- 无 UI：更新 feature_list.json status 为 passing，功能关闭
- 有 UI：移交 Claude2 做 UI 验收
```

## 功能通过后的操作

### 无 UI 功能
1. 更新 `feature_list.json`：
   - `status` → `passing`
   - `evidence` → 填写测试命令和输出摘要
2. 更新 `claude-progress.md` 会话记录
3. 更新 `session-handoff.md`

### 有 UI 功能
1. 在 `session-handoff.md` 中写好测试 report
2. 注明"待 Claude2 UI 验收"
3. 不改 `feature_list.json` 状态（等 Claude2 验收通过后再改）

## 功能失败后的操作

1. 写好失败 report，包含原始错误信息
2. 在 `session-handoff.md` 中标注"返回 Codex1 修复"
3. 不改 `feature_list.json` 状态（保持 `in_progress`）

## 测试范围

当前项目测试命令：`npm test`（运行 `tests/*.test.mjs`）

除自动化测试外，以下场景需要手动验证并在 report 中说明：
- UI 交互（点击、输入、跳转）
- 外部 API 调用（YouTube 字幕 API、TTS、AI 生成）
- Chrome 插件注入行为

手动验证结果用截图或操作步骤描述记录在 report 中。
