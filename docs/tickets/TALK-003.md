# TALK-003 — 归档会话 + 7 天后自动清理

**优先级**：P2（数据生命周期 + 隐私 + 列表整洁）
**区域**：talk / infra
**依赖**：TALK-002（会话列表 UI）

---

## 背景

会话越攒越多，左侧栏会爆。学习者偶尔的「试一试」会话应该容易删掉，
但**直接物理删除**违反"敏感对话保留窗口"的 best practice
（万一用户后悔，或者要回看），所以做**软删除 + 7 天宽限期**。

`ChatSession.status` 已有 `ACTIVE / ARCHIVED` enum——schema 不动。

## 范围

### 做

- **数据模型变更**（PM 2026-05-25 澄清）：
  - `ChatSession` 新增 `archivedAt: DateTime?` 列（migration 必需）
  - 不能复用 `updatedAt` 来推算归档时间——updatedAt 任何 SQL 更新都会改，倒计时会被意外重置。`archivedAt` 一旦写入就**只在恢复时清空**，其他逻辑不动它

- **归档动作**（用户触发）：
  - **桌面（lg+）**：会话项 hover 显示 🗑 按钮
  - **移动（< lg）**：🗑 按钮**常显**在每条右侧（约 32×32 触摸区）。PM 决定（2026-05-23）：长按 ActionSheet 更原生但 web 无原生 API，常显胜在简单且符合 Esponal 克制审美
  - 点 🗑 弹确认「归档此对话？归档后 7 天内可恢复，之后永久删除」
  - 点确认：`DELETE /api/talk/sessions/[id]` → 一次性写 `status=ARCHIVED` + `archivedAt=now()`
  - 列表中立即移除
- **归档区**（可选 v1 跳过）：
  - 侧栏底部「归档（3）」可展开 → 看到 7 天内已归档的
  - 每条带「恢复」按钮 → 写回 `status=ACTIVE`
- **恢复动作**（如果做 v1 归档抽屉）：
  - `POST /api/talk/sessions/[id]/restore` → 写 `status=ACTIVE` + `archivedAt=null`（清空，重新计时不再生效）

- **7 天清理**（**归档后 +7 天才删，不是创建后 +7 天**）：
  - 新脚本 `scripts/cleanup-archived-sessions.mjs`
  - SQL 条件：`status='ARCHIVED' AND archivedAt < now() - INTERVAL '7 days'`（Prisma: `archivedAt: { lt: new Date(Date.now() - 7*24*60*60*1000) }`）
  - 级联清掉 ChatMessage（依赖 Prisma 关系的 onDelete: Cascade，schema 里要确保已配；如果没有，migration 同时补上）
  - **Vercel Cron Job**：`vercel.json` 加 cron 配置，每天凌晨跑一次
- **API 防御**：
  - GET /history 默认只返回 ACTIVE
  - GET /history?includeArchived=true 才返回归档

### 不做

- ❌ 真删时通知用户（不刚需，他们当时点归档就接受了）
- ❌ "导出会话"按钮（YAGNI；以后做）
- ❌ 用 Prisma soft-delete 中间件（直接靠 status 字段已足够）

## 验收

- [ ] Prisma migration 加 `ChatSession.archivedAt: DateTime?` 列
- [ ] DELETE /api/talk/sessions/[id] 一次性写 `status=ARCHIVED` + `archivedAt=now()`
- [ ] hover 会话项看到🗑按钮（桌面 group-hover；移动端 < lg 常显）
- [ ] 点🗑 → 确认对话 → 列表立即移除
- [ ] DB 里该 session 仍存在，`status='ARCHIVED'`、`archivedAt` 有时间戳
- [ ] 归档抽屉里能找回并恢复（v1 可选）；恢复后 `archivedAt=null`
- [ ] 跑 `node scripts/cleanup-archived-sessions.mjs` 删掉 `archivedAt < now() - 7 days` 的 session（**归档后 +7 天，不是 updatedAt**）
- [ ] 关联 ChatMessage 级联删除（Prisma onDelete: Cascade）
- [ ] `vercel.json` 配 cron，每天 03:00 UTC 调清理 endpoint
- [ ] 测试覆盖：archive → 模拟 6 天后清理不删；archive → 模拟 8 天后清理删
- [ ] 归档不影响 ACTIVE 会话列表
- [ ] 200/N 测试通过

## 技术草图

```js
// scripts/cleanup-archived-sessions.mjs
const cutoff = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000);
const result = await prisma.chatSession.deleteMany({
  where: {
    status: "ARCHIVED",
    archivedAt: { lt: cutoff }  // 归档时刻 + 7 天，不是 updatedAt
  }
});
console.log(`Deleted ${result.count} archived sessions older than 7 days since archive`);
```

**Prisma schema 补丁**：

```prisma
model ChatSession {
  // ... 现有字段
  archivedAt DateTime? @map("archived_at")
  // 确保 messages 关系含 onDelete: Cascade，让级联删除工作：
  messages   ChatMessage[]  // 在 ChatMessage 那侧 @relation(..., onDelete: Cascade)
}
```

```json
// vercel.json
{
  "crons": [{
    "path": "/api/talk/cron/cleanup-archived",
    "schedule": "0 3 * * *"
  }]
}
```

注意：Vercel Cron 要求路由验证 `Authorization: Bearer $CRON_SECRET`，
新增 `CRON_SECRET` env 变量。

## 成本估计

**1 天**（归档 API + UI + 清理脚本 + cron 配置）
