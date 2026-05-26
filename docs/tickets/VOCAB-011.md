# VOCAB-011 — 词汇仪表盘

**优先级**：P2
**区域**：vocab
**依赖**：VOCAB-010（已标记状态完成后数据更可信）

---

## 背景

用户在各个场景收藏了单词，但现有词库页只有一个平铺列表，
看不到"我总共积累了多少词""哪些词我反复遇到了"。
缺乏进度感，用户不知道自己是否在进步。

---

## 范围

### 做

在现有 `/vocab` 词库页**顶部**加一个仪表盘区块，展示：

**核心数字（3 个卡片横排）**：
```
[已收藏]    [遇到 3+ 次]    [本周新增]
  128 词       42 词          7 词
```

**遭遇分布条（简单横向进度条组）**：
```
遇到 1 次    ████░░░░░░  58 词
遇到 2 次    ███░░░░░░░  28 词
遇到 3-5 次  ██░░░░░░░░  32 词
遇到 6+ 次   █░░░░░░░░░  10 词
```

**来源分布（小 badge 列表）**：
```
阅读 62  ·  视频 31  ·  对话 24  ·  课程 11
```

### 数据来源

- 已收藏数：`Word` 表 count（当前用户）
- 遭遇次数：`WordEncounter` 表 group by lemma count
- 本周新增：`Word.createdAt >= now() - 7 days`
- 来源分布：`WordEncounter.sourceType` group by

### 新增 API

`GET /api/vocab/stats` 返回：
```json
{
  "totalSaved": 128,
  "encounterBuckets": [
    { "label": "1 次", "min": 1, "max": 1, "count": 58 },
    { "label": "2 次", "min": 2, "max": 2, "count": 28 },
    { "label": "3–5 次", "min": 3, "max": 5, "count": 32 },
    { "label": "6+ 次", "min": 6, "max": null, "count": 10 }
  ],
  "weeklyNew": 7,
  "bySource": [
    { "type": "lectura", "label": "阅读", "count": 62 },
    { "type": "video", "label": "视频", "count": 31 },
    { "type": "talk", "label": "对话", "count": 24 },
    { "type": "course", "label": "课程", "count": 11 }
  ]
}
```

未登录时返回 401。

### 不做

- ❌ 图表（折线图、饼图）——纯数字 + 条形足够
- ❌ 词汇测验入口（另票）
- ❌ 「掌握」判定算法（另议）

## UI 要求

- 仪表盘区块与词列表之间加 `border-b border-gray-100 mb-6 pb-6`
- 3 个数字卡片：`rounded-card border border-gray-100 bg-surface p-4 text-center`
- 数字：`text-3xl font-bold text-gray-900`，标签：`text-xs text-gray-500 mt-1`
- 进度条：`bg-brand-100 rounded-full h-1.5`，已填充部分 `bg-brand-500`
- 未登录时仪表盘区块不显示（不影响词列表）
- 加载中：3 个卡片骨架（`animate-pulse bg-gray-100`）

## 验收标准

- [ ] `GET /api/vocab/stats` 返回正确数据结构
- [ ] 词库页顶部显示 3 个数字卡片
- [ ] 遭遇分布 4 档条形正确渲染
- [ ] 来源分布 badge 列表显示
- [ ] 未登录时区块不渲染
- [ ] 加载中有骨架态
- [ ] npm test 通过

## 成本估计

**1 天**
