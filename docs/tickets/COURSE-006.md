# COURSE-006 — 拆解器增强：逐词英注 + 省略主语推断

**优先级**：P2
**区域**：course / dissect
**依赖**：COURSE-005（/dissect 页面已存在）

---

## 背景

西语最让中文母语者困惑的特点之一：**主语经常省略**，动词变位本身就含主语信息。
现有拆解器只高亮骨架词，不解释"这个动词说明了谁在做"。

逐词语法对照（interlinear gloss）是语言学课本的标准工具：
每个词下面标注英语释义，省略的主语用括号插入词序，
最后给出完整自然英语句——让学习者在结构层面看懂整句话。

## 范围

### 做

**触发方式**：复用现有「拆解」按钮，渐进加载：
1. 点击 → 骨架词高亮**立即显示**（现有逻辑不变）
2. 同时发起 AI 调用 → 逐词对照区块**异步加载后出现**

**新区块：逐词对照**，紧接在现有「拆解结果」下方：

```
── 逐词对照 ──────────────────────────────

¿  De      dónde   （tú）  eres    ?
   from    where   [you]   are

→  Where are you from?
```

**展示规则**：

| 元素 | 样式 |
|---|---|
| 原词行 | `text-lg font-medium text-gray-900` |
| 英注行 | `text-sm text-gray-400`，每个英注与原词列对齐 |
| 省略主语 | 原词行插入 `（tú）`，`text-brand-600 font-medium`，外加浅色括号；英注行对应位置显示 `[you]` |
| 自然英语句 | 区块底部 `→ ...`，`text-base text-gray-700 font-medium mt-4` |
| 加载中 | 骨架高亮下方出现一个 `text-sm text-gray-400` 的 loading 文字「分析中…」 |

**布局对齐方案**：用 CSS grid（每个 token 一列），原词和英注各占一行，省略主语单独作为一个 grid cell 插入正确列位置。

### AI 接口

新 API 端点：`POST /api/dissect/analyze`

请求体：
```json
{ "sentence": "¿De dónde eres?" }
```

响应体（DeepSeek 返回 JSON）：
```json
{
  "tokens": [
    { "form": "¿",      "english": "",      "isPunctuation": true },
    { "form": "De",     "english": "from",  "isPunctuation": false },
    { "form": "dónde",  "english": "where", "isPunctuation": false },
    { "form": "eres",   "english": "are",   "isPunctuation": false },
    { "form": "?",      "english": "",      "isPunctuation": true }
  ],
  "impliedSubject": {
    "pronoun": "tú",
    "english": "you",
    "insertBeforeIndex": 3
  },
  "naturalEnglish": "Where are you from?"
}
```

DeepSeek system prompt 要求：
- 分析每个 token 的英语释义（标点留空）
- 识别是否有省略主语，给出西语代词形式 + 英语形式 + 插入位置（insertBeforeIndex = 动词 token 的索引）
- 给出完整自然英语译句
- 只返回 JSON，不加任何解释文字

**无省略主语时**：`impliedSubject` 字段为 `null`，不插入任何额外 cell。

### 不做

- ❌ 时态标注（A1 阶段过于复杂）
- ❌ 词性标签（名词/形容词等）——现有骨架词已覆盖功能词，内容词交给 LookupCard
- ❌ 多个省略成分（宾语省略等）——只处理主语
- ❌ 缓存 AI 结果（当前阶段不需要）

## UI 要求

- 新区块有明确的 section 分隔（`border-t border-gray-100 mt-6 pt-6`）
- Section 标题：「逐词对照」`text-sm font-semibold text-gray-900`
- Token grid 横向排列，超长句子允许换行（`flex-wrap`）
- 每个 token 列：原词 + 英注上下对齐，最小宽度 `min-w-[2rem]`，居中对齐
- 省略主语 cell：背景 `bg-brand-50 rounded px-1`，插入到正确位置
- 自然英语行：`→` 前缀，`text-base`
- AI 出错时（超时/报错）：显示 `text-sm text-gray-400`「分析暂不可用」，不影响骨架词高亮

## 验收标准

- [ ] 点「拆解」后骨架词高亮仍立即出现，无延迟
- [ ] 逐词对照区块异步加载，加载中显示「分析中…」
- [ ] 每个非标点 token 下方显示英注
- [ ] 省略主语以 `（tú）` / `（yo）` 等形式插入词序，`text-brand-600`
- [ ] 英注行对应位置显示 `[you]` / `[I]` 等
- [ ] 区块底部显示自然英语句 `→ ...`
- [ ] 无省略主语的句子正常显示，无额外 cell
- [ ] AI 出错时显示降级文案，不 crash
- [ ] `POST /api/dissect/analyze` 返回结构正确的 JSON
- [ ] npm test 通过

## 技术草图

```
DissectorClient.tsx 变更：
  点击「拆解」时：
    1. setActivePopover(null)  ← 现有逻辑保留
    2. setAnalysis('loading')
    3. fetch('/api/dissect/analyze', { method: 'POST', body: JSON.stringify({ sentence: input }) })
       .then(res => res.json())
       .then(data => setAnalysis(data))
       .catch(() => setAnalysis('error'))

新 state：analysis: null | 'loading' | 'error' | AnalysisResult

新区块 <InterlinearGloss analysis={analysis} /> 渲染在 dissect-output section 下方
```

## 成本估计

**1 天**（新 API 路由 + DeepSeek prompt + InterlinearGloss 组件）
