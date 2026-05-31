# WATCH-004 — 字幕中文断句优化 UI 设计稿

本设计稿规定了 `TranscriptPanel.tsx`（右侧逐字稿面板）的组件结构、Tailwind 样式、暗色模式、交互行为以及句子分组辅助逻辑。

---

## 1. 句子分组算法与数据结构

为了实现「中文按句翻译与展示」而不破坏西语的「逐词查词」和「当前播放行高亮」，我们需要在组件内引入**句子（Sentence）**这一容器级逻辑实体。

### 1.1 句子数据结构定义 (TypeScript)

```typescript
type SubtitleCue = {
  start: number;
  dur: number;
  text: string;
};

type SentenceGroup = {
  id: string;          // 唯一标识，如 "s-{start}"
  cues: SubtitleCue[]; // 该句子包含的原始字幕 cue 数组
  startIndex: number;  // 在合并后 cues 数组中的起始索引
  endIndex: number;    // 在合并后 cues 数组中的结束索引
  text: string;        // 拼接后的完整西语文本（以空格分隔）
};
```

### 1.2 句子分组逻辑

开发中可复用 `groupCuesIntoSentences(cues: SubtitleCue[]): SentenceGroup[]` 工具方法：

```typescript
function groupCuesIntoSentences(cues: SubtitleCue[]): SentenceGroup[] {
  const sentences: SentenceGroup[] = [];
  let currentCues: SubtitleCue[] = [];
  let startIndex = 0;

  const isSentenceEnd = (text: string) => {
    return /[.!?…。？！]\s*$/.test(text.trim());
  };

  const MAX_CUES_PER_SENTENCE = 4; // 强制断句阈值：防止无标点长片导致单句过长

  for (let i = 0; i < cues.length; i++) {
    const cue = cues[i];
    if (currentCues.length === 0) {
      startIndex = i;
    }
    currentCues.push(cue);

    const isEnd = isSentenceEnd(cue.text);
    const isTooLong = currentCues.length >= MAX_CUES_PER_SENTENCE;
    const isLast = i === cues.length - 1;

    if (isEnd || isTooLong || isLast) {
      const mergedText = currentCues
        .map((c) => c.text.trim())
        .join(" ")
        .replace(/\s+/g, " ");

      sentences.push({
        id: `s-${currentCues[0].start.toFixed(2)}`,
        cues: [...currentCues],
        startIndex,
        endIndex: i,
        text: mergedText,
      });
      currentCues = [];
    }
  }

  return sentences;
}
```

---

## 2. 界面布局与对齐规范 (ASCII Mockup)

在不同的显示模式下，整个面板的呈现需重新排版。

### 2.1 ES+中 (Bilingual) 模式

*   **西语层**：同一句内的 cue 逐行垂直堆叠（保持其作为独立交互行），无多余分割线。
*   **中文层**：整句翻译挂在句子底端，向右缩进 `pl-[42px]`，以便在视觉上与西语文本的左边缘精准对齐（避开左侧时间戳区域）。

```text
+-----------------------------------------------------------+
| [0:02] Bienvenidos a otro episodio                        |  <- Cue A (正在播放，高亮)
|        del podcast de Dreaming Spanish, un                |  <- Cue B (普通)
|        podcast semanal para personas                      |  <- Cue C (普通)
| [0:10] que aprenden español.                              |  <- Cue D (句尾，hover 显示时间戳)
|                                                           |
|        欢迎收听 Dreaming Spanish 的又一期播客，           |  <- 中文翻译 (小一号，挂在句尾下方)
|        这是一档为西班牙语学习者准备的周更播客。           |
+-----------------------------------------------------------+
| [0:15] Hoy vamos a hablar de un tema interesante.         |  <- 下一句 (以 border-t 分隔)
|        ...                                                |
```

### 2.2 仅中文 (Chinese Only) 模式

*   不显示任何西语文本。
*   每句中文翻译独立为一整块，并在左侧固定显示该句起始时间戳。
*   点击该块的任何区域均可 seek 到该句的起点。

```text
+-----------------------------------------------------------+
| [0:02] 欢迎收听 Dreaming Spanish 的又一期播客，           |  <- 点击此整块跳转到 0:02 播放
|        这是一档为西班牙语学习者准备的周更播客。           |
+-----------------------------------------------------------+
| [0:15] 今天我们将讨论一个有趣的话题。                     |  <- 点击跳转到 0:15 播放
+-----------------------------------------------------------+
```

---

## 3. 组件结构与 Tailwind 样式定义

以下为 Codex1 实施时需直接采用的 JSX 结构和样式规范。

### 3.1 句子容器组件 (Sentence Wrapper)

句子作为一个整体卡片容器，用来统一底部分隔线、激活状态背景和 hover 微光。

```jsx
// 检查句子内是否有任一 cue 处于播放状态
const isSentenceActive = activeCueIndex >= sentence.startIndex && activeCueIndex <= sentence.endIndex;

<div
  className={`group/sentence px-5 py-4 border-b border-zinc-100 dark:border-zinc-850/65 first:border-t first:border-t-zinc-100 dark:first:border-t-zinc-850/65 transition-colors duration-150 ${
    isSentenceActive 
      ? "bg-zinc-50/30 dark:bg-zinc-900/10 border-l-[3px] border-l-brand-600 pl-[17px]" // 激活状态：左侧突出绿条，pl 减去 3px 保持对齐
      : "hover:bg-zinc-50/15 dark:hover:bg-zinc-900/5 border-l-[3px] border-l-transparent pl-[17px]"
  }`}
  data-sentence-id={sentence.id}
>
  {/* 内部渲染西语和中文 */}
</div>
```

