# WATCH-007 — 字幕区工具条与 PDF 打印下载 UI 设计稿

本设计稿规定了 `TranscriptPanel.tsx` 顶部工具条的重新排版、加载方式（句子级/逐 cue）切换的 UI 状态、下载 PDF 的系统打印方案以及 CSS 打印排版规范。

---

## 1. 顶部工具条 UI 布局重构

右侧字幕面板顶部的 Header 容器需要重构，以容纳「显示语言」、「加载方式」和「下载 PDF」三个操作区。

### 1.1 ASCII 布局设计 (Toolbar Layout)

```text
+-----------------------------------------------------------------------+
| [ ES+中 | 仅西语 | 仅中文 ]        [ 句子级 | 逐行 ]   [ ⬇ 下载 ]     |
+-----------------------------------------------------------------------+
```

*   **左侧**：原有的双语/单语切换 tabs（Pill 按钮）。
*   **右侧**：新增加载方式切换 tabs（Pill 按钮）以及「下载 PDF」按钮（带 Icon）。三者横向排开，使用 `ml-auto` 进行右对齐，并在小屏幕上自适应换行。

### 1.2 TSX 结构与 Tailwind 样式

```jsx
<div className="flex flex-wrap items-center justify-between gap-3 border-b border-gray-100 dark:border-zinc-800/80 px-5 py-4 font-display">
  {/* 左侧：显示模式切换 (displayMode) */}
  <div className="flex rounded-full bg-gray-150/70 dark:bg-zinc-850 p-0.5 text-[11px] font-semibold text-gray-500">
    <button
      className={`rounded-full px-3 py-1 transition ${
        displayMode === "bilingual" ? "bg-white dark:bg-zinc-800 text-zinc-900 dark:text-zinc-100 shadow-sm" : ""
      }`}
      onClick={() => setDisplayMode("bilingual")}
      type="button"
    >
      ES + 中
    </button>
    <button
      className={`rounded-full px-3 py-1 transition ${
        displayMode === "spanish" ? "bg-white dark:bg-zinc-800 text-zinc-900 dark:text-zinc-100 shadow-sm" : ""
      }`}
      onClick={() => setDisplayMode("spanish")}
      type="button"
    >
      仅西语
    </button>
    <button
      className={`rounded-full px-3 py-1 transition ${
        displayMode === "chinese" ? "bg-white dark:bg-zinc-800 text-zinc-900 dark:text-zinc-100 shadow-sm" : ""
      }`}
      onClick={() => setDisplayMode("chinese")}
      type="button"
    >
      仅中文
    </button>
  </div>

  {/* 右侧组合区（加载方式切换 + 下载按钮） */}
  <div className="flex items-center gap-3 ml-auto">
    {/* 加载方式切换 (transcriptMode) */}
    <div className="flex rounded-full bg-gray-150/70 dark:bg-zinc-850 p-0.5 text-[11px] font-semibold text-gray-500">
      <button
        className={`rounded-full px-3 py-1 transition ${
          transcriptMode === "sentence" ? "bg-white dark:bg-zinc-800 text-zinc-900 dark:text-zinc-100 shadow-sm" : ""
        }`}
        onClick={() => setTranscriptMode("sentence")}
        type="button"
      >
        句子级
      </button>
      <button
        className={`rounded-full px-3 py-1 transition ${
          transcriptMode === "cue" ? "bg-white dark:bg-zinc-800 text-zinc-900 dark:text-zinc-100 shadow-sm" : ""
        }`}
        onClick={() => setTranscriptMode("cue")}
        type="button"
      >
        逐行
      </button>
    </div>

    {/* 下载 PDF 按钮 */}
    <button
      onClick={handlePrintDownload}
      type="button"
      className="flex items-center gap-1.5 rounded-full border border-zinc-200 dark:border-zinc-800 bg-white dark:bg-zinc-900 px-3 py-1 text-[11.5px] font-semibold text-zinc-600 dark:text-zinc-350 hover:bg-zinc-50 dark:hover:bg-zinc-800 transition shadow-sm"
    >
      {/* 极简下载图标 */}
      <svg className="w-3.5 h-3.5 text-zinc-500 dark:text-zinc-400" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2.5">
        <path strokeLinecap="round" strokeLinejoin="round" d="M3 16.5v2.25A2.25 2.25 0 005.25 21h13.5A2.25 2.25 0 0021 18.75V16.5M16.5 12L12 16.5m0 0L7.5 12m4.5 4.5V3" />
      </svg>
      <span>下载</span>
    </button>
  </div>
</div>
```

---

## 2. 状态管理与数据记忆

1. `transcriptMode: "sentence" | "cue"` 状态保存在 `TranscriptPanel.tsx` 中。
2. 初始值应通过 `useEffect` 从 `localStorage.getItem("esponal_transcript_mode")` 加载，默认为 `"sentence"`，更新时同步写入 `localStorage`。
3. 加载方式切换时，必须调用 `setFollowMode(true)` 强行重置自动跟随，避免因为列表高度大变导致虚拟滚动窗口出现白屏或定位错误。

