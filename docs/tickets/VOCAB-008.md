# VOCAB-008 — 已学词标记（阅读/课程页下划线）

**优先级**：P1
**区域**：vocabulary
**依赖**：VOCAB-005 ✅（变位数据）、VOCAB-007 ✅（AI 词形还原）

---

## 背景

用户把词加入词库后，再次在 Lectura 阅读页或课程页遇到同一个词时，无任何视觉提示。学习者需要"我见过这个"的即时反馈才能强化记忆，同时也方便专注于真正陌生的词。

YouTube 字幕的 WEB-006 已实现颜色标记，但 Lectura 和课程页缺失。本票把"已学词标记"扩展到这两个阅读场景。

**关键挑战**：用户保存的是 lemma（如 `tener`），但 Lectura 文本中出现的是变位形式（如 `tengo / tienes / tuvimos`）。如果只匹配字面 lemma，会漏掉绝大多数变位词。

**设计决定（方案 Y）**：保存动词词条时，把 `tryConjugateVerb` 生成的全部变位形式写入 `Word.forms` 数组。运行时高亮就是简单的 set 查表。

---

## 用户故事

- 用户已在词库收藏 `tener`
- 打开任意 Lectura 故事，看到段落里所有 `tengo / tienes / tiene / tenemos / tuvieron / tendrás …` 都有**深灰色细下划线**
- 已收藏的名词、形容词原形也加同样下划线
- 课程页（`/learn/[slug]`）的西语例句、章节内容做同样处理
- 下划线**不影响**点击行为：点击仍弹 LookupCard，可继续保存或查看详情
- 未收藏的词无任何标记

---

## 技术方案

### 1. 数据层 — 保存时自动灌入变位形式

**`src/lib/vocab.ts` 的 `createWord`**：

当 `partOfSpeech` 以 `v` 开头时，调 `tryConjugateVerb(lemma)`，把所有时态/人称的变位字符串合并去重写入 `forms`。

```ts
// 伪代码示意
if (isVerbPos(partOfSpeech)) {
  const conj = tryConjugateVerb(normalizedLemma);
  if (conj) {
    const allForms = Object.values(conj)
      .flatMap((tense) => Object.values(tense ?? {}))
      .filter((f): f is string => typeof f === "string" && f.length > 0)
      .map((f) => f.toLowerCase());
    normalizedForms = normalizeForms([normalizedLemma, ...allForms, ...forms]);
  }
}
```

名词/形容词保持现状（`forms = [lemma, ...]`）。

### 2. Backfill 脚本

**`scripts/backfill-verb-forms.mjs`**：

- 扫描所有 `partOfSpeech` 以 `v` 开头的 Word
- 对每个 lemma 调 `tryConjugateVerb`，把变位形式合并进 `forms`（去重）
- 输出进度：`处理 X/Y，更新 Z 条`
- 添加 `npm run backfill:verb-forms` 到 `package.json`

### 3. API — 高亮查询

**`src/app/api/vocab/highlight/route.ts`**（如已存在则升级）：

```
GET /api/vocab/highlight
→ { savedForms: string[] }   // 当前用户所有 Word.forms 的并集，去重，全小写
```

权限：登录则返回个人列表；未登录返回 `{ savedForms: [] }`（不报错，前端按空集走）。

无须传分页/文本，让前端做集合判断。响应可缓存：HTTP `Cache-Control: private, max-age=60`。

### 4. 前端 — Lectura 阅读页

**`src/app/lectura/LecturaReader.tsx`**：

- 加载时 `useEffect` 调 `/api/vocab/highlight`，结果存 `savedSet: Set<string>`
- 现有 tokenize 逻辑（把段落分成可点击 `<span>`）渲染时增加判断：
  - 若 `savedSet.has(token.toLowerCase())` → 给 span 加 className `saved-word`
- 加 CSS 类（建议放在 `globals.css` 或组件 `<style jsx>` 中）：

```css
.saved-word {
  text-decoration: underline;
  text-decoration-color: #4b5563;  /* gray-600 */
  text-decoration-thickness: 1.5px;
  text-underline-offset: 3px;
}
```

### 5. 前端 — 课程页

**`src/app/learn/[slug]/page.tsx`**（或其下例句组件）：

- 同样模式：加载用户的 `savedForms`，渲染西语文本时按 token 匹配加 `saved-word` 类
- 复用同一 CSS 类，保持视觉一致

### 6. 不动 YouTube 字幕

字幕已有 WEB-006 的颜色高亮逻辑，本票不改。

---

## 验收标准

| # | 检查项 |
|---|--------|
| 1 | `createWord` 在 verb POS 时把 `tryConjugateVerb` 全部变位写入 `forms` |
| 2 | `scripts/backfill-verb-forms.mjs` 存在，`npm run backfill:verb-forms` 可执行 |
| 3 | `GET /api/vocab/highlight` 已登录返回 `{ savedForms: string[] }`（全小写、去重） |
| 4 | `GET /api/vocab/highlight` 未登录返回 `{ savedForms: [] }`，不报错 |
| 5 | Lectura 页加载后调一次 `/api/vocab/highlight`，已保存词带 `saved-word` 类 |
| 6 | Lectura 页中变位词（如 `tengo` 对应保存的 `tener`）也被标记 |
| 7 | 课程页同样标记，复用 `.saved-word` CSS 类 |
| 8 | `.saved-word` 样式为深灰下划线（`#4b5563` / `1.5px` / `offset 3px`） |
| 9 | 点击已标记词仍正常弹 LookupCard（行为不破坏） |
| 10 | `npm test` 通过，`npm run build` 通过 |

---

## 不在本票范围

- 区分 SRS 状态的颜色梯度（New / Learning / Review 不同色）—— 后续可加
- YouTube 字幕的样式调整（WEB-006 已存在，不变）
- 名词/形容词的复数/性数形式自动灌入 forms（仅动词处理）
- 鼠标 hover 显示中文释义 tooltip
- 已学词的统计页面

---

## 文件触动清单

| 文件 | 变更 |
|------|------|
| `src/lib/vocab.ts` | `createWord` 增加 verb forms 自动灌入 |
| `scripts/backfill-verb-forms.mjs` | 新建 |
| `package.json` | 新增 `backfill:verb-forms` 脚本 |
| `src/app/api/vocab/highlight/route.ts` | 新建或升级，返回 `savedForms` |
| `src/app/lectura/LecturaReader.tsx` | 加载 savedSet，渲染时打类 |
| `src/app/learn/[slug]/page.tsx`（或其例句组件） | 同上 |
| `src/app/globals.css`（或组件局部样式） | 新增 `.saved-word` |
| `tests/vocab008.test.mjs` | 新建 |
| `feature_list.json` | 新增 VOCAB-008 |
| `session-handoff.md` | Dev Report |

---

## 测试要点

`tests/vocab008.test.mjs`（源码契约风格，沿用项目惯例）：

1. `src/lib/vocab.ts` 含 verb 分支调 `tryConjugateVerb` 并合并 forms
2. `scripts/backfill-verb-forms.mjs` 存在且 `package.json` 含 `backfill:verb-forms`
3. `src/app/api/vocab/highlight/route.ts` 含 `savedForms` 返回结构
4. `LecturaReader.tsx` 含 `saved-word` className 及 fetch `/api/vocab/highlight`
5. 课程页源码含 `saved-word` className
6. CSS 类含 `text-decoration: underline` 与 `#4b5563`
