# READ-001 — 西语分级短文阅读 Lectura（工位友好）

**优先级**：P1 | **负责人**：Codex1 | **日期**：2026-05-19
**状态**：`ready_for_dev`

---

## 背景

PM 自用反馈（2026-05-19）：

> Aula 教材并不能无痛进入，而且上班时候好像也不好直接打开学。

诊断：Esponal 当前所有"学习入口"都不适合**工位 / 通勤 / 5-10 分钟窗口期**的场景——视频要耳机、9 单元课程跟 Aula 一样太重、语法是查询不是消费。**词库**勉强算，但只是看不是学新东西。

本 ticket 加一个完全契合「碎片时间 + 工位伪装」的模块：**Lectura，西语分级短文阅读**。

为什么这一票特别值得做：
- **零音频** = 工位无障碍（不用耳机、不引人注目）
- **2-3 分钟一篇** = 卡碎片时间
- **视觉伪装成读文章** = 同事瞟到看不出在学西语
- **复用现有 `LookupCard`** = 点词查义 + 加入词库流程白送
- **不依赖反爬 / Whisper / Apify** = 跟我们刚踩的所有坑无关
- 形成 Esponal 的**两条腿**：有时间有耳机 → 视频；没时间没耳机 → Lectura

---

## 一、数据结构

v1 不引入 markdown 解析，每篇短文是一个 TS 数据对象，存在 `content/lectura/` 下：

```ts
// content/lectura/types.ts
export type LecturaLevel = "A1" | "A2" | "B1";

export type LecturaStory = {
  slug: string;             // URL slug，例如 "la-tortuga-y-la-liebre"
  title: string;            // 西语标题
  titleZh: string;          // 中文标题（首页展示用）
  level: LecturaLevel;
  source: string;           // "Esopo（公版）" / "改编自 Wikipedia" 等
  durationMin: number;      // 预估阅读时长，分钟
  summaryZh: string;        // 一句中文摘要（首页卡片用）
  paragraphs: string[];     // 段落数组，纯西语文本
  glossary?: Array<{        // 可选：编辑挑出的难词预先注释
    word: string;
    note: string;
  }>;
};

// content/lectura/index.ts
export const lecturaStories: LecturaStory[] = [
  // 各篇 import 进来
];

export function getLecturaStory(slug: string): LecturaStory | undefined {
  return lecturaStories.find((s) => s.slug === slug);
}
```

每篇短文：
```ts
// content/lectura/la-tortuga-y-la-liebre.ts
export const laTortugaYLaLiebre: LecturaStory = {
  slug: "la-tortuga-y-la-liebre",
  title: "La tortuga y la liebre",
  titleZh: "乌龟与兔子",
  level: "A1",
  source: "Esopo（公版寓言）",
  durationMin: 2,
  summaryZh: "一只骄傲的兔子和一只坚持不懈的乌龟……",
  paragraphs: [
    "Había una vez una liebre muy presumida que siempre se burlaba de la lentitud de la tortuga.",
    "Un día, cansada de las burlas, la tortuga la retó a una carrera.",
    "..."
  ]
};
```

---

## 二、初始内容（PM 提供，本 ticket 范围内含 5 篇）

| slug | 来源 | 级别 | 时长 |
|---|---|---|---|
| `la-tortuga-y-la-liebre` | Esopo 公版 | A1 | 2 min |
| `el-leon-y-el-raton` | Esopo 公版 | A1 | 2 min |
| `el-flautista-de-hamelin` | Grimm 公版（西语版） | A2 | 4 min |
| `un-dia-en-madrid` | 编辑原创（旅行日记体） | A2 | 3 min |
| `el-cafe-de-las-mananas` | 编辑原创（生活随笔） | B1 | 5 min |

PM 在 ticket 开 dev 前把 5 个 TS 文件写好放到 `content/lectura/`。Codex1 不负责内容写作，只负责渲染管线。

