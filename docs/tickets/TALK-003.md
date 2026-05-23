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

- **归档动作**（用户触发）：
  - **桌面（lg+）**：会话项 hover 显示 🗑 按钮
  - **移动（< lg）**：🗑 按钮**常显**在每条右侧（约 32×32 触摸区）。PM 决定（2026-05-23）：长按 ActionSheet 更原生但 web 无原生 API，常显胜在简单且符合 Esponal 克制审美
  - 点 🗑 弹确认「归档？归档后 7 天内可恢复，之后永久删除」
  - 点确认：`DELETE /api/talk/sessions/[id]` → 写 `status=ARCHIVED, updatedAt=now()`
  - 列表中立即移除
- **归档区**（可选 v1 跳过）：
  - 侧栏底部「归档（3）」可展开 → 看到 7 天内已归档的
  - 每条带「恢复」按钮 → 写回 `status=ACTIVE`
- **7 天清理**：
  - 新脚本 `scripts/cleanup-archived-sessions.mjs`
  - 删除 `status=ARCHIVED AND updatedAt < now() - 7 days` 的所有 ChatSession（级联清掉 ChatMessage）
  - **Vercel Cron Job**：`vercel.json` 加 cron 配置，每天凌晨跑一次
- **API 防御**：
  - GET /history 默认只返回 ACTIVE
  - GET /history?includeArchived=true 才返回归档

### 不做

- ❌ 真删时通知用户（不刚需，他们当时点归档就接受了）
- ❌ "导出会话"按钮（YAGNI；以后做）
- ❌ 用 Prisma soft-delete 中间件（直接靠 status 字段已足够）

## 验收

- [ ] hover 会话项看到🗑按钮
- [ ] 点🗑 → 确认对话 → 列表立即移除
- [ ] DB 里该 session 仍存在，`status='ARCHIVED'`
- [ ] 归档抽屉里能找回并恢复（v1 可选）
- [ ] 跑 `node scripts/cleanup-archived-sessions.mjs` 删掉 7 天前的归档
- [ ] `vercel.json` 配 cron，每天 03:00 UTC 调清理 endpoint
- [ ] 归档不影响 ACTIVE 会话列表
- [ ] 200/200 测试通过

## 技术草图

```js
// scripts/cleanup-archived-sessions.mjs
const cutoff = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000);
const result = await prisma.chatSession.deleteMany({
  where: { status: "ARCHIVED", updatedAt: { lt: cutoff } }
});
console.log(`Deleted ${result.count} archived sessions older than 7 days`);
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
