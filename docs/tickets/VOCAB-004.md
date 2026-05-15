# VOCAB-004 — 生词系统升级：词典查询 + 出处追踪 + 生词本展示

**优先级**：P1 | **负责人**：Codex1 | **日期**：2026-05-15  
**前置依赖**：VOCAB-001 ✅、VOCAB-002 ✅、WEB-005 ✅、COURSE-003（并行可以，课文点词功能等 COURSE-003 完成后接入）

---

## 背景

当前查词卡片（LookupCard）只返回 lemma + 简单释义，WordEncounter 已存视频出处但没有课文出处，/vocab 生词本展示信息也较少。

本 ticket 把三件事合并做完：
1. **查词升级**：接入有道词典 API，返回完整词典数据
2. **出处追踪**：区分视频出处和课文出处，统一存入 WordEncounter
3. **生词本升级**：每个词展示词典内容 + 所有出处（可跳回）

---

## 一、新建 `/api/vocab/lookup`

### 接口

```
GET /api/vocab/lookup?word=vivían
```

### 处理流程

```
1. 词形还原（复用现有 /api/lemmatize 逻辑）→ vivir
2. 查 Redis：key = vocab:dict:vivir
   命中 → 直接返回
3. 未命中 → 调有道智云词典 API
4. 写入 Redis（永久缓存，词典数据不会变）
5. 返回结构化词典数据
```

### 返回格式

```json
{
  "word": "vivían",
  "lemma": "vivir",
  "partOfSpeech": "v.",
  "meanings": [
    { "zh": "住，居住", "es": "tener su domicilio en un lugar" },
    { "zh": "生活，过日子", "es": "pasar la vida de cierto modo" }
  ],
  "examples": [
    { "es": "Vivo en Madrid desde hace tres años.", "zh": "我在马德里住了三年了。" },
    { "es": "¿Cómo vives con ese sueldo?", "zh": "你靠那点工资怎么生活？" }
  ],
  "phonetic": "bi.ˈβiɾ"
}
```

### 有道智云 API

- 接口文档：有道智云「文本翻译」+「词典」接口
- 环境变量（新增到 .env）：`YOUDAO_APP_KEY` / `YOUDAO_APP_SECRET`
- 若有道接口不可用，降级到腾讯 TMT 只返回 meanings，examples 为空，不报错

---

## 二、Prisma 模型扩展

### Word 表新增字段

```prisma
model Word {
  // 现有字段保持不变
  id          String   @id @default(cuid())
  userId      String
  lemma       String
  // ...

  // 新增
  dictData    Json?    // 存储完整词典数据（meanings + examples + phonetic）
  partOfSpeech String? // 冗余存一份便于查询
}
```

### WordEncounter 表新增字段

```prisma
model WordEncounter {
  // 现有字段保持不变
  sourceUrl    String?
  timestampSec Int?
  // ...

  // 新增
  sourceType   String  @default("video")  // "video" | "course"
  courseRef    String? // 课文出处，如 "unidad-3 / 对话1 / 第2行"
}
```

生成并应用 migration：
```bash
npx prisma migrate dev --name add_dict_and_source_tracking
```

---

## 三、升级 LookupCard

当前：只显示 lemma + 简单释义 + 加入词库按钮。

升级后布局：

```
┌─────────────────────────────────────┐
│  vivir   v.                         │
│  /bi.ˈβiɾ/                          │
│                                     │
│  ① 住，居住                          │
│  ② 生活，过日子                       │
│                                     │
│  例句                                │
│  Vivo en Madrid desde hace 3 años.  │
│  我在马德里住了三年了。                 │
│                                     │
│  出处：[单元3 对话1] / [视频 02:34]   │
│                                     │
│       [ 加入生词表 ]                  │
└─────────────────────────────────────┘
```

- 加载时显示 skeleton，数据到了再渲染
- 有道 API 失败时降级显示基础释义，不报错
- "加入生词表"点击后调用 `/api/vocab/add`，同时传入出处信息

### 出处信息的传入方式

LookupCard 接收新 prop：
```ts
source: {
  type: "video"
  url: string        // 视频 URL
  timestampSec: number
  sentence: string   // 原句
} | {
  type: "course"
  courseRef: string  // "unidad-3 / 对话1 / 第2行"
  sentence: string   // 原句
}
```

调用方（视频播放器 / 课文页面）负责传入正确的 source。

---

## 四、升级 `/api/vocab/add`

新增接受字段：
```json
{
  "lemma": "vivir",
  "form": "vivían",
  "dictData": { ...词典数据... },
  "partOfSpeech": "v.",
  "sourceType": "video",
  "sourceUrl": "https://...",
  "timestampSec": 154,
  "courseRef": null,
  "originalSentence": "Vivían en el campo.",
  "translatedSentence": "他们住在乡下。"
}
```

保存时：Word.dictData + Word.partOfSpeech + WordEncounter.sourceType + WordEncounter.courseRef 一并写入。

---

## 五、升级 `/vocab` 生词本页面

每个词条展示：

```
vivir   v.   住，居住 / 生活，过日子
  │
  ├── 📺 视频出处
  │     Dreaming Spanish — La ciudad   02:34  [跳回 →]
  │     "Vivían en el campo antes de mudarse."
  │
  └── 📖 课文出处
        unidad-3 / 对话1 / 第2行          [查看 →]
        "¿Dónde está la biblioteca?"
```

- 视频出处：点击"跳回"→ `/watch?v=...&t=154`（现有 VOCAB-003 逻辑）
- 课文出处：点击"查看"→ `/learn/unidad-3#dialogo-1`

---

## 验收标准

1. `GET /api/vocab/lookup?word=vivían` 返回完整词典数据（lemma + meanings + examples）
2. Redis 缓存生效：同一词第二次请求 < 10ms
3. LookupCard 显示词性、义项、例句
4. 视频出处和课文出处都正确存入 WordEncounter
5. `/vocab` 页面展示出处列表，视频出处可跳回
6. 有道 API 不可用时降级静默，不影响加入词库功能
7. `npm test` 通过
8. `npm run build` 通过

---

## 不在本 ticket 范围内

- 课文页面的点词交互（等 COURSE-003 完成后，在 COURSE-003 基础上接入 LookupCard，courseRef 由课文页面传入）
- 生词复习 / 间隔重复功能
- 生词导出
