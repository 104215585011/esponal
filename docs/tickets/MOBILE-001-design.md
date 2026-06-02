# MOBILE-001 设计修订案 — 移动端歌词态转写面板 (Lyrics-style Transcript)

本设计规范明确了 `WatchMobileLayout` 移除旧版字幕面板的逻辑，以及将 `TranscriptPanel` 在移动端升级为**沉浸式歌词阅读 + 词级高亮**的具体样式和计算规则。

---

## 1. 移动端布局重构 (`WatchMobileLayout.tsx`)

### 1.1 Tab 切换精简
- **移除**：旧版的 `subtitle` (字幕) Tab。
- **保留**：仅保留 `transcript` (转写) 和 `related` (推荐) 两个 Tab。
- **默认选中**：`transcript`。
- **Tab 栏样式**：
  ```jsx
  <button className="flex-1 flex items-center justify-center text-xs font-semibold h-10 border-b-2 transition-all border-brand-500 text-brand-400">
    转写
  </button>
  <button className="flex-1 flex items-center justify-center text-xs font-semibold h-10 border-b-2 transition-all border-transparent text-zinc-500">
    推荐
  </button>
  ```

---

## 2. TranscriptPanel 移动端歌词态 (Lyrics Style)

当 `isMobile` 为 `true` 时，`TranscriptPanel` 放弃传统的边框和列表样式，采用类似 Apple Music 歌词的无边框、缩放景深样式。

### 2.1 句子/Cue 容器状态

对渲染出的每一行 Cue（或 Sentence），根据其是否为当前激活句（`isActive`）应用不同的样式：

**激活句 (Active Row)**：
- **外层容器**：`relative group px-4 py-6 transition-all duration-300 opacity-100 scale-100`
- **西文文本**：`text-[22px] leading-[1.5] tracking-wide font-bold text-zinc-100`
- **中文翻译**：`mt-2.5 text-[15px] leading-relaxed font-medium text-brand-400/90`

**未激活句 (Inactive Row)**：
- **外层容器**：`relative group px-4 py-4 transition-all duration-300 opacity-30 scale-[0.98] blur-[0.3px] hover:opacity-50`
- **西文文本**：`text-[22px] leading-[1.5] tracking-wide font-semibold text-zinc-500`
- **中文翻译**：`mt-2.5 text-[15px] leading-relaxed font-medium text-zinc-600`

---

## 3. 词级高亮计算与样式 (Word-level Highlight)

为了将旧版字幕面板的“跟读”体验合并进转写面板，我们需要在**当前激活的行 (activeCueIndex)** 内，根据视频播放进度高亮具体的单词。

### 3.1 进度计算逻辑
在 `TranscriptPanel.tsx` 渲染具体 Cue 的循环内：
如果 `index === activeCueIndex`，则计算当前播放单词的索引：
```typescript
const elapsed = currentTimeSec - cue.start; // 如果是 sentence mode，使用当前所在的内部 cue.start
const progress = Math.min(Math.max(0, elapsed / cue.dur), 0.99);

// 提取当前 cue 的所有可查询单词（忽略标点符号词）
const lookupWordIndices: number[] = [];
tokens.forEach((token, idx) => {
  if (normalizeLookupWord(token)) {
    lookupWordIndices.push(idx);
  }
});

// 计算当前高亮单词在 tokens 中的实际 index
let activeWordTokenIndex = -1;
if (lookupWordIndices.length > 0) {
  const wordProgressIndex = Math.floor(progress * lookupWordIndices.length);
  activeWordTokenIndex = lookupWordIndices[wordProgressIndex];
}
```
*注：Codex1 需根据 `transcriptMode` (句子级 vs 逐行) 灵活适配上述逻辑。句子模式下可迭代内部 `sentence.cues`。*

### 3.2 单词样式 (Word Tokens)
渲染单词时，对比单词在 `tokens` 中的 index 是否等于 `activeWordTokenIndex`。

**当前正在播放的单词 (Currently Playing Word)**：
- 药丸风格高亮 (Pill highlight)：`bg-brand-500 text-white shadow-md shadow-brand-500/20 px-1.5 py-0.5 rounded-md mx-px transition-colors duration-150`

**普通可查词 (Lookable Words - Inactive but in active sentence)**：
- **课程词汇 (Course)**: `text-brand-400 hover:bg-zinc-800/80 rounded px-0.5 transition-colors`
- **收藏词汇 (Saved)**: `text-zinc-100 underline decoration-dotted decoration-1 decoration-zinc-500 hover:bg-zinc-800/80 rounded px-0.5 transition-colors`
- **未知词汇 (Unknown)**: `text-zinc-100 hover:bg-zinc-800/80 rounded px-0.5 transition-colors`

**短语块 (Phrase Segment - 类似旧版)**：
- 播放到短语块内部时，整个短语块可以呈现：`bg-amber-500/20 border-b border-amber-500/40 rounded px-1 py-0.5 mx-0.5`（非强制，若难以切分，也可沿用单词药丸高亮机制）。

---

## 4. 自动滚动与自动跟随 (Auto-Follow)
- `TranscriptPanel` 已有 `auto-follow` 机制，请确保其继续生效。
- 移动端取消显示时间戳（`hidden`），让界面完全聚焦在西中双语的歌词阅读上。
- 移除顶部的 Tab（双语/仅西语/仅中文等控制），移动端强制使用“双语”模式（或者将其整合到极简的三态切换按钮，如原 SubtitlePanel 底部）。

---
**给 Codex1 的实现提示**：
1. 请先清理 `WatchMobileLayout` 中的 Tab 数组，删除 `"subtitle"` 相关逻辑和组件引入。
2. 重点修改 `TranscriptPanel.tsx` 里的 `renderCueRow` 和 sentence 渲染逻辑，加入对 `isMobile` 的样式分支。
3. 单词高亮的 `activeWordTokenIndex` 只需在 `isActive === true` 的那一行计算。
