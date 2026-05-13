# Session Handoff — Esponal

> 每轮会话结束时填写，下一轮开始时先读。

---

## 当前已验证

- `INFRA-001` 脚手架：✅ 通过（`npm test` scaffold 测试通过）
- 所有其他功能：`not_started`

## 本轮改动（会话 #1，2026-05-13）

**新增文件**：
- `docs/superpowers/specs/2026-05-13-esponal-design.md` — 产品设计文档
- `CLAUDE.md` — Claude Code 根指令
- `AGENTS.md` — Codex/Agent 根指令
- `roles/ROLE-PM.md` — Claude1 PM 角色说明
- `roles/ROLE-UI.md` — Claude2 UI 总监角色说明
- `roles/ROLE-DEV.md` — Codex1 开发角色说明
- `roles/ROLE-QA.md` — Codex2 测试角色说明
- `feature_list.json` — 功能清单（10 个功能，1 个 passing，9 个 not_started）
- `claude-progress.md` — 进度日志
- `session-handoff.md` — 本文件
- `clean-state-checklist.md` — 收尾检查清单
- `evaluator-rubric.md` — 评审评分表
- `quality-document.md` — 质量快照
- `init.sh` — 启动脚本

**未改动**：src/ 目录所有代码文件

## 仍损坏或未验证

无代码层面的问题。以下是已知的产品/技术风险：
- MiniMax API（aicodee.com）需要配置 `.env`，尚未测试连通性
- Prisma 数据库迁移尚未运行（只有 NextAuth 相关表）
- Chrome 插件目录尚不存在

## 下一步最佳动作

**Claude1（PM）下一轮开工**：
1. 读 `CLAUDE.md` → `roles/ROLE-PM.md` → 本文件
2. 启动 `VOCAB-001`，写 ticket，交给 Codex1
3. `VOCAB-001` 无 UI 相关，不需要 Claude2 评审

**Codex1 收到 ticket 后**：
1. 读 `AGENTS.md` → `roles/ROLE-DEV.md` → 本文件 → ticket
2. 在 Prisma schema 中新增 Word、WordEncounter 表
3. 运行 `npm run prisma:migrate`
4. 写单元测试验证 CRUD
5. 完成后写好 handoff，交给 Codex2 测试

## 不要动的东西

- `.env.example` 的格式（新增变量要同步更新它）
- `tests/scaffold.test.mjs`（不改已通过的测试）
- `prisma/schema.prisma` 里已有的 User/Account/Session/VerificationToken 表

## 命令参考

```bash
# 启动开发服务器
npm run dev

# 跑测试
npm test

# 数据库迁移
npm run prisma:migrate

# 生成 Prisma Client
npm run prisma:generate

# 构建
npm run build
```

---

*最后更新：2026-05-13，会话 #1，Claude（PM + 设计）*
