# COURSE-005 — 西语骨架词系统（7 天起步课 + 句子拆解器）

**优先级**：P1（差异化核心功能）
**区域**：course / learn / tools
**依赖**：COURSE-003 ✅（多 unit 课程框架）、WEB-009 ✅（设计令牌）

---

## 背景

PM 教学观察：

> 大多数人学西语时**已经会英语**，但市面西语产品把所有词当"词汇"教，忽略了"功能词（function words）"这层骨架。

实际上一句西语里 40-60% 的词是功能词（代词、冠词、介词、连词、指示词、关系词等），约 ~70 个核心词覆盖几乎所有用法。剥离掉这些骨架，剩下的才是真正需要查词典的"内容词"。

**初学者的真问题**：他们不知道句子有"骨架 vs 内容"这层结构。market 上的"西语 100 词"教学不显式建立这个认知模型。

## 核心思路

教学法：**explicit instruction（讲清楚框架）→ guided practice（任意句子拆解验证）**

- **C 七天课**：用 7 节中文讲解课显式建立"骨架词"认知，每节聚焦一类
- **D 拆解器**：粘贴任意西语句子，自动按词性高亮，把骨架和内容词分开

两者**共享一份骨架词词典**，词典从 Wiktionary 等公开权威源整理。

---

## 架构总览

```
┌────────────────────────────────────────┐
│  data/function-words.json              │
│  ~70 条，每条 6 个字段（见下）            │
│  数据源：Wiktionary（CC-BY-SA）         │
└──────────────┬─────────────────────────┘
               │
       ┌───────┴────────┐
       │                │
┌──────▼──────┐  ┌──────▼──────────┐
│ /learn/     │  │ /dissect        │
│ foundation/ │  │ 句子拆解器       │
│ [day]       │  │ 独立工具页       │
│ 七天课       │  │                 │
│ 静态阅读     │  │                 │
└─────────────┘  └─────────────────┘
```

---

## 1. 共享词典：`data/function-words.json`

### 数据来源

主源：**Wiktionary 西语词条**（CC-BY-SA 3.0，需在词典文件头部注明出处与许可）

可选辅助源：
- **DRAE**（皇家西班牙语学院官方词典）—— 权威度高
- **Tatoeba**（句库）—— 提供真实例句
- **SpanishDict** —— 英语对照参考

Codex1 实施时选择爬取方式：API（MediaWiki / Kaikki.org）或手工录入（70 条 × 5 分钟 ≈ 6 小时）任选其一，**优先准确度**而非速度。

### 数据结构

```json
{
  "_meta": {
    "source": "Wiktionary (https://en.wiktionary.org)",
    "license": "CC-BY-SA 3.0",
    "lastUpdated": "2026-05-21"
  },
  "entries": {
    "con": {
      "category": "preposition",
      "english": "with",
      "chinese": ["和", "与", "用"],
      "examples": [
        { "es": "Café con leche", "en": "Coffee with milk", "zh": "加奶咖啡" },
        { "es": "Hablo con mi madre", "en": "I talk with my mother", "zh": "我和我妈说话" }
      ],
      "esEnContrast": "用法与英语 with 几乎完全一致。注意：con + mí/ti 变形为 conmigo/contigo。",
      "frequencyRank": 18
    },
    "se": {
      "category": "reflexive",
      "english": "-self / oneself",
      "chinese": ["自己", "彼此"],
      "examples": [
        { "es": "Se llama Ana", "en": "She is called Ana / Her name is Ana", "zh": "她叫 Ana" },
        { "es": "Se lavan las manos", "en": "They wash their hands", "zh": "他们洗手" }
      ],
      "esEnContrast": "英语极少有反身代词，西语必须用 se。Se llama 字面是\"自己叫自己\"，但相当于英语 \"is called\"。",
      "frequencyRank": 12
    }
  }
}
```

### 必含分类（category 枚举）

