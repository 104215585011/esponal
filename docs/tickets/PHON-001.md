# PHON-001 — Stage 0 字母发音页（从 eslearn 移植）

**优先级**：P1（VISION.md 里 Stage 0 是唯一 ❌ 的 stage，新用户入口）
**区域**：phonics / curriculum
**依赖**：AUDIO-002 ✅（TTS 管线 msedge-tts）

---

## 背景

VISION.md 第 5 节当前现状里 **Stage 0「入门」标 ❌ 未做**：

> 字母发音、拼读练习、最基础的代词/介词/动词模块（**新用户入口**）

第 6 节"最核心的瓶颈"明确指出：

> 新用户首次打开站点，没有"我该从哪里开始"的入口。零基础的人看到 `/learn/phase-1`（300 词）会直接劝退。

PM 自己跳过了 Stage 0（已通过其他途径学过字母），但对要做成可宣传产品的目标，这是硬伤。

**好消息**：眼前已有可直接复用的资产。eslearn 项目（`C:\Users\wang\Documents\New project 2\eslearn`）有完整 phonics 模块：

| eslearn 资产 | 路径 | Esponal 复用程度 |
|---|---|---|
| 27 字母数据（含字母名 + 例词 + 中文译） | `lib/phonicsSeed.ts` | **直接搬** |
| 字母网格 UI | `components/Phonics/AlphabetGrid.tsx` | 移植 |
| 字母卡片 | `components/Phonics/LetterCard.tsx` | 移植 |
| 拼读规则视图 | `components/Phonics/SyllableRulesView.tsx` | v1 不做，留 v2 |
| 练习模式 | `components/Phonics/PracticeClient.tsx` | v1 不做，留 v2 |
| 主入口 | `app/phonics/page.tsx` | 重写 |

⚠️ eslearn 数据层用 **Supabase**，Esponal 用 **Prisma**。但字母数据是静态的——**不需要走 DB**，直接放 `content/phonics/alphabet.ts` 即可，跳过迁移问题。

## 范围

### v1 做（这一票）

1. **新页面 `/phonics`**：
   - 顶部 hero 标题：「西语字母 · El alfabeto español」
   - 27 字母网格（A-Z + Ñ），每格显示：
     - 大写字母 + 小写字母
     - 字母名（如 Ñ = "eñe"）
     - 例词（西语）+ 中文翻译
     - **🔊 按钮播放字母发音**
   - 点击格子可展开/聚焦看更大版本
2. **静态数据**：`content/phonics/alphabet.ts` 27 条，从 eslearn `phonicsSeed.ts` 直接复制：
   ```ts
   export const SPANISH_ALPHABET = [
     { letter: "A", name: "a",      example: "amigo",  exampleZh: "朋友" },
     { letter: "B", name: "be",     example: "barco",  exampleZh: "船" },
     ...27 条
   ];
   ```
3. **TTS 音频生成**：
   - 新脚本 `scripts/generate-phonics-audio.mjs`（复制 `generate-lectura-audio.mjs` 改适配）
   - 输出到 `public/audio/phonics/letters/{a..z,ñ}.mp3`
   - 还要为每个字母名生成一个例词音频：`public/audio/phonics/words/{slug}.mp3`
   - 用 `es-MX-DaliaNeural`（和 lectura 同声线，保持一致性）
4. **导航入口**：
   - SiteNav / MobileNav 在最左加「字母」（在「视频」前）——**这是新用户的第一站**
5. **登录态可访问**：phonics 是 onboarding 内容，**不要求登录**（区别于 talk / vocab）

### v2 不做（先推迟）

- ❌ 拼读规则页（`/phonics/syllables`）—— `eslearn/SyllableRulesView.tsx` 留作下票 PHON-002
- ❌ 听音选字母练习（`/phonics/practice`）—— PHON-003
- ❌ 用户进度追踪（哪些字母听过 / 没听过）—— 暂时不需要
- ❌ ñ / ll / rr / ch / ce-ci / je-ji 这些组合规则—— 属于拼读规则，下票

## 验收

- [ ] `/phonics` 可访问（未登录也能进）
- [ ] 27 字母全部展示，无遗漏（特别确认 Ñ 存在）
- [ ] 每个字母有 🔊 按钮，播放字母发音
- [ ] 每个例词有 🔊 按钮，播放例词发音
- [ ] 音频用 Header 全局倍速控件可调速（接入 `getPlaybackRate()`）
- [ ] 移动端字母网格响应式（3 列 → 4 列 → 6 列）
- [ ] `scripts/generate-phonics-audio.mjs` 跑完后产出 54 个 mp3（27 字母 + 27 例词）
- [ ] SiteNav 和 MobileNav 都加「字母」入口
- [ ] VISION.md 第 5 节 Stage 0 状态从 ❌ 改为 🟢（部分完成）
- [ ] 200/N 测试通过

## 技术草图

**数据**：

