# PHON-003 — 字母条件发音规则 + 音节例子

**优先级**：P2（PHON-002 完成后做）
**区域**：phonics
**依赖**：PHON-002（元音/辅音基础）

---

## 背景

现在字母卡只有「字母名 + 一个例词」，没有解释发音的上下文规则。
西班牙语有多个字母根据前后字母不同发音不同（C、G、R、X 等），
学生不知道规则就无法正确拼读。

每条规则需配可点击的**音节例子**（如点击「ca」听到"嘎"），
而不是只有文字说明。

## 范围

### 做

在每张字母卡展开区域增加「发音规则」折叠块。
有条件变音的字母展示规则 + 音节 + 例词；发音固定的字母不显示（或仅一行说明）。

**涉及字母和规则**：

| 字母 | 规则条数 | 音节例子 | 例词 |
|------|---------|---------|------|
| B/V  | 2 | ba be bi bo bu / βa βe… | barco, uva |
| C    | 2 | ce ci / ca co cu | cena, casa |
| CH   | 1 | cha che chi cho chu | chico, leche |
| D    | 2 | da de（词首）/ ða ðe（词中/词尾）| dos, nada, Madrid |
| G    | 2 | ge gi（喝）/ ga gue gui go gu（哥）| gesto, gato, guía |
| H    | 1 | ha he hi ho hu（全不发音）| hola, hijo |
| LL   | 1 | lla lle lli llo llu（一）| ella, pollo |
| Q    | 1 | que qui（u 不发音 → 哥）| queso, quiero |
| R    | 3 | 词首/l,n,s 后多击颤音 / rr 多击 / 词尾单击 | rosa, arroz, trabajar |
| X    | 3 | 词首→[s] / 元音间→[ks] / 墨西哥词→[x] | xilófono, examen, México |
| Y    | 2 | 词中→[j] 一 / 作连词 y → [i] | yo, y |
| Z    | 1 | za zo zu（似）| zapato, zona |

固定发音字母（A/E/I/O/U/F/K/L/M/N/Ñ/P/S/T/W）在卡片上只展示发音注释，不需要规则折叠块。

**数据结构扩展**（`content/phonics/alphabet.ts`）：

```typescript
type PronunciationRule = {
  condition: string;       // "在 e / i 前"
  sound: string;           // "[s]  嘶"
  syllables: string[];     // ["ce", "ci"]
  words: { text: string; zh: string }[];
};

type AlphabetLetter = {
  // 现有字段保留
  rules?: PronunciationRule[];
};
```

**音频**：
- 音节音频预生成：`/audio/phonics/syllables/{syllable}.mp3`（如 `ca.mp3`、`ce.mp3`）
- 新增脚本参数或单独脚本生成 ~60 个音节 mp3
- 例词音频复用现有 `/audio/phonics/words/` 或按需补充

### 不做
- ❌ 国际音标（IPA）详细标注——A1 阶段用中文注音够了
- ❌ 西班牙 vs 拉美口音对比（仅给拉美标准音，与 TTS 一致）

## UI 要求

- 字母卡默认折叠，点击卡片展开规则区
- 每条规则显示：条件说明 → 发音描述 → 音节按钮列 → 例词列
- 音节按钮点击播音，样式与字母 TTS 按钮一致
- 例词点击播音，显示中文释义
- 在移动端折叠/展开交互正常

## 验收标准

- [ ] `AlphabetLetter` 类型增加 `rules` 字段
- [ ] 上表中 12 个字母（B/V、C、CH、D、G、H、LL、Q、R、X、Y、Z）有规则数据填充
- [ ] 每个音节可点击播放 TTS
- [ ] 每个例词可点击播放 TTS，显示中文
- [ ] 固定发音字母不显示规则折叠块（或仅一行注释）
- [ ] 折叠/展开在移动端正常
- [ ] 音节音频文件已预生成（路径 `/audio/phonics/syllables/`）
- [ ] npm test 通过

## 成本估计

**1.5 天**（数据填充 + 音频生成脚本 + UI 折叠组件）
