# Clean State Checklist — Esponal

> 每次会话结束前逐项检查，确保下一轮可以直接开工。

---

## 收尾前必过的检查

### 基础状态

- [ ] `npm test` 通过（无失败用例）
- [ ] `npm run build` 通过（无构建错误）
- [ ] `npm run dev` 能正常启动（手动验一下）
- [ ] 没有未保存的文件修改

### 代码状态

- [ ] 没有半成品代码（`TODO`、`FIXME`、`console.log` 调试代码已清理）
- [ ] 没有注释掉的大段代码
- [ ] `.env` 中的 key 没有出现在任何代码文件中
- [ ] `git status` 干净（所有改动已 commit 或有意识地未 commit）

### 文档状态

- [ ] `feature_list.json` 反映了真实状态：
  - 通过的功能有 `evidence` 记录
  - 没有"假 passing"（没有证据就标 passing）
  - 同时最多只有一个 `in_progress`
- [ ] `claude-progress.md` 已更新本轮会话记录
- [ ] `session-handoff.md` 已填写，下一轮能直接看懂
- [ ] `quality-document.md` 如有重要进展已更新

### 交接状态

- [ ] `session-handoff.md` 中写清楚了：
  - 当前已验证的功能
  - 本轮改了什么文件
  - 仍有问题的地方
  - 下一步最佳动作
  - 不要动的东西
- [ ] 如果有阻塞，已在 handoff 中写明，等待对应角色处理
- [ ] 下一轮会话不需要人工干预就能继续推进

---

## 快速判断：这轮干净吗？

**干净**：新会话的 agent 读完 `session-handoff.md` 就知道从哪里开始，不需要你解释。

**不干净**：有任何东西只存在于你的记忆中，没有写进文件里。