文本由 PM 手写或从公版来源 + GPT 改写，确保版权清白。所有内容用陈述句、不带感叹号，符合 Esponal 整体克制语气。

---

## 三、路由 + 页面

### `/lectura` 列表页

仿 `/learn` 卡片网格但更克制：

```
┌──────────────────────────────────────────┐
│  Lectura · 西语短文阅读                    │
│  适合通勤、午休、工位 5 分钟               │
│                                          │
│  ┌──────┐  ┌──────┐  ┌──────┐            │
│  │ A1   │  │ A1   │  │ A2   │            │
│  │ 乌龟… │  │ 狮子… │  │ 哈梅林… │           │
│  │ 2 min│  │ 2 min│  │ 4 min│            │
│  └──────┘  └──────┘  └──────┘            │
└──────────────────────────────────────────┘
```

- 卡片包含：level badge（A1=绿色 / A2=蓝色 / B1=紫色 brand 调色）、`titleZh`、`durationMin`、`summaryZh`
- hover 卡片轻微抬起（复用 WEB-009 的 shadow-elevated）
- 点击 → `/lectura/[slug]`
- 顶部副标题「适合通勤、午休、工位 5 分钟」明确产品定位

### `/lectura/[slug]` 阅读页

```
┌────────────────────────────────────────────┐
│   [← 返回 Lectura]                          │
│                                            │
│   La tortuga y la liebre                   │
│   A1 · 2 min · Esopo（公版）                 │
│                                            │
│   Había una vez una liebre muy             │
│   presumida que siempre se burlaba         │
│   de la lentitud de la tortuga.            │
│                                            │
│   Un día, cansada de las burlas, la        │
│   tortuga la retó a una carrera.           │
│                                            │
│   [...]                                    │
│                                            │
│   ─────────────────────                    │
│   ⌛ 2 分钟读完  ·  💡 点击任意单词查义       │
└────────────────────────────────────────────┘
```

样式要求：
- **核心阅读区最大宽 720px 居中**（Medium 风格，长行不读）
- 字体：`text-[17px] leading-[1.8] text-gray-800 font-serif`（serif 让它看起来像在读文章，不像在学习；用 Tailwind 的 `font-serif` 就行，会落到系统 serif）
- 段落间距：`mb-6`
- 标题：`text-3xl font-semibold mb-2`
- meta（level / time / source）：`text-sm text-gray-500 mb-10`
- 整页背景：`bg-app`（沿用 WEB-009 token）
- 每个**有意义的西语词**（去标点后非空）包成 `<span>`，类似 TranscriptPanel 里的 token 渲染
- 点 span → 唤起 `LookupCard`（fixed 浮层，锚定到词位置）
- 不显示中文翻译（这点很重要，**保留西语沉浸感**，需要懂时再点词）
- 不显示音频按钮（v1 无音频）

底部小提示「⌛ 2 分钟读完  ·  💡 点击任意单词查义」帮用户首次发现交互。

---

## 四、复用 LookupCard

`LookupCard` 已经有 `source` prop 支持 `video` 和 `course` 类型。**新增** `lectura` 类型：

```ts
// src/app/watch/LookupCard.tsx 的 LookupSource 类型扩展
type LookupSource =
  | { type: "video"; url?: string; timestampSec?: number; sentence?: string }
  | { type: "course"; url: string; courseRef: string; sentence: string }
  | { type: "lectura"; storySlug: string; paragraphIndex: number; sentence: string };
```

「加入词库」时把出处信息带上，`/api/vocab/add` 接受新的 `sourceType="lectura"` + `courseRef="lectura:la-tortuga/p2"`（复用现有 courseRef 字段就行，省一次 Prisma migration）。

`/vocab` 词库展示遭遇记录时，lectura 出处的「跳回」链接到 `/lectura/[slug]#p2`（锚点跳到段落）。

---

## 五、SiteHeader 加入口