### 3.2 西语 Cues 列表渲染 (`displayMode !== "chinese"`)

在句子容器内部，西语 cue 纵向排列。

```jsx
<div className="space-y-2">
  {sentence.cues.map((cue, idx) => {
    const globalIndex = sentence.startIndex + idx;
    const isCueActive = globalIndex === activeCueIndex;
    
    return (
      <div key={globalIndex} className="group/cue flex items-start gap-2 min-w-0">
        {/* 时间戳指示器 */}
        <button
          onClick={() => {
            onSeek(cue.start);
            setFollowMode(true);
          }}
          type="button"
          className={`mt-1 cursor-pointer text-[10px] font-bold tabular-nums tracking-[0.3px] transition font-display min-w-[34px] text-left ${
            isCueActive
              ? "opacity-100 text-brand-600 dark:text-brand-400"
              : "opacity-0 text-zinc-400 group-hover/cue:opacity-100 group-hover/sentence:opacity-60"
          }`}
        >
          {formatTimestamp(cue.start)}
        </button>

        {/* 西语单词渲染区域 */}
        <span
          className={`flex-1 text-[15px] leading-7 tracking-[0.05px] font-sans ${
            isCueActive
              ? "font-semibold text-brand-600 dark:text-brand-400"
              : "font-medium text-zinc-800 dark:text-zinc-200"
          }`}
        >
          {/* 原样保留：短语 span + 单词 span 查词渲染逻辑 */}
        </span>
      </div>
    );
  })}
</div>
```

### 3.3 中文翻译渲染 (`displayMode !== "spanish"`)

#### A. 双语 (Bilingual) 模式下的中文段落：
```jsx
<div className="mt-2.5 pl-[42px] min-w-0">
  <p
    className={`font-sans text-[13px] leading-6 tracking-[0.2px] transition-colors duration-150 ${
      isSentenceActive
        ? "text-zinc-600 dark:text-zinc-300 font-medium"
        : "text-zinc-400 dark:text-zinc-500"
    }`}
  >
    {translations[sentence.startIndex] ?? "…"}
  </p>
</div>
```

#### B. 仅中文 (Chinese) 模式下的渲染：
仅中文模式下不再渲染西语结构，直接输出中文段落，并在左侧固定带有可点击时间戳。
```jsx
<div className="flex items-start gap-2 min-w-0">
  {/* 句子起始时间戳 */}
  <button
    onClick={() => {
      onSeek(sentence.cues[0].start);
      setFollowMode(true);
    }}
    type="button"
    className={`mt-1 cursor-pointer text-[10px] font-bold tabular-nums tracking-[0.3px] transition font-display min-w-[34px] text-left ${
      isSentenceActive
        ? "text-brand-600 dark:text-brand-400"
        : "text-zinc-400 dark:text-zinc-500"
    }`}
  >
    {formatTimestamp(sentence.cues[0].start)}
  </button>

  {/* 中文翻译 */}
  <p
    className={`flex-1 font-sans text-[14px] leading-6.5 tracking-[0.2px] transition-colors duration-150 ${
      isSentenceActive
        ? "text-zinc-800 dark:text-zinc-150 font-semibold"
        : "text-zinc-500 dark:text-zinc-400 font-medium"
    }`}
  >
    {translations[sentence.startIndex] ?? "…"}
  </p>
</div>
```

---

## 4. 虚拟滚动与滑动窗口适配

因为列表的虚拟化渲染依赖 `renderStart` 和 `renderEnd`，现在必须以**句子（SentenceGroup）**作为虚拟滚动的基本单位：

1. `renderedSentences = sentenceGroups.slice(renderStart, renderEnd)`
2. 原来计算 `activeCueIndex` 与滑动窗口边缘距离并触发扩展的 `useEffect`，现在改用计算 `activeSentenceIndex`：
   * `const activeSentenceIndex = sentenceGroups.findIndex(s => activeCueIndex >= s.startIndex && activeCueIndex <= s.endIndex);`
   * 滑动判定、Sentinel 监听与加载行为等逻辑按句子索引做对应修正。
3. `INITIAL_RENDER_COUNT` 调整为 `8`，`LOAD_MORE_BATCH` 调整为 `10`（因为单句的纵向尺寸平均为单 cue 的 2-3 倍，保持适度的初始渲染量）。

---

## 5. UI 设计审查核对表

*   [ ] 翻译对齐：双语模式下中文必须左边距对齐西语文本起点（`pl-[42px]` 缩进）。
*   [ ] 状态联动：激活句子时，整句背景变淡灰色，仅当前播放 cue 标绿，中文译文稍有加深。
*   [ ] 字体规范：西语 `text-[15px]`，中文双语下 `text-[13px]`，中文单语下 `text-[14px]`。无自定义硬编码字号。
*   [ ] 交互未回归：点击西语单词仍然能正常弹出 Lookup 查词面板。
