# READ-001 — 阅读记录（数据库绑定）

**优先级**：P2
**区域**：lectura
**依赖**：VOCAB-001（Prisma + NextAuth 用户体系已存在）

---

## 背景

现在 `/lectura` 列表页 35 篇短文一视同仁，用户读完之后下次进来
不知道哪些读过、哪些没读过。阅读记录绑定数据库账号，换设备也能看到。

---

## 范围

### 做

**数据模型**：新 Prisma model `LecturaRead`：
```prisma
model LecturaRead {
  id     String   @id @default(cuid())
  userId String
  slug   String
  readAt DateTime @default(now())
  user   User     @relation(fields: [userId], references: [id], onDelete: Cascade)

  @@unique([userId, slug])
  @@map("lectura_reads")
}
```

**标记时机**：
- 自动：用户在 `/lectura/[slug]` 滚动到文章 **90% 位置**时静默写入
- 手动兜底：文章顶部有「标记为已读」按钮，已读后变为「已读 ✓」不可点

**API**：
- `POST /api/lectura/[slug]/read` — 写入（幂等）
- `GET /api/lectura/reads` — 返回当前用户已读 slug 数组

**列表页**：
- 已读文章卡片右上角加 `✓` 绿色小徽章（`bg-emerald-50 text-emerald-600`）
- 页面顶部一行：`已读 12 / 35 篇`（`text-sm text-gray-500`）

**详情页**：
- 已读状态在面包屑旁显示 `已读 ✓` badge
- 滚动触发后 badge 出现，无需刷新页面

**未登录**：不调用 API，不显示状态，文章底部提示「登录后可保存阅读记录」

### 不做

- ❌ 阅读时长 / 进度百分比
- ❌ 强制顺序阅读

## 验收标准

- [ ] Prisma migration 创建 `lectura_reads` 表，`@@unique([userId, slug])`
- [ ] `POST /api/lectura/[slug]/read` 写入，幂等无副作用
- [ ] `GET /api/lectura/reads` 返回已读 slug 数组
- [ ] 详情页滚动 90% 自动标记
- [ ] 详情页手动「标记为已读」按钮存在，已读后变「已读 ✓」不可点
- [ ] 列表页已读文章显示 `✓` 徽章
- [ ] 列表页顶部显示「已读 X / 35 篇」
- [ ] 未登录无报错，不显示状态
- [ ] npm test 通过

## 成本估计

**1 天**
