# CORPUS-001 — 语料库重构(视频历史 / 单词 / 短语 三 tab)

**优先级**：P1（移动端 epic 内,语料库是底部 4-tab 之一）
**区域**：`/vocab`(更名展示为「语料库」)+ 新后端(视频浏览历史 / 短语收藏)+ 前端 3-tab 页
**设计**：design 子 agent（Gemini1 已不可用,PM 派子 agent）
**实现**：Codex1（前 + 后端）
**测试**：Codex2 + 用户真机 + PM 验收
**预估**：3 天（含两个新后端）
**替代/合并**：MOBILE-005（vocab 生词本移动端,占位）→ 并入本票

---

## 背景与目标

底部第 4 个 tab 「语料库」（路径仍 `/vocab`，对外展示名统一为**语料库**，弃用「词库」）重构为**三个子 tab**：

1. **视频** — 该用户在本站的**视频浏览历史**，按日期分组（今天/昨天/具体日期）。
2. **单词** — 已收藏的单词（= 现有生词本）。
3. **短语** — 已收藏的短语。

## 现状对照（PM 调研 2026-06-03）

| 子 tab | 现状 | 工作量 |
|---|---|---|
| 单词 | ✅ 已有（`/vocab` VocabAccordion + vocab API 全套） | 复用，移动端重排 |
| 短语 | ⚠️ 短语能查（PHRASE-001：collocation/phrase/idiom，查词卡可弹），但**无"收藏短语到列表"能力** | **新建**：收藏入口 + 后端存 + 列表 |
| 视频历史 | 🆕 无（只有 wordEncounter「在哪遇到某词」、talk 聊天历史） | **全新**：后端记录 + 按日期分组列表 |

## 后端（Codex1）

### A. 视频浏览历史
- **记录粒度（PM 定）**：用户**打开播放页 `/watch?v=...` 就记一条**；同一视频重看 → 更新时间、置顶（upsert by userId+videoId）。
- 数据模型（Prisma）：`VideoView { id, userId, videoId, title, channelTitle, thumbnail?, viewedAt }`（或等价；title/channelTitle/thumbnail 记录当时快照,避免列表再查 YouTube 烧配额）。
- 记录时机：watch 页加载到有效视频时 POST `/api/watch/history`（登录用户才记；防抖避免重复写）。
- 列表 API：`GET /api/watch/history` 返回按 `viewedAt` 倒序，前端按日期分组。
- **注意配额**：列表用记录里的快照展示,**不要为历史列表再调 YouTube API**。

### B. 短语收藏
- 查词卡（LookupCard）短语查询结果上加**「收藏短语」**动作（类比现有"加入词库"）。
- 数据模型：扩展现有收藏体系或新 `SavedPhrase { id, userId, lemma, kind(collocation/phrase/idiom), data?, createdAt }`。
- API：`POST /api/vocab/phrase/add`、`GET` 列表（或并入 vocab API，加 kind 维度）。

### C. 单词
- 复用现有 vocab API，无需新后端。

## 前端（design 子 agent 设计 → Codex1）

- `/vocab` 页改为**语料库**：顶部三 tab「视频 / 单词 / 短语」切换。
- **视频 tab**：按日期分组的历史列表（今天/昨天/更早 或 具体日期分组头），每条 = 视频卡（缩略图/标题/频道/时间），点击进 `/watch?v=`。空态友好。
- **单词 tab**：现有 VocabAccordion（移动端重排,复用 MOBILE-000 查词抽屉若涉及点词）。
- **短语 tab**：收藏短语列表，点击可看释义/用法（弹查词抽屉）。
- **移动端优先**（本票在移动 epic 内）：复用 MOBILE-000 token / 翡翠绿 / 底部 tab 外壳；桌面端语料库同步可用、不回退。

## 验收标准

- [ ] `/vocab` 展示为语料库,三 tab（视频/单词/短语）可切。
- [ ] 视频 tab：打开过的视频按日期分组展示,点击可重新打开;重看置顶;列表不额外烧 YouTube 配额。
- [ ] 单词 tab：现有生词本功能无回退。
- [ ] 短语 tab：能从查词卡收藏短语,并在此列出/查看。
- [ ] 移动端三 tab 体验好（设计稿比对）+ 桌面不回退。
- [ ] 真机/设备模式实际打开三 tab 不崩、渲染正常。
- [ ] `npm test` 全绿 + `npm run build` + `lint:encoding` 通过。

## 流程（前后端协同 + 有 UI）

1. 后端 A/B：Claude1 → Codex1 → Codex2。
2. 前端：Claude1 → **design 子 agent 设计稿** → Codex1 → Codex2(真机) → 用户真机 → Claude1 验收。前端 tab 数据依赖后端,后端跑通再 unblock。

> 血泪三戒:改全站共享组件只换该改的、桌面不动;验收必须真机;勿带 scratch 文件;UTF-8 防乱码（label 用正确中文,lint:encoding 抓不到"合法但错误 CJK"）。
