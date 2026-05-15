# COURSE-003 — 课程系统重构：9单元 A1/A2 课程页

**优先级**：P1 | **负责人**：Codex1 | **日期**：2026-05-15

---

## 背景

当前 `/learn/phase-1` 是一个平铺长页，把发音规则和300高频词混在一起。
用户要求按 Aula Internacional 体系做9个完整单元，每个单元有结构化的词汇、句型、对话、语法点、中西对比、练习，以及一个推荐视频入口。

---

## 设计参考

`mockup-unidad-1.html`（根目录）— 所有视觉细节以此文件为准，不要自行发挥。

关键设计要点（对照 mockup 实现）：
- **左侧目录**：sticky，6个章节锚点，active 状态绿色左边框
- **Unit Hero**：绿色渐变卡片，A1/A2 badge，中文标题 + 西语副标题，元信息（时长/内容数量/音频标签）
- **学习目标**：双列复选清单
- **词汇卡片**：自适应网格，每词有西语 + 中文 + 场景注释 + 音频播放按钮
- **句型行**：西语 + 中文 + 音频按钮，三列对齐
- **对话块**：双角色（绿色/蓝色 badge），每行有逐句音频按钮，顶部有"播放全部"按钮
- **语法卡片**：每个动词一张白卡，含变位表格（人称 / 变位 / 例句三列）
- **中西对比**：蓝色背景卡片
- **练习**：填空题 + 翻译题，折叠式答案（details/summary）
- **推荐视频**：见下方说明
- **底部单元导航**：上一单元 / 下一单元

---

## 路由结构

```
/learn                    → 课程总览页（9个单元卡片列表）
/learn/[slug]             → 单元详情页（slug = "unidad-1" ~ "unidad-9"）
```

**删除旧路由**：`/learn/phase-1` 保留文件不删，但在 SiteHeader 的"课程"链接改为指向 `/learn`。

---

## 数据结构

单元 manifest 已生成：`content/curriculum/units-manifest.json`（9个单元的元数据）。

每个单元的详细内容存在独立 JSON 文件：
```
content/curriculum/
  units-manifest.json          ← 已存在，包含所有单元元数据
  unidad-1.json                ← 单元详细内容（见下方 schema）
  unidad-2.json
  ...
  unidad-9.json
```

### 单元内容 JSON schema

```ts
type UnitContent = {
  id: string;
  vocabGroups: {
    title: string;          // "1.1 打招呼与告别"
    items: {
      es: string;           // "Buenos días"
      zh: string;           // "早上好"
      note?: string;        // "中午前"
      audioSrc: string;     // "/audio/units/unidad-1/buenos-dias.mp3"
    }[];
  }[];
  phrases: {
    category: string;       // "介绍自己" | "询问别人"
    items: {
      es: string;
      zh: string;
      audioSrc: string;
    }[];
  }[];
  dialogues: {
    title: string;          // "对话 1 — 第一次见面（咖啡馆）"
    scene: string;          // 场景描述
    lines: {
      speaker: string;      // "María" | "Liu"
      speakerVariant: "a" | "b";  // 控制绿色/蓝色 badge
      es: string;
      zh: string;
      audioSrc: string;
    }[];
  }[];
  grammarCards: {
    verb: string;           // "ser"
    titleZh: string;        // "\"是\""
    lead: string;           // 说明文字
    conjugation: {
      pronoun: string;
      form: string;
      example?: string;
    }[];
  }[];
  compareCards: {
    title: string;
    body: string;           // 支持简单 HTML（<strong>、<table> 等）
  }[];
  exercises: {
    type: "fill-in" | "translate";
    title: string;
    questions: string[];
    answers: string[];
  }[];
  recommendedVideo: {
    videoId: string;
    title: string;
    description: string;    // 一句话说明为什么这个视频适合这个单元
  };
};
```

### 音频说明

单元词汇和对话的 TTS 音频放在：
```
public/audio/units/unidad-N/
```
文件命名：将西语文本做 slug（小写，空格改连字符，去特殊字符），例：
- "Buenos días" → `buenos-dias.mp3`
- "¿Cómo te llamas?" → `como-te-llamas.mp3`

音频用现有 TTS 方案（与 phase-1 的 WAV 生成逻辑一致，但存 mp3 即可）。
**如果 TTS 暂时来不及，audioSrc 填空字符串，音频按钮静默即可，不要报错。**

---

## 页面实现要求

### `/learn` — 课程总览页

读取 `units-manifest.json`，渲染9个单元卡片：
- 卡片包含：单元编号、中文标题、西语标题、A1/A2 badge、时长、核心动词 chip
- 点击跳转 `/learn/[slug]`
- 页面用 SiteHeader，保持与首页视觉一致

### `/learn/[slug]` — 单元详情页

读取 `units-manifest.json`（元数据） + `unidad-N.json`（内容），按 mockup 渲染。

**推荐视频区块（替换掉"视频任务"练习）**：

在"巩固练习"之后、底部导航之前，加一个"推荐视频"区块：

```
┌──────────────────────────────────────────────────────┐
│  🎬  本单元推荐视频                                   │
│  在真实西语对话中巩固本单元内容                       │
│                                                      │
│  [YouTube 缩略图]  标题文字                           │
│                    一句话说明                         │
│                    [ 去观看 → ]                      │
└──────────────────────────────────────────────────────┘
```

缩略图用 `https://img.youtube.com/vi/{videoId}/hqdefault.jpg`，
点击"去观看"跳转到 `/watch?v={videoId}`（站内播放器，不跳外链）。

### 音频按钮交互

用 HTML5 Audio API，点击播放对应 audioSrc，播放中图标变停止符，播完还原。
audioSrc 为空或加载失败时，按钮静默不报错。

---

## 内容数据生成

Codex1 **不需要**自己写内容。PM 会提供以下文件（见附件）：
- `content/curriculum/units-manifest.json` ✅ 已存在
- `content/curriculum/unidad-1.json` ← PM 生成（见下方）
- `content/curriculum/unidad-2.json` ~ `unidad-9.json` ← PM 生成

Codex1 只需要实现页面框架，把数据渲染出来。

---

## SiteHeader 修改

`src/app/components/web/SiteHeader.tsx`：
把"课程"链接的 href 从 `/learn/phase-1` 改为 `/learn`。

---

## 验收标准

1. `/learn` 可访问，显示9个单元卡片
2. `/learn/unidad-1` ~ `/learn/unidad-9` 均可访问（内容暂用 unidad-1.json 数据，其他单元内容 PM 补充后自动渲染）
3. 左侧目录 sticky，点击锚点正确跳转
4. 推荐视频区块显示缩略图，点击跳到站内 `/watch?v=...`
5. 音频按钮：有 audioSrc 时可播放，无 audioSrc 时静默
6. 折叠练习答案可展开收起
7. `npm test` 通过
8. `npm run build` 通过