```
subject_pronoun       主语代词         yo / tú / él / ella / nosotros / vosotros / ellos / ellas
reflexive             反身代词         me / te / se / nos / os
object_pronoun        宾语代词         lo / la / le / los / las / les
article_definite      定冠词           el / la / los / las
article_indefinite    不定冠词         un / una / unos / unas
preposition           介词             a / de / en / con / por / para / sin / sobre / hasta / desde / hacia / entre
conjunction           连词             y / o / pero / sino / aunque / porque / si / cuando / mientras
demonstrative         指示词           este/a/os/as / ese/a/os/as / aquel/aquella/aquellos/aquellas / esto / eso / aquello
possessive            所有词           mi / tu / su / nuestro/a / vuestro/a / mío/a / tuyo/a / suyo/a
relative_interrogative 关系/疑问词     que / quien / donde / cuando / cómo / qué / cuál / cuándo / dónde
```

约 70-80 条总量。Codex1 可在实施时微调清单。

---

## 2. 七天课：`/learn/foundation/[day]`

### 路由与导航

- 新建路由：`/learn/foundation`（总览页）+ `/learn/foundation/[day]`（day-1 到 day-7）
- 在 `/learn` 页面顶部加 banner "✨ 新手起步 7 天" 引导用户进入
- 不替换现有 `/learn/phase-1` 等内容

### 每节结构（约 800-1500 中文字）

```
┌──────────────────────────────────────────┐
│ 第 N 天：[主题]                            │
│                                          │
│ ┌─ 引入（200-300 字） ────────────────┐  │
│ │ 为什么这类词重要？英语里你已经认识的"对  │  │
│ │ 应物"是什么？西语和英语的关键差异。    │  │
│ └──────────────────────────────────────┘  │
│                                          │
│ ┌─ 对照表 ──────────────────────────────┐ │
│ │ 西语 │ 英语 │ 中文 │ 一句例句         │ │
│ │ ─────┼──────┼──────┼─────────────── │ │
│ │ con  │ with │ 和   │ Café con leche  │ │
│ │ ...  │ ...  │ ...  │ ...             │ │
│ └──────────────────────────────────────┘  │
│                                          │
│ ┌─ 西英差异详解（400-800 字） ────────┐  │
│ │ por vs para / personal a 等特别要点  │  │
│ │ 配 5-10 个对照例句                   │  │
│ └──────────────────────────────────────┘  │
│                                          │
│ ┌─ 真实使用（200-400 字） ────────────┐  │
│ │ 3-5 句日常会话/文学引用，展示这类词在  │  │
│ │ 真语料里的密度                       │  │
│ └──────────────────────────────────────┘  │
│                                          │
│ [← 上一天]              [下一天 →]      │
└──────────────────────────────────────────┘
```

**静态阅读为主**，无翻牌、无测验、无音频。本次故意保持简洁。

### 七天大纲

| 天 | 主题 | 涵盖词 | 西英重点差异 |
|---|---|---|---|
| **1** | 主语代词 + 引出 ser/estar | yo/tú/él/ella/usted/nosotros/vosotros/ellos | 西语经常省略主语代词；usted 这种"敬语 you"英语没有 |
| **2** | 定冠词 + 不定冠词 | el/la/los/las/un/una/unos/unas | 性别+数量必须一致；西语用 the 比英语频繁（el español = Spanish） |
| **3** | 反身代词 | me/te/se/nos/os + 真反身/相互反身/无意义反身 | 英语几乎没有反身用法；se llama / se vende 这种结构 |
| **4** | 常用介词（重头戏）| a/de/en/con/por/para/sin/sobre/hasta/desde | por vs para 大区别；personal a；ir a + inf |
| **5** | 指示词 | este/ese/aquel + esto/eso/aquello | 西语 3 档（这/那/那个远的）vs 英语 2 档；中性指示词 |
| **6** | 连词 | y/o/pero/sino + porque/aunque/si/cuando | sino vs pero；y 在某些前缀前变 e（y → e）；o → u |
| **7** | 关系/疑问词 | que/quien/donde/cuando/como + qué/quién/dónde 等 | 重音号区别 que vs qué；西语关系从句结构 |

每天的内容由 Codex1 基于词典数据 + Wiktionary/SpanishDict 整理写就，中文输出。Codex1 写完后**PM 整体校对一遍**才能放出。

### 总览页 `/learn/foundation`

简短引言（200 字）+ 7 天卡片网格（每张：第 N 天、主题、预计阅读时长 5-8 分钟）。点卡片进入详情。

---

## 3. 句子拆解器：`/dissect`

