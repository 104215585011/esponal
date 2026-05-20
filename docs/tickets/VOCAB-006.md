# VOCAB-006 — SRS 词库复习（FSRS 变位卡）

**优先级**：P1  
**区域**：vocabulary  
**依赖**：VOCAB-005 ✅（词库 + 变位数据已有）

---

## 背景

用户现在能把单词加入词库，但没有主动复习机制。学习科学表明，只遭遇不复习的单词 2-3 天后遗忘率超 70%。  
本票接入 FSRS（自由间隔重复调度算法），让用户在 `/vocab/review` 按卡片复习到期词，系统根据回答难度智能安排下次复习时间。

**设计原则**：复习可选触发（不强制弹出提醒）；流程轻量（不打断看视频的节奏）；首次体验无压力。

---

## 用户故事

- 用户访问 `/vocab/review`，看到 N 张今日到期词卡
- 每张卡：正面显示西语 lemma（可点 🔊 听音），背面显示中文义项、词性、例句、变位/词形
- 用户看完背面，按「又忘了」/「难」/「记得」/「很熟」评分（FSRS 四档）
- 评分后 FSRS 计算下次到期日，写回数据库
- 所有到期词复习完后显示完成页，统计今日复习/新学数量
- `/vocab` 词库页在词条旁显示「N 词待复习」徽章

---

## 技术方案

### 1. 依赖

```bash
npm install ts-fsrs
```

`ts-fsrs` 是 MIT 许可的 TypeScript FSRS 实现，与 Anki 同算法。

### 2. Schema 变更（在 Word 模型增加 SRS 字段）

```prisma
model Word {
  # 现有字段 …
  
  # FSRS 字段（nullable，首次复习时初始化）
  srsState      String?   # "New" | "Learning" | "Review" | "Relearning"
  srsDue        DateTime? # 下次到期时间（null = 尚未加入复习队列）
  srsStability  Float?    # FSRS stability
  srsDifficulty Float?    # FSRS difficulty
  srsElapsedDays Int?
  srsScheduledDays Int?
  srsReps       Int       @default(0)
  srsLapses     Int       @default(0)
  srsLastReview DateTime?
}
```

新建迁移：`prisma migrate dev --name add_srs_fields`

### 3. 后端

**`src/lib/srs.ts`** — FSRS 工具函数

```ts
import { FSRS, Rating, createEmptyCard, generatorParameters } from 'ts-fsrs';

const params = generatorParameters(); // 默认参数
export const fsrs = new FSRS(params);

// 初始化一张新卡
export function initCard() {
  return createEmptyCard();
}

// 评分后得到新状态
export function scheduleCard(card: Card, rating: Rating, now: Date) {
  const records = fsrs.repeat(card, now);
  return records[rating].card;
}
```

**`src/app/api/vocab/review/route.ts`** — GET 返回今日到期词（最多 20 条）

```
GET /api/vocab/review
→ { dueWords: Word[], totalDue: number }
```

查询条件：`srsDue <= now OR srsDue IS NULL（新词加入队列）`，limit 20

**`src/app/api/vocab/review/[wordId]/route.ts`** — POST 提交评分

```
POST /api/vocab/review/:wordId
Body: { rating: "Again" | "Hard" | "Good" | "Easy" }
→ { nextDue: ISO8601, state: string }
```

权限：必须已登录（401 unauth）。

### 4. 前端页面

**`src/app/vocab/review/page.tsx`** — 复习页（客户端 + 服务端混合）

布局（320-680px 居中，类似 Anki web）：

```
┌────────────────────────┐
│  今日复习 3/12          │
│  ────────────────────  │
│                        │
│   caminar              │  ← lemma（大号，serif）
│   🔊                   │
│                        │
│  ┌────────────────────┐│
│  │    显示答案        ││  ← 点击翻牌
│  └────────────────────┘│
└────────────────────────┘

翻牌后：
│   caminar              │
│   🔊                   │
│   v.  行走，步行       │
│   "Camino 5 km..."     │
│   ─────────────────    │
│  又忘了  难   记得  很熟  │  ← 四档评分按钮
```

状态机：`{ queue, currentIndex, showBack, sessionStats }`

评分按钮颜色：
- 「又忘了」→ `text-red-600`
- 「难」→ `text-orange-500`
- 「记得」→ `text-brand-600`
- 「很熟」→ `text-green-600`

完成屏：今日复习 N 词，其中 M 词为新词，「回到词库 →」

**`src/app/vocab/page.tsx`** — 在页面顶部或侧边加「N 词待复习」徽章 + 按钮跳转 `/vocab/review`

### 5. 新词入队策略

用户首次使用复习功能时，词库中所有状态为 `srsState IS NULL` 的词都视为「New」，按创建时间排序，每日最多加入 10 个新词（避免首日压垮）。

### 6. 音频

复习页 lemma 旁 🔊 按钮调用现有 `speak()` → `/api/tts`（AUDIO-002 ✅）

---

## 验收标准

| # | 检查项 |
|---|--------|
| 1 | `npm install ts-fsrs` 成功，`package.json` 含依赖 |
| 2 | Prisma migration `add_srs_fields` 成功，`Word` 含 8 个 SRS 字段 |
| 3 | `src/lib/srs.ts` 导出 `initCard / scheduleCard / fsrs` |
| 4 | `GET /api/vocab/review` 返回 `{ dueWords, totalDue }`，未登录 401 |
| 5 | `POST /api/vocab/review/:wordId { rating }` 更新 SRS 字段，返回 nextDue |
| 6 | `/vocab/review` 页存在，正面显示 lemma + 🔊，翻牌显示义项/例句 |
| 7 | 四档评分按钮提交后卡片出列，进入下一张 |
| 8 | 所有词复习完后显示完成屏 |
| 9 | `/vocab` 页顶部显示「N 词待复习」数量（N=0 时不显示） |
| 10 | `npm test` 通过，`npm run build` 通过 |

---

## 不在本票范围

- 推送提醒（每日到期提醒通知）
- 复习历史记录与统计图
- 自定义 FSRS 参数
- 错词练习（只有评分，无输入）
- 新词每日上限的 UI 设置

---

## 文件触动清单

| 文件 | 变更 |
|------|------|
| `prisma/schema.prisma` | Word 新增 8 个 SRS 字段 |
| `prisma/migrations/…/migration.sql` | 新建 |
| `package.json` | 新增 `ts-fsrs` |
| `src/lib/srs.ts` | 新建 |
| `src/app/api/vocab/review/route.ts` | 新建（GET） |
| `src/app/api/vocab/review/[wordId]/route.ts` | 新建（POST） |
| `src/app/vocab/review/page.tsx` | 新建 |
| `src/app/vocab/page.tsx` | 新增待复习徽章 |
| `tests/vocab006.test.mjs` | 新建 |
| `feature_list.json` | 新增 VOCAB-006 |
