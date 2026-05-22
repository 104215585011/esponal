# TALK-002 — 会话列表 + 多会话切换 + 标题

**优先级**：P1（核心 UX，类 ChatGPT/Claude 体验）
**区域**：talk / web
**依赖**：TALK 集成 P3 ✅

---

## 背景

目前 `/talk/[characterId]` 是「一个角色 = 一条永远延续的对话」。
学习者无法：

- 开一个新话题（必须延续旧上下文，跑题）
- 回看上周和 Carlos 聊过的内容
- 同一角色保留多个独立场景（比如「点餐」「面试」「日常闲聊」并行）

数据库已经支持——`ChatSession` 有 `id/userId/characterId/title/status` 字段。只是 UI 没暴露。

## 范围

### 做

- **左侧栏会话列表**（参考 ChatGPT 布局，桌面 lg+）：
  - 当前角色的所有 ACTIVE 会话，按 `updatedAt desc`
  - 顶部「+ 新对话」按钮 → 清空 sessionId → 下次发送开新 session
  - 每条显示：标题（截断 30 字） + 相对时间（「3 小时前」）
  - 当前激活的高亮
- **移动端**：抽屉式（汉堡按钮打开），不抢屏
- **标题自动生成**：
  - 默认：第一条用户消息的前 30 字（当前 chat-service 已用 80）
  - **优化**：会话超过 4 轮后，调一次 DeepSeek 生成 5-10 字精炼标题，调用便宜
  - 新 API：`POST /api/talk/sessions/[id]/retitle`，由前端在 message 第 4 轮 done 时触发
- **切换会话**：点会话项 → 路由变 `/talk/[characterId]?session={id}` → 拉历史 → 渲染

### 不做（本 ticket 范围外）

- ❌ 跨角色搜索（推迟到独立 ticket）
- ❌ 会话置顶 / 分组 / 文件夹（YAGNI）
- ❌ 编辑标题（重命名不刚需，自动生成够好用了）

## 验收

- [ ] 进入 Carlos 角色，左侧看到历史会话列表（如无则空状态）
- [ ] 点「+ 新对话」开一条新 session，左侧立即多一条「（新会话）」
- [ ] 发送第一条消息后，左侧条目标题刷新为消息前 30 字
- [ ] 4 轮对话后，标题自动收敛成 LLM 生成的精炼标题
- [ ] 点任意旧会话 → 路由 + 内容切换，AI 接续旧上下文
- [ ] URL `?session=` 参数与 sessionState 同步（刷新页保留位置）
- [ ] 移动端 lg 以下，列表收起为汉堡抽屉

## 技术草图

```
路由：
  /talk                              → 角色卡片列表（已有）
  /talk/[characterId]                → 默认新会话
  /talk/[characterId]?session={id}   → 指定会话

新 API：
  GET  /api/talk/sessions?characterId=X
       → [{id, title, updatedAt, lastMessagePreview}]
  POST /api/talk/sessions/[id]/retitle
       → 调 DeepSeek 摘要 → UPDATE chatSession.title

UI 组件：
  TalkSidebar (client) — 列表 + 新对话按钮
  TalkClient → 接受 initialSessionId prop，listen url change
```

## 成本估计

**1.5-2 天**（路由 + 侧栏 + 标题 API + URL 同步 + 移动端抽屉）
