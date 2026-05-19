# VOCAB-005 — 词库变位增强（动词全时态 + 名词/形容词性数）

**优先级**：P1 | **负责人**：Codex1 | **日期**：2026-05-19
**触发**：PM 反馈 2026-05-19 — 西语动词变位 + 名词性数是核心难点，当前词库只显示义项+例句不够用
**状态**：`ready_for_dev`

---

## 背景

当前 `dictData` 由 GLM-5 生成，只含 `meanings` + `examples`。对西语学习者最关键的两个信息缺失：

- **动词**：6 人称 × 多时态变位（vivo / vives / vivimos / viví / vivía...）
- **名词 / 形容词**：性数变形（el libro → los libros, rojo → roja / rojos / rojas）

调研结论（见上一条对话）：
- 变位是**高度确定性**问题，用 AI 生成会在不规则动词上翻车（之前 vivir 那次的教训）
- 用 `spanish-verbs` npm 包（RosaeNLG，MIT，~12,000 动词）100% 准确、零依赖、离线
- 名词 / 形容词形态用 GLM-5 出，但要扩充 prompt

---

## 一、数据结构升级

`src/lib/dictionary.ts` 里 `DictionaryEntry` 扩展：

```ts
export type DictionaryEntry = {
  word: string;
  lemma: string;
  partOfSpeech: string | null;
  meanings: string[];
  examples: DictionaryExample[];
  phonetic: string | null;
  morphInfo: string | null;
  // NEW
  conjugations?: VerbConjugations;   // 动词才有
  nounForms?: { singular: string; plural: string; gender: "m" | "f" | "mf" };
  adjectiveForms?: { ms: string; fs: string; mp: string; fp: string };
  // /NEW
  cached?: boolean;
  degraded?: boolean;
};

export type VerbConjugations = {
  presente: Record<Person, string>;
  preteritoIndefinido: Record<Person, string>;
  preteritoImperfecto: Record<Person, string>;
  futuro: Record<Person, string>;
  condicional: Record<Person, string>;
  presenteSubjuntivo: Record<Person, string>;
  imperativo?: Partial<Record<Person, string>>;
};

export type Person =
  | "yo" | "tu" | "el" | "nosotros" | "vosotros" | "ellos";
```

只保留**入门-中级最常用**的 6 个时态 + 命令式。完美主义可以加更多，但 v1 收口。

---

## 二、Pipeline 改造

新文件 `src/lib/conjugate.ts`：

```ts
import { getConjugation } from "spanish-verbs"; // 或这个库实际的 API

export function tryConjugateVerb(lemma: string): VerbConjugations | null {
  try {
    return {
      presente: extractTense(lemma, "INDICATIVE_PRESENT"),
      preteritoIndefinido: extractTense(lemma, "INDICATIVE_PRETERITE"),
      preteritoImperfecto: extractTense(lemma, "INDICATIVE_IMPERFECT"),
      futuro: extractTense(lemma, "INDICATIVE_FUTURE"),
      condicional: extractTense(lemma, "CONDITIONAL_PRESENT"),
      presenteSubjuntivo: extractTense(lemma, "SUBJUNCTIVE_PRESENT"),
      imperativo: extractTense(lemma, "IMPERATIVE_AFFIRMATIVE")
    };
  } catch {
    return null;  // 库不识别（生僻动词）→ 静默 fallback
  }
}
```

如果 `spanish-verbs` 的 API 跟假设不同，Codex1 据实调整——核心是 `tryConjugateVerb` 接受 lemma 返回标准化结构。

`src/lib/dictionary.ts` 的 `lookupDictionary()` 主流程：

```ts
const aiEntry = await fetchAIEntry(word, lemma, morphInfo).catch(() => null);

if (!aiEntry) return degraded(...);

// 并行不需要，spanish-verbs 是同步
if (aiEntry.partOfSpeech?.startsWith("v")) {
  aiEntry.conjugations = tryConjugateVerb(lemma) ?? undefined;
}
// 名词、形容词的 forms 在 GLM-5 prompt 里要求一并返回（见三）

await safeCacheSet(cacheKey, aiEntry);
return aiEntry;
```

---

## 三、GLM-5 prompt 扩充

`fetchAIEntry()` 里的 prompt 改为：

```
你是西班牙语词典助手。请为单词"${lemma}"生成词典条目，只返回 JSON 不要解释。

格式（注意 pos 决定结构）：
- 动词：{"pos":"v.","meanings":[...],"example":{"es":"...","zh":"..."}}
- 名词：{"pos":"n.m." 或 "n.f.","meanings":[...],"example":{...},"forms":{"singular":"libro","plural":"libros"}}
- 形容词：{"pos":"adj.","meanings":[...],"example":{...},"forms":{"ms":"rojo","fs":"roja","mp":"rojos","fp":"rojas"}}
- 其它（副词、连词等）：{"pos":"...","meanings":[...],"example":{...}}
```

解析时根据 pos 决定 `nounForms` / `adjectiveForms` 字段。

注意：GLM-5 偶尔会乱填 forms 字段，**做基本校验**——比如 nounForms.singular 必须等于 lemma 或与之只差末尾 s/es；不符合则丢弃 forms 字段。

---

## 四、缓存版本升级

老缓存 key `vocab:dict:vivir` 里只有 meanings/examples，没有 conjugations。**bump 命名空间**：

```ts
const cacheKey = `vocab:dict:v2:${lemma}`;
```

