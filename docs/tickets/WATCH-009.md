# WATCH-009 — 字幕下载改为 PDF 文稿（替换作废的 SRT）

**优先级**：P2
**区域**：watch / 字幕面板右侧工具条 / `src/app/watch/TranscriptPanel.tsx`
**设计**：Gemini1（按钮文案/位置 + PDF 版式）
**实现**：Codex1
**测试**：Codex2 + Gemini1 评审 + PM 验收
**替代**：WATCH-008（SRT，已作废）
**预估**：1 天（PDF 中文字体是主要不确定项）

---

## 背景

- WATCH-007 用 `window.print()` 打印导出 → **打印空白**（逐字稿虚拟化渲染，DOM 里只有可见行）。
- WATCH-008 改用 SRT 下载绕开了 DOM 空白 bug，但 **PM + 用户实测：srt 对在线学习者不直观** —— 用户不知道怎么打开，且本站是 YouTube 在线播放、用户手上没有本地视频文件可外挂，srt 大多只能当文本读。
- **产品决策（2026-06-01）**：字幕下载改为 **PDF 文稿**，双击即可阅读，适合离线复习/打印。srt 作废。

> 同期决策：视频下方另加「下载视频及字幕」入口 —— **本轮不做**，后续另开票（涉及 YouTube ToS / yt-dlp 后端成本 / 版权，需单独评估）。

---

## 用户可见行为

- 字幕面板**右侧**「下载字幕」按钮 → **一键下载 `.pdf`**（无系统打印对话框）。
- 内容**跟随当前显示模式**：ES+中 → 双语（西上中下）/ 仅西语 / 仅中文。
- **跟随加载方式**：sentence 模式按句、cue 模式按 cue。
- 中文正常显示，不丢字、不乱码。
- 文件名如 `{videoId}-{mode}.pdf`。

---

## 实施要求（含两个必避的坑）

1. **❌ 严禁 `window.print()`**：这正是 WATCH-007 失败的原因。必须程序化生成 PDF 并触发下载，无打印对话框。
2. **从完整数据数组生成，不依赖 DOM**：用完整 `sentenceGroups` / `transcriptCues`（不是只渲染可见行的 `renderedSentences/renderedCueRows`）。这是绕开虚拟化空白 bug 的关键。
3. **⚠️ 中文字体嵌入（PDF 最大风险）**：PDF 默认字体（如 jsPDF 内置 Helvetica）**不含中文字形**，直接绘制中文会丢字/方块/乱码。Codex1 需选定可行方案并落地，例如：
   - 客户端 jsPDF + **子集化**中文字体（控制体积，避免整包数 MB 拖累 bundle）；或
   - 服务端 API route 生成 PDF（pdfkit/puppeteer 等，天然支持 CJK，但要评估架构成本）；或
   - 其它等效方案。
   - **若 PDF + 中文实现成本过高、被阻塞**：在 `session-handoff.md` 反馈 PM，**不要擅自降级成 txt** —— 由 PM 决策。
4. **复用 WATCH-008 成果**：WATCH-008 已写好「按显示模式 + 加载方式从完整数组提取文本」的逻辑（`TranscriptPanel.tsx`）。复用这套文本提取，只把输出从 SRT 字符串换成 PDF 文档。
5. **清理**：移除 WATCH-008 的 SRT 生成代码（`formatSrtTimestamp`、`.srt` Blob/下载等），避免两套下载并存。
6. **下载触发**：`Blob` + `URL.createObjectURL` + 隐藏 `<a download>`（或库自带 save）。

---

## 设计待 Gemini1 定（设计稿 `docs/tickets/WATCH-009-design.md`）

- 「下载字幕」按钮在右侧工具条的**确切位置 / 文案 / 图标**。
- PDF **版式**：标题（视频名？）、是否保留**时间戳**（文稿以可读为主，时间戳可选）、双语模式下西/中的排版（西上中下 vs 左右）、字号/行距。
- 是否需要下载格式说明文案（一句话即可，因为不再是 srt 那种需要外挂的格式）。

---

## 验收标准

- [ ] 右侧「下载字幕」点击一键生成 `.pdf`，**无打印对话框**。
- [ ] PDF 从完整数组生成，内容完整不丢行（不受虚拟化影响）。
- [ ] **中文字形正确**，不丢字/不乱码（外部 PDF 阅读器打开验证）。
- [ ] 内容跟随显示模式（三选一）+ 加载方式（sentence/cue）。
- [ ] 版式符合 Gemini1 设计稿（评审比对）。
- [ ] `npm test` 全绿 + `npm run build` 通过 + `lint:encoding` 通过。

---

## 不在本 ticket 范围

- ❌ 「下载视频及字幕」（视频下方入口）—— 后续另开票。
- ❌ 其它格式（srt/txt/vtt）。
- ❌ 加载方式切换本身（WATCH-007 已做）。

---

## 流程（有 UI）

Claude1（本 ticket）→ Gemini1（设计稿）→ Codex1（实现 + 单测）→ Codex2（端到端测试）→ Gemini1（UI 评审）→ Claude1（最终验收）。

> 协作提醒：UTF-8 编辑器；勿改无关文件；**watch / 字幕区多 agent 并发，开工前务必确认拿到 `TranscriptPanel.tsx` 最新代码**。