```ts
// content/phonics/alphabet.ts
export type AlphabetLetter = {
  letter: string;        // "A"
  letterLower: string;   // "a"
  name: string;          // "a"（字母自己的名字）
  example: string;       // "amigo"
  exampleZh: string;     // "朋友"
};

export const SPANISH_ALPHABET: AlphabetLetter[] = [
  { letter: "A", letterLower: "a", name: "a",       example: "amigo",     exampleZh: "朋友" },
  { letter: "B", letterLower: "b", name: "be",      example: "barco",     exampleZh: "船" },
  { letter: "C", letterLower: "c", name: "ce",      example: "casa",      exampleZh: "房子" },
  { letter: "D", letterLower: "d", name: "de",      example: "día",       exampleZh: "日子" },
  { letter: "E", letterLower: "e", name: "e",       example: "escuela",   exampleZh: "学校" },
  { letter: "F", letterLower: "f", name: "efe",     example: "familia",   exampleZh: "家庭" },
  { letter: "G", letterLower: "g", name: "ge",      example: "gato",      exampleZh: "猫" },
  { letter: "H", letterLower: "h", name: "hache",   example: "hola",      exampleZh: "你好" },
  { letter: "I", letterLower: "i", name: "i",       example: "isla",      exampleZh: "岛" },
  { letter: "J", letterLower: "j", name: "jota",    example: "jamón",     exampleZh: "火腿" },
  { letter: "K", letterLower: "k", name: "ka",      example: "kilo",      exampleZh: "公斤" },
  { letter: "L", letterLower: "l", name: "ele",     example: "libro",     exampleZh: "书" },
  { letter: "M", letterLower: "m", name: "eme",     example: "mesa",      exampleZh: "桌子" },
  { letter: "N", letterLower: "n", name: "ene",     example: "noche",     exampleZh: "夜晚" },
  { letter: "Ñ", letterLower: "ñ", name: "eñe",     example: "niño",      exampleZh: "男孩" },
  { letter: "O", letterLower: "o", name: "o",       example: "oso",       exampleZh: "熊" },
  { letter: "P", letterLower: "p", name: "pe",      example: "pan",       exampleZh: "面包" },
  { letter: "Q", letterLower: "q", name: "cu",      example: "queso",     exampleZh: "奶酪" },
  { letter: "R", letterLower: "r", name: "erre",    example: "rosa",      exampleZh: "玫瑰" },
  { letter: "S", letterLower: "s", name: "ese",     example: "sol",       exampleZh: "太阳" },
  { letter: "T", letterLower: "t", name: "te",      example: "taza",      exampleZh: "杯子" },
  { letter: "U", letterLower: "u", name: "u",       example: "uno",       exampleZh: "一" },
  { letter: "V", letterLower: "v", name: "uve",     example: "vino",      exampleZh: "葡萄酒" },
  { letter: "W", letterLower: "w", name: "uve doble", example: "web",     exampleZh: "网站" },
  { letter: "X", letterLower: "x", name: "equis",   example: "xilófono",  exampleZh: "木琴" },
  { letter: "Y", letterLower: "y", name: "ye",      example: "yo",        exampleZh: "我" },
  { letter: "Z", letterLower: "z", name: "zeta",    example: "zapato",    exampleZh: "鞋" }
];
```

**TTS 输入说明（每个字母念两遍式样以听清）**：

- 字母本身的音频：朗读字母名（如 "be" 对应 B）。文件：`/audio/phonics/letters/b.mp3`
- 例词音频：朗读 example 字段。文件：`/audio/phonics/words/{lower-letter}.mp3`（如 `b.mp3` = "barco"）

**UI 草图**：

```
┌─────────────────────────────────────────────────┐
│  El alfabeto español · 西语字母                  │
│  27 个字母。点击听发音。                          │
├─────────────────────────────────────────────────┤
│  ┌────┐ ┌────┐ ┌────┐ ┌────┐ ┌────┐ ┌────┐    │
│  │ A  │ │ B  │ │ C  │ │ D  │ │ E  │ │ F  │ ...│
│  │ a  │ │ be │ │ ce │ │ de │ │ e  │ │ efe│    │
│  │amigo│ │barco│ │casa│...                     │
│  │朋友 │ │船   │ │房子 │                       │
│  │ 🔊  │ │ 🔊 │ │ 🔊 │                        │
│  └────┘ └────┘ └────┘ ...                       │
└─────────────────────────────────────────────────┘
```

## 数据来源说明（合规）

字母 / 字母名 / 例词三列是西语语言公知信息，无版权问题。
从 eslearn 借用了同款 27 词表，原作者也是用户本人（无内部冲突）。

## 成本估计

**1-2 天**（数据搬 + 页面 + TTS 跑 + 导航 + 测试 + VISION 同步）

## 跟踪

新加 `PHON-001` 到 `feature_list.json`。未来 PHON-002 / PHON-003 会跟进做拼读规则 + 听音练习。