老缓存自然孤儿化，30 天后过期。新查询都走 v2 路径生成完整数据。

---

## 五、UI 展示（/vocab 页面）

`src/app/components/vocab/VocabAccordion.tsx` 词条展开时多一块「变位 / 形态」区域：

### 动词（最复杂）

```
vivir  v.
住，居住 / 生活，过日子
例句：Vivo en Madrid desde hace tres años.

──────── 变位 ────────
[现在时]  [简单过去]  [未完成过去]  [将来]  [条件式]  [虚拟现在]  [命令式]
   ↓
yo          vivo
tú          vives
él/ella     vive
nosotros    vivimos
vosotros    vivís
ellos       viven
```

- tab 切换时态，默认「现在时」
- 单纵向 table，简洁不花哨
- 移动端 tab 改横滑

### 名词

```
libro  n.m.   单/复  libro / libros
书

例句：...
```

简短一行 inline 即可，不开 table。

### 形容词

```
rojo  adj.   阳单/阴单/阳复/阴复  rojo / roja / rojos / rojas
红色的

例句：...
```

同样 inline。

### 其它词性

只展示 meanings + example，不渲染 forms 区域（即现状）。

---

## 六、文件清单

**新增**：
- `src/lib/conjugate.ts`
- `src/app/components/vocab/ConjugationTable.tsx`（动词变位 tab + table 子组件）
- `tests/vocab005.test.mjs`

**修改**：
- `package.json`：加 `spanish-verbs` dependency
- `src/lib/dictionary.ts`：扩 `DictionaryEntry` 类型 + lookupDictionary 接 conjugate + 缓存 key bump v2
- GLM-5 prompt（在 `dictionary.ts` 内）扩名词/形容词 forms 字段
- `src/app/components/vocab/VocabAccordion.tsx`：渲染 ConjugationTable + 名词/形容词 forms inline
- `src/app/vocab/page.tsx`（如果有 server 端 data fetching）：把 dictData 完整透传给 client

**不动**：
- `src/app/watch/LookupCard.tsx`——浮层保持精简，不塞变位表。用户想看完整变位去 /vocab。
- Prisma schema —— 复用现有 `Word.dictData` 的 Json 字段，结构灵活足够。
- `/api/vocab/lookup` 路由 —— 输出格式自动跟随 dictData 升级。

---

## 七、测试断言

- `package.json` 含 `spanish-verbs` dependency
- `src/lib/conjugate.ts` export `tryConjugateVerb` 接受 string 返回 VerbConjugations | null
- `tryConjugateVerb("vivir")` 返回非 null，且 `presente.yo === "vivo"`、`presente.nosotros === "vivimos"`
- `tryConjugateVerb("ser")`（不规则） `presente.yo === "soy"`、`preteritoIndefinido.yo === "fui"`
- `tryConjugateVerb("xyzfake123")` 返回 null（不崩）
- `src/lib/dictionary.ts` 含 `vocab:dict:v2:` 缓存 key
- `lookupDictionary("vivian")` 返回的 entry 含 `conjugations` 字段（动词路径）
- `ConjugationTable.tsx` 含 7 个时态 tab 文案
- `VocabAccordion.tsx` 在动词词条上渲染 ConjugationTable，名词/形容词上渲染 inline forms

---

## 八、验收

1. `npm test` 通过；`npm run build` 通过
2. **真用例**：访问 /vocab → 找一个 v. 的词条 → 展开 → 看到 7 个时态 tab → 切换 → 表格正确变化
3. **不规则动词正确**：`ser` 的现在时 yo="soy"，过去时 yo="fui"。不能是 AI 编的
4. **名词 inline forms**：找一个 n. 词条 → 展开 → 看到「单/复」一行
5. **形容词 inline forms**：同上看到「阳单/阴单/阳复/阴复」
6. **新词查询触发**：在 /watch 点一个**之前没查过**的动词加入词库 → 进 /vocab → 该词条已带完整变位（说明 v2 cache 走通）
7. **老缓存自然过渡**：之前查过的旧词（无 conjugations）展开时 ConjugationTable 区域不渲染或显示「待重新查询」——优雅降级，不报错
8. 桌面 + 手机两端布局都不崩

---

## 九、不在本 ticket 范围内

- 反身动词的 me/te/se 变位扩展显示
- 句子级语法分析（看到一句话拆出每个词的形态分析）
- 让用户能在 LookupCard 里直接看到完整变位（设计上不要这么做，太挤）
- 历史时态（pluscuamperfecto, futuro perfecto 等复合时态）
- 西语国家方言差异（vosotros vs ustedes 在拉美的差异）
- 老缓存重生成脚本

---

## 十、注意

- `spanish-verbs` API 实际形态 Codex1 装完后看 README 确认；ticket 里的命名是预期，按真实 API 调整
- GLM-5 返回的 forms 字段**一定要校验**——AI 会乱写。校验逻辑：
  - nounForms：singular/plural 都必须是字符串且 length > 0 且 length < 50
  - adjectiveForms：4 个字段都必须字符串非空
  - 任一字段不合格 → 整个 forms 丢弃
- 缓存 key 从 `vocab:dict:` 升 `vocab:dict:v2:`，老数据 30 天 TTL 后自然清
- ConjugationTable 移动端 tab 横滑用 `overflow-x-auto`，不要做汉堡折叠
- 性能：spanish-verbs 同步调用 < 1ms，对 lookup 总延迟影响可忽略
