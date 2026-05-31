# WATCH-005 — 禁用 YouTube 原生字幕自动加载

**优先级**：P1（播放体验，解决字幕遮挡重叠问题）
**区域**：watch / 视频播放器 / `src/app/watch/WatchClient.tsx`
**设计**：Gemini1（出禁用原生字幕参数的设计稿）
**实现**：Codex1（修改 iframe 嵌入参数）
**测试**：Codex2 + PM 验收
**依赖**：无
**预估**：0.5 小时

---

## 背景 / 问题

在视频播放页面（`/watch`），我们使用 Supadata 字幕渲染了美观的高亮交互实时字幕（`SubtitlePanel` 悬浮层）。但是，由于嵌入的 YouTube Iframe URL 中强制指定了 `cc_load_policy=1` 和 `cc_lang_pref=es`，导致 YouTube 原生的字幕（白色/黄色大字）也会被默认开启，与我们的自定义悬浮字幕在屏幕底部重合、遮挡，造成极差的视觉体验。

---

## 目标

- 禁用 YouTube 嵌入播放器对原生字幕的强制加载行为。
- 让 YouTube 播放器默认不显示原生字幕，完全由我们自定义的 `SubtitlePanel` 进行实时字幕展示。

---

## 用户可见行为

- 打开任意视频，底部的 YouTube 视频区域默认不会显示原生的白色/黄色字幕，只显示我们高度集成的交互字幕。
- 视频下方的交互双语字幕、右侧逐字稿均不受影响。

---

## 实施要求

### 1. 播放器嵌入参数修改
- 在 `src/app/watch/WatchClient.tsx` 中定位到渲染 `<iframe>` 的位置（第 271 行左右）。
- 将 `cc_load_policy=1` 修改为 `cc_load_policy=0`（或移除）。
- 移除 `&hl=es&cc_lang_pref=es` 参数，防止强制调取原生字幕轨道。

---

## 验收标准

- [ ] 视频播放页加载时，YouTube 播放器默认不再自动弹出原生白色/黄色字幕。
- [ ] 我们的自定义实时双语悬浮字幕正常渲染，无视觉重合遮挡。
- [ ] `npm test` 通过。
