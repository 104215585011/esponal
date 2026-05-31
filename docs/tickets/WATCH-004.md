# WATCH-004 — 字幕中文断句优化（句子级合并翻译 + 中文按句显示）

**优先级**：P1（字幕可读性，直接影响核心学习体验）
**区域**：watch / 字幕 / `src/app/watch/TranscriptPanel.tsx`、`src/app/watch/SubtitlePanel.tsx`
**设计**：Gemini1（出中文按句展示的设计稿）
**实现**：Codex1（句子合并算法 + 翻译层 + 展示层）
**测试**：Codex2 + PM 验收
**依赖**：无（基于现有 `/api/translate` 腾讯翻译）
**预估**：1-1.5 天

---

## 背景 / 问题

右侧逐字稿（TranscriptPanel）的**中文翻译断句别扭**，常见症状：半句中文、「呢？你好吗？」这类残句、一句话的中文被劈成两块分散在两行。

**根因（已定位）**：翻译是**按字幕 cue 逐块翻译**的——`TranscriptPanel.tsx` 里 `translateCue(index, text)` 对每个 cue 单独调 `/api/translate`。但 YouTube 字幕 cue 是**按播放时长**切的，不是按句子切的。一句完整西语常跨 2-3 个 cue，被切成半句分别送翻译；腾讯翻译拿到无上下文的半句，只能硬翻 → 残句。

**举例**：
> 西语原句（跨两个 cue）："Bienvenidos a otro episodio del podcast de Dreaming Spanish, un podcast semanal para / personas que aprenden español."
>
> 现状：cue A 译「…这是一部每周播客」、cue B 译「学习西班牙语的人。在这里，」→ 割裂、不通顺。

---

## 目标

- **西语展示层不变**：仍逐 cue 渲染，逐词可点查词、当前 cue 高亮、自动滚动跟随、虚拟化窗口全部保留（这些都依赖 cue 粒度，不能动）。
- **翻译层改成"句子"**：相邻 cue 先用句末标点拼回完整句子，整句送翻译 → 中文通顺，且翻译调用次数更少（更省额度）。
- **中文展示层改成"按句"**：一句话的中文显示在该句对应的西语区域下方/末尾，不再每个 cue 硬塞一行半截中文。

---

## 用户可见行为

- 打开任意视频，右侧逐字稿的中文翻译**成句、通顺**，不再出现半句/残句。
- 西语仍逐词可点查词，点击行为、当前句高亮、自动滚动跟随不回归。
- 「仅西语 / 仅中文 / ES+中」三种模式仍正常（仅中文模式下中文按句呈现）。

---

## 实施要求

### 1. cue → 句子分组（纯逻辑，可先独立做 + 单测）
- 新增工具，例如 `groupCuesIntoSentences(cues: SubtitleCue[]): SentenceGroup[]`。
- 规则：按顺序累积 cue 文本，遇到句末标点（`. ? ! … 。？！` 以及西语 `¿¡` 的闭合）判定句子结束；句子记录其覆盖的 cue index 区间 `[startCue, endCue]` 和拼接后的整句文本。
- 边界：超长无标点的句子设上限（如累计 > N 字符或 > M 个 cue 强制断句，避免整段不分）；保留原 cue 数组不被破坏。
- 复用参考：现有 `mergeSubtitleCues`（TranscriptPanel line 278）的合并思路。

### 2. 翻译层改造
- 翻译的输入从「单 cue」改为「句子整句」。
- 翻译结果按句缓存（`translationCacheRef` key 用整句文本，天然去重）。
- `/api/translate` 路由**不必改**（已接受任意文本、有 1000 字上限、有 Redis 缓存）。注意整句可能超过单 cue，但远低于 1000 字上限。
- 保留现有的降级/重试/429 处理逻辑。

### 3. 展示层（**需 Gemini 设计稿**）
- 中文从「每 cue 一行」改为「每句一块」，挂在该句最后一个 cue 下方或句子区域。
- 设计稿需明确：中文块的位置（句尾下方 vs 跨 cue 区域）、ES+中 模式下中西如何对齐、仅中文模式的呈现、字号/颜色沿用现有（中文小一号灰色）。
- 同步评估 SubtitlePanel（底部/叠加字幕）是否需要一致处理——本 ticket 以 TranscriptPanel 右侧逐字稿为主，SubtitlePanel 若改动较大可拆子票。

### 4. 不回归
- 逐词查词、当前句高亮、自动滚动跟随、虚拟化渲染窗口、三种显示模式切换全部保持。

---

## 验收标准

- [ ] `groupCuesIntoSentences` 有单测：跨 cue 合并、标点断句、超长无标点强制断句、空输入。
- [ ] 翻译按整句进行（可通过 mock 验证调用入参是整句而非半句）。
- [ ] 实测打开一个 Dreaming Spanish 类视频，右侧中文成句通顺，无半句残句。
- [ ] 逐词查词、当前句高亮、自动滚动、三模式切换不回归。
- [ ] Gemini1 UI 评审通过（对照设计稿）。
- [ ] `npm test` 全绿。

---

## 不在本 ticket 范围

- ❌ 更换翻译引擎（继续用腾讯 TMT；引擎质量是另一议题）。
- ❌ 字幕时间轴/cue 本身的重新切分（西语展示层不动）。
- ❌ SubtitlePanel 叠加字幕的大改（如需，拆子票）。

---

## 流程

Claude1（本 ticket）→ **Gemini1（中文按句展示设计稿 → docs/tickets/WATCH-004-design.md）** → Codex1（实现：句子合并算法 + 翻译层 + 展示层）→ Codex2（端到端测试）→ Gemini1（UI 评审）→ Claude1 最终验收。

> 说明：第 1 步「cue→句子分组算法 + 翻译层」是无 UI 的纯逻辑，Codex1 可在等设计稿期间先行实现 + 单测；第 3 步展示层须等 Gemini 设计稿。