### 用户流程

1. 用户打开 `/dissect`
2. 看到一个输入框 + "拆解" 按钮 + 默认占位例句（如 "Yo me lavo las manos con agua fría todos los días."）
3. 粘贴/输入西语句子，点拆解
4. 下方显示**带颜色标注的句子** + **拆解统计**

### 拆解输出形式

```
原句：
  Yo me lavo las manos con agua fría todos los días.

带标注的句子（颜色按 category 区分）：
  [Yo]ᵖʳᵒⁿ [me]ʳᵉᶠˡ lavo [las]ᵃʳᵗ manos [con]ᵖʳᵉᵖ agua fría [todos]ᵈᵉᵐ [los]ᵃʳᵗ días.

骨架词汇总：
  Yo     | 主语代词 | I
  me     | 反身代词 | myself
  las    | 定冠词   | the
  con    | 介词     | with
  todos  | 指示/数量 | every
  los    | 定冠词   | the

真正的内容词（你需要认识的）：
  lavo   | (动词，原形 lavar)
  manos  | (名词)
  agua   | (名词)
  fría   | (形容词)
  días   | (名词)

统计：12 个词中 6 个是骨架词（50%），6 个是内容词
```

每个骨架词可**点击展开**显示完整解释（来自 function-words.json 的 esEnContrast 字段）+ 跳转到对应天的课程链接。

### 实现

- 前端：`src/app/dissect/page.tsx` + 客户端组件处理输入/输出
- 解析：纯前端 JS，`tokenize(text)` → `for each token: lookup in dict` → 渲染
- 不需要 AI、不需要 API 调用、不需要服务端
- 标点处理：保留但不参与拆解；引号/破折号等 normalize

### 性能

70 条 dict 数据 ~30KB，前端一次性 import，O(1) Map 查找。任意句子拆解 < 10ms。

---

## 4. 视觉设计参考

`/dissect` 沿用现有设计令牌：
- 容器：`max-w-app-shell`（WEB-015）
- 输入框：参考 SiteHeader 搜索框风格（`rounded-full border border-gray-200 focus:ring-brand`）
- 类别颜色（建议）：
  - 主语代词 `bg-blue-50 text-blue-700`
  - 反身 `bg-purple-50 text-purple-700`
  - 冠词 `bg-amber-50 text-amber-700`
  - 介词 `bg-emerald-50 text-emerald-700`
  - 连词 `bg-rose-50 text-rose-700`
  - 指示词 `bg-cyan-50 text-cyan-700`
  - 所有词 `bg-fuchsia-50 text-fuchsia-700`
  - 关系/疑问 `bg-violet-50 text-violet-700`

**必须先过 Claude2 评审** UI 部分（拆解器视觉 + 课程页排版）。

七天课页面参考现有 `/grammar/[slug]` 风格（`max-w-3xl` 阅读宽度 + 中文长文 + 内嵌对照表）。

---

## 5. 实施分期

强烈建议分 3 期，每期可独立 commit + 测试：

### Phase 1：词典数据（独立可验证）

- 整理 ~70 条 `data/function-words.json`
- 写一个简单的 validator 脚本（确保每条字段完整、category 在枚举内、例句不为空）
- 跑 npm test 验数据完整性
- 完成标志：JSON 文件存在 + validator 0 错

### Phase 2：拆解器（依赖 Phase 1）

- `/dissect` 页面 + tokenize + 渲染 + 点击展开
- 不依赖 Phase 3
- 完成标志：粘贴任意句子能正确拆解显示

### Phase 3：七天课（依赖 Phase 1）

- 7 个 day 页面 + 总览页 + `/learn` 入口 banner
- 内容由 Codex1 撰写，PM 校对
- 完成标志：7 天内容齐全 + PM 阅读通过

Phase 2 和 Phase 3 可并行（共享 Phase 1 数据），但发版时打包发布。

---

## 6. 验收标准