`SiteHeader.tsx` 一级导航现在是：视频 / 课程 / 语法 / 词库

加一个：**视频 / 课程 / 语法 / 阅读 / 词库**（共五个），「阅读」链接到 `/lectura`。

---

## 六、文件清单

**新增**：
- `content/lectura/types.ts`
- `content/lectura/index.ts`
- `content/lectura/la-tortuga-y-la-liebre.ts`（PM 提供文本）
- `content/lectura/el-leon-y-el-raton.ts`（PM 提供）
- `content/lectura/el-flautista-de-hamelin.ts`（PM 提供）
- `content/lectura/un-dia-en-madrid.ts`（PM 提供）
- `content/lectura/el-cafe-de-las-mananas.ts`（PM 提供）
- `src/app/lectura/page.tsx`（列表页）
- `src/app/lectura/[slug]/page.tsx`（阅读页）
- `src/app/lectura/LecturaReader.tsx`（客户端组件，负责 token 渲染 + LookupCard 状态）
- `tests/read001.test.mjs`

**修改**：
- `src/app/components/web/SiteHeader.tsx`（加「阅读」入口）
- `src/app/watch/LookupCard.tsx`（`LookupSource` 类型扩展 lectura）
- 任何接收 source 的 `/api/vocab/add` 调用（可能需要 lectura 时把 courseRef 复用进去）

---

## 七、测试断言

- `content/lectura/index.ts` export `lecturaStories` 数组、`getLecturaStory(slug)` 函数
- 5 篇文章都存在且 `paragraphs.length >= 1`
- `/lectura` 页面 import `lecturaStories` 并渲染至少 5 张卡片
- `/lectura/[slug]` 页面 `generateStaticParams` 含全部 slug
- `LecturaReader.tsx` 调用 `LookupCard`，传 `source.type === "lectura"`
- `SiteHeader.tsx` 包含 `/lectura` 链接
- 每个 story 文件的 `slug` 唯一、和 export const 名字风格一致

---

## 八、验收

1. `npm test` 通过；`npm run build` 通过
2. 桌面访问 `/lectura` 看到 5 张卡片，按 level 排列
3. 手机宽度（375px）访问 `/lectura` 不崩，卡片单列
4. 点任一卡 → 进 `/lectura/[slug]` 阅读页
5. 点任意西语词 → LookupCard 弹出（已登录可加入词库；未登录走现有引导登录流程）
6. 在我们站登录后加一个词 → 跳 `/vocab` 看到 lectura 出处
7. **真实使用测试**（PM 验）：打开 `/lectura/un-dia-en-madrid`，**模拟在工位上**看 3 分钟。问自己：
   - 同事瞟一眼能看出在学西语吗？应该看不出
   - 整篇读完无需音频？是
   - 至少点 3 个不认识的词查义？流畅
   - 整个过程心理负担比打开 Aula 教材轻？这是核心 KPI

---

## 九、不在本 ticket 范围内

- 文章内置音频 / TTS 朗读 → v2 再考虑（用户场景明确不需要）
- 段落级别中文翻译 → 沉浸感优先，不做
- 阅读进度跟踪 / 收藏 → v2，先看用户用不用得起来
- AI 生成新文章 → v3，等内容池跑通流程
- 评论 / 社区 → 不在产品方向上
- 难词预亮（glossary 字段虽然在 type 里预留了，v1 不真渲染）

---

## 十、注意事项

- 5 篇文章用纯 ES6 string array，不要塞 HTML/markdown。token 化在前端做。
- 西语标点要保留：`¿`、`¡`、`«»` 等。tokenizer 要正确分离标点和词。
- 长文章可能段落数 10+，性能上无虑（v1 全量渲染，远比 transcript 几百条 cue 简单）。
- 不要给阅读页加深色模式 / 字号调节按钮，v1 一切从简。
- 文本来源**严格公版或原创**，避免版权问题。Olly Richards 等付费读物**不要**抄入。
