# WATCH-008 — 字幕下载改为 SRT（替换失效的打印导出）

**优先级**：P2
**区域**：watch / 字幕工具条 / `src/app/watch/TranscriptPanel.tsx`
**实现**：Codex1
**测试**：Codex2 + PM 验收
**依赖**：WATCH-007（下载按钮已存在，本票替换其行为）
**预估**：0.5 天

---

## 背景

WATCH-007 用 `window.print()` + `@media print` 打印视图做字幕下载。**PM 实测：打印出来是空的。**

根因：右侧逐字稿是**虚拟化渲染**（只把可见的几条 cue 挂到 DOM），`#print-transcript-area` 里绝大部分内容根本不在 DOM 中，所以打印区域是空白。

**方案改向**：放弃打印，改 **SRT 文件下载**。理由：纯文本、零中文字体问题、一键直接下载、能导入外部播放器/字幕工具。SRT 从完整数据数组生成，天然绕开虚拟化 DOM 空白 bug。

---

## 用户可见行为

- 点击字幕下载按钮 → **一键下载 `.srt` 文件**（无系统打印对话框）。
- 内容**跟随当前显示模式**：
  - ES+中 → 双语（西语在上、中文在下，同一时间块内）。
  - 仅西语 → 只西语。
  - 仅中文 → 只中文。
- **跟随加载方式**：
  - sentence 模式 → 按句导出，时间段 = 句首 cue.start → 句末 cue.end。
  - cue 模式 → 按 cue 导出。
- 中文显示正常（UTF-8，不乱码）。

---

## 实施要求

1. **从完整数据生成，不依赖 DOM**：用 `sentenceGroups` / `transcriptCues` 完整数组（不是只渲染可见行的 `renderedSentences/renderedCueRows`）。这是避免重蹈打印空白 bug 的关键。
2. **SRT 时间格式**：标准 `HH:MM:SS,mmm`（注意是逗号毫秒）。现有 `formatTimestamp` 是 `M:SS` 仅供展示，**需另写一个 srt 专用时间格式化函数**。
3. **SRT 结构**：每条 = 序号 + `\n` + `开始 --> 结束` + `\n` + 文本行（双语模式西语一行、中文一行）+ `\n\n`。
4. **下载触发**：`Blob` + `URL.createObjectURL` + 隐藏 `<a download>`，文件名如 `{videoId}-{mode}.srt`。
5. **移除**：WATCH-007 的 `window.print()` 调用、`#print-transcript-area`、`@media print`（globals.css 那段）—— 清理掉失效的打印实现。
6. **复用**：现有 `displayRows`(line ~920) 的「跟随模式取文本」逻辑可参考，但时间要取真实 start/end（SRT 需要结束时间，displayRows 现在只存了展示用 timestamp）。

---

## 验收标准

- [ ] 点击下载一键生成 `.srt`，无打印对话框。
- [ ] SRT 格式标准（序号 + `HH:MM:SS,mmm --> HH:MM:SS,mmm` + 文本），可导入外部播放器验证。
- [ ] 内容跟随显示模式（三选一）+ 加载方式（sentence/cue）。
- [ ] 中文不乱码。
- [ ] 内容完整（不因虚拟化丢行）。
- [ ] `npm test` 全绿 + `lint:encoding` 通过。

---

## 不在本 ticket 范围

- ❌ 其他下载格式（PDF/TXT/VTT）—— 本票只做 SRT。
- ❌ 加载方式切换本身（WATCH-007 已做）。

---

## 流程

Claude1（本 ticket）→ Codex1（实现 + 单测）→ Codex2（测试）→ Claude1 验收。
UI 改动极小（按钮已存在），不强制走 Gemini；如需文案/格式选择 UI 再回 Gemini1。

> 协作提醒：UTF-8 编辑器；勿改无关文件；watch 区多 agent 并发，开工前确认拿到最新代码。