---

## 3. PDF 字幕下载实现方案（系统打印另存为 PDF）

为避免 jsPDF 引入巨大 CJK 字形包撑爆 Next.js 包大小，采用**打印视图 + 浏览器另存为 PDF** 方案。

### 3.1 隐藏式全量渲染容器 (Print-Only Container)

在 `TranscriptPanel.tsx` 底部，渲染一个在屏幕模式下不可见（`hidden`）但在打印模式下可见（`print:block`）的全量非虚拟化列表容器。此容器中的内容完全跟随当前的 `displayMode` 和 `transcriptMode` 状态。

```jsx
{/* 打印专用容器：在屏幕中不渲染，在打印预览中全量显示 */}
<div id="print-transcript-area" className="hidden print:block w-full text-black bg-white px-8 py-10 font-sans">
  {/* 视频标题 */}
  <h1 className="text-2xl font-bold border-b-2 border-zinc-200 pb-3 mb-6 font-display">
    {videoTitle || "Español Transcript"}
  </h1>

  <div className="space-y-6">
    {transcriptMode === "sentence"
      ? sentenceGroups.map((sentence, idx) => (
          <div key={sentence.id} className="page-break-avoid border-b border-zinc-100 pb-4 last:border-b-0">
            {/* 时间戳与西语原文 */}
            {displayMode !== "chinese" && (
              <div className="flex items-start gap-2">
                <span className="text-[10px] font-bold font-display tabular-nums text-zinc-400 mt-1.5 min-w-[36px]">
                  [{formatTimestamp(sentence.cues[0].start)}]
                </span>
                <span className="text-[14px] font-medium leading-7 text-zinc-800">
                  {sentence.text}
                </span>
              </div>
            )}
            
            {/* 中文译文 */}
            {displayMode !== "spanish" && (
              <p className={`text-[12.5px] leading-6 text-zinc-500 ${displayMode === "bilingual" ? "pl-11 mt-1" : ""}`}>
                {translations[sentence.startIndex] ?? ""}
              </p>
            )}
          </div>
        ))
      : transcriptCues.map((cue, idx) => (
          <div key={idx} className="page-break-avoid border-b border-zinc-100 pb-4 last:border-b-0">
            {/* 逐 cue 原文 */}
            {displayMode !== "chinese" && (
              <div className="flex items-start gap-2">
                <span className="text-[10px] font-bold font-display tabular-nums text-zinc-400 mt-1.5 min-w-[36px]">
                  [{formatTimestamp(cue.start)}]
                </span>
                <span className="text-[14px] font-medium leading-7 text-zinc-800">
                  {cue.text}
                </span>
              </div>
            )}
            
            {/* 逐 cue 译文 */}
            {displayMode !== "spanish" && (
              <p className={`text-[12.5px] leading-6 text-zinc-500 ${displayMode === "bilingual" ? "pl-11 mt-1" : ""}`}>
                {translations[idx] ?? ""}
              </p>
            )}
          </div>
        ))}
  </div>
</div>
```

### 3.2 打印触发方法
```javascript
const handlePrintDownload = () => {
  // 设置打印文档标题，使用户另存为 PDF 时默认文件名为“视频标题.pdf”
  const originalTitle = document.title;
  if (videoTitle) {
    document.title = `${videoTitle} - Subtitles | Esponal`;
  }
  
  window.print();
  
  // 打印完成后恢复原标题
  document.title = originalTitle;
};
```

### 3.3 CSS 打印媒体查询规则

Codex1 需在 `src/app/globals.css` 中追加打印样式规则，确保在唤起打印对话框时，**屏蔽所有页面布局，只显示全量的字幕**：

```css
@media print {
  /* 隐藏 Next.js 应用主体、header、player、按钮、Lookup 叠卡等所有屏幕级元素 */
  body * {
    visibility: hidden;
    height: 0;
    overflow: visible !important;
  }
  
  /* 仅显示打印专用容器，并重新拉伸至视口宽度 */
  #print-transcript-area,
  #print-transcript-area * {
    visibility: visible;
    height: auto !important;
  }
  
  #print-transcript-area {
    position: absolute;
    left: 0;
    top: 0;
    width: 100% !important;
    display: block !important;
  }

  /* 打印辅助类：避免单条字幕在页面折行处被截断 */
  .page-break-avoid {
    page-break-inside: avoid;
    break-inside: avoid;
  }
}
```

---

## 4. UI 设计审查核对表

*   [ ] 工具条对齐：在 `560px` 宽度下，工具条在一行内排布整齐，且小宽度视口下换行排布不溢出。
*   [ ] 打印预览排版：唤起 `window.print()` 后，打印预览中只有字幕列表，且西语和中文对齐间距正常，中文不乱码。
*   [ ] 模式切换体验：在「句子级」与「逐行」切换时，逐词查词、当前行高亮、自动跟随滚动完全正常工作。