| # | 检查项 |
|---|--------|
| 1 | `data/function-words.json` 存在，含 `_meta`（source、license、lastUpdated）+ `entries` 至少 60 条 |
| 2 | 每条 entry 必含 6 字段：category（枚举内）/ english / chinese（数组）/ examples（≥2 条）/ esEnContrast / frequencyRank |
| 3 | `scripts/validate-function-words.mjs` 存在，验证数据完整性，作为 npm test 的一部分 |
| 4 | `/dissect` 页面存在，输入框 + 拆解按钮 + 输出区 + 占位例句 |
| 5 | 拆解器正确识别"Yo me lavo las manos con agua fría"中的 4 个骨架词 |
| 6 | 每个骨架词带 category 颜色 + 可点击展开显示 esEnContrast |
| 7 | 拆解器输出底部含统计："X 个词中 Y 个骨架词（Y/X%）" |
| 8 | `/learn/foundation` 总览页存在，7 张卡片含天/主题/时长 |
| 9 | `/learn/foundation/[day]` 1-7 全部存在，每页含引入 / 对照表 / 西英差异 / 真实使用四部分 |
| 10 | 每天内容 ≥800 中文字（不含表格和例句），单元间有上/下天导航 |
| 11 | `/learn` 顶部含"新手起步 7 天"banner，点击跳转 `/learn/foundation` |
| 12 | UI 视觉过 Claude2 评审（拆解器 + 课程页） |
| 13 | `npm test` 通过，`npm run build` 通过 |

---

## 7. 不在本票范围

- **测验/翻牌/音频**——本次坚持纯静态阅读
- **课程进度跟踪**（用户读到第几天）——后续可加，不阻塞
- **拆解器集成进 /lectura / /watch**——本次只做独立工具页
- **多语言界面**——只输出中文讲解
- **A1+ 的进阶骨架**（虚拟式、被动 se、未来时变位）——本次只覆盖 A1-A2 基础骨架
- **AI 生成的"个性化讲解"**——本次内容人工/半人工编写
- **SRS 加入功能词**（这些词频率太高不需要复习）

---

## 8. 文件触动清单

| 文件 | 改动 |
|------|------|
| `data/function-words.json` | 新建 |
| `scripts/validate-function-words.mjs` | 新建 |
| `package.json` | 加 `validate:function-words` 脚本（可选） |
| `src/app/dissect/page.tsx` | 新建 |
| `src/app/dissect/DissectorClient.tsx` | 新建（客户端拆解逻辑 + 渲染） |
| `src/app/dissect/tokenize.ts` | 新建（西语分词 + dict 查找） |
| `src/app/learn/foundation/page.tsx` | 新建 |
| `src/app/learn/foundation/[day]/page.tsx` | 新建 |
| `src/content/foundation/day-1.md` ~ `day-7.md` | 新建（7 个 markdown 内容文件，或 TS 模块） |
| `src/app/learn/page.tsx` | 顶部加 banner 引导 |
| `src/app/components/web/SiteNav.tsx` | 不动（dissector 是工具，不进主导航；用户从 /learn/foundation 链入即可） |
| `tests/course005.test.mjs` | 新建（数据完整性 + 页面契约） |
| `feature_list.json` | 新增 COURSE-005 |
| `session-handoff.md` | Dev Report |

---

## 9. 测试要点

`tests/course005.test.mjs`：

1. `data/function-words.json` 存在且通过 validator
2. entries 数量 ≥ 60；每条 entries 含必需字段
3. 至少含 10 个 PM 钦定的"必有词"：el, la, un, una, con, de, en, a, por, para, se, me, te, lo, la, que, este, yo, mi, y
4. `/dissect` 源码含 tokenize 逻辑 + 颜色标签渲染 + 例句占位符
5. `/learn/foundation` 含 7 个 day 链接
6. `/learn/foundation/[day]` 路由对 day-1 到 day-7 都能匹配
7. 每天内容文件存在，字数 ≥ 800（中文字符数）
8. `/learn/page.tsx` 含 foundation 入口 banner

---

## 10. PM 要求

- Codex1 整理词典 + 写课程内容时，**任何不确定的语法点必须保留 `TODO` 标记**，不要硬编。PM 校对时会决定。
- Codex1 不熟西语？没关系——所有内容必须**有 Wiktionary 等公开源支撑**，引用片段就行，PM 来判断采纳。
- Phase 1 完成后**先提 PR review** 给 PM，PM 通过词典再开 Phase 2/3。
- Phase 3 写完后 PM **必须通读 7 天内容**才能 ready_for_qa。
