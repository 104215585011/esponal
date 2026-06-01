# WATCH-009 — 字幕面板 PDF 下载 UI 与文档版式设计稿

本设计稿规范了 `TranscriptPanel.tsx` 顶部工具条中「下载字幕」按钮的交互行为、生成 PDF 文档时的排版格式（西上中下双语布局、带时间戳）以及中文字体加载策略，旨在提供清晰、温暖且符合印刷出版物级别的 PDF 字幕讲义。

---

## 1. 顶部工具条 UI 布局与按钮设计

下载 PDF 按钮将替换已作废的 WATCH-008（SRT 下载按钮），并保留在右侧字幕面板顶部的 Header 工具条中。

### 1.1 按钮位置与 ASCII 布局 (Toolbar Layout)

```text
+-------------------------------------------------------------------------+
| [ ES+中 | 仅西语 | 仅中文 ]        [ 句子级 | 逐行 ]   [ ⬇ 下载 PDF ]   |
+-------------------------------------------------------------------------+
```

* **位置**：工具条最右侧，通过 `ml-auto` 保持靠右对齐。当视口宽度较小（小于 `560px`）时，工具条各部分自动响应式换行，保持间距和整齐度。
* **文案**：`下载 PDF`（屏幕空间紧张时或小视口下，可缩写为 `下载` 或仅显示图标，保持灵活性）。
* **图标**：Lucide-react 的 `FileText` 或是带有箭头的下载图标。
* **无障碍**：`aria-label="下载当前字幕为 PDF 讲义"`。

### 1.2 TSX 结构与 Tailwind 样式

```jsx
<button
  onClick={handlePdfDownload}
  disabled={isGenerating}
  type="button"
  className="flex items-center gap-1.5 rounded-full border border-zinc-200 dark:border-zinc-800 bg-white dark:bg-zinc-900 px-3 py-1 text-[11.5px] font-semibold text-zinc-600 dark:text-zinc-350 hover:bg-zinc-50 dark:hover:bg-zinc-800 transition shadow-sm disabled:opacity-50 disabled:cursor-not-allowed"
>
  {isGenerating ? (
    // 旋转加载 loading 状态
    <svg className="animate-spin h-3.5 w-3.5 text-zinc-500 dark:text-zinc-400" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
      <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
      <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
    </svg>
  ) : (
    // 极简文件下载图标
    <svg className="w-3.5 h-3.5 text-zinc-500 dark:text-zinc-400" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2.5">
      <path strokeLinecap="round" strokeLinejoin="round" d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
    </svg>
  )}
  <span>{isGenerating ? "生成中..." : "下载 PDF"}</span>
</button>
```

---

## 2. PDF 文档版式规范 (Print & PDF Layout Spec)

PDF 应被设计为一份精致的离线复习文稿，其排版规则如下：

### 2.1 页面基础参数

* **纸张规格**：A4（$210\text{mm} \times 297\text{mm}$）。
* **页边距**：上边距 `20mm`、下边距 `20mm`、左边距 `18mm`、右边距 `18mm`。
* **背景色**：纯白（`#FFFFFF`），文字采用深灰与中灰，以达到最高印刷对比度。
* **默认字体**：使用能够良好展示西文与中文字符的 Sans-serif 字体家族。

### 2.2 文档页眉与标题 (Document Header)

* **主标题**：在第一页顶部，渲染当前学习视频的标题（`videoTitle`）。
  * 样式：粗体，字号 `18pt`，文字颜色 `#18181B`（锌黑）。
  * 间距：下方带有 `1.5pt` 厚的粗线装饰（品牌主色 emerald，颜色值 `#10b981`），标题与正文区域留出 `12mm` 的空白。
* **页脚**：每页底部中央渲染当前页码（例如 `第 1 页 / 共 3 页`），右侧渲染应用署名（`Esponal — 西班牙语学习平台`），字号 `8pt`，颜色 `#71717A`。

### 2.3 字幕块排版 (Subtitle Block Layout)

字幕行需要区分不同的显示模式，并在双语模式下遵循 **西语在上，中文在下** 的规则。

#### A. 双语模式 (Bilingual Mode - "ES + 中")

每个字幕块由「时间轴 + 西语原文」及下方「中文译文」组成：

```text
[01:23]  ¿Qué tal estás hoy? Espero que muy bien.
         今天你怎么样？希望你非常好。
```

* **西语原文行**：
  * **时间戳前缀**：包裹在中括号内，如 `[01:23]`。字号 `9pt`，字体使用 Outfit 或等宽数字字体，颜色 `#71717A`（次级文字灰）。
  * **西语文本**：紧随时间戳后，字号 `10.5pt`，行高 `16pt`，字体粗细 `Medium`，颜色 `#18181B`（主字色）。
* **中文译文行**：
  * **缩进与对齐**：中文起笔位置与西语原文的文字起点垂直对齐（即在水平方向上相对于时间戳产生缩进，缩进约 `15mm`）。
  * **中文文本**：字号 `9.5pt`，行高 `15pt`，颜色 `#71717A`（次级灰，使其视觉层次弱于原文）。
* **间距**：字幕块之间留出 `8pt` 的空隙，每个字幕块底部有一条细虚线或极淡的分隔线（`#F4F4F5`）作为视觉分隔。

#### B. 仅西语模式 (Spanish Only Mode)

* 仅渲染时间戳和西语原文行，西语文字大小提升至 `11pt`，行高 `18pt`，颜色 `#18181B`。

#### C. 仅中文模式 (Chinese Only Mode)

* 仅渲染时间戳和中文译文行，中文文字大小提升至 `10.5pt`，行高 `18pt`，颜色 `#18181B`。

---

## 3. 技术实现指引与 CJK 字体策略

中文字体嵌入是 PDF 生成的最大难点。如果直接使用 `jsPDF` 默认的 Helvetica 等核心字体，中文字符将被渲染为乱码或方块。为了确保 bundle size 零负担且中文完整渲染，Codex1 需采用以下推荐策略之一：

### 3.1 客户端动态载入中文字体策略（首选方案，零打包体积）

* **原理**：在用户点击「下载 PDF」按钮时，**动态**向 CDN 获取一个微型的中文字体子集（或较小体积的 UTF-8 字体，如 `Noto Sans SC` 的 Light/Regular 变体包，约 1~2MB），在运行时通过 `jsPDF.addFileToVFS` 注入并注册该字体。
* **优点**：不需要将中文字体文件打包进 Next.js 构建产物中，保证了应用的初始加载速度。
* **交互细节**：在字体下载与 PDF 构建过程中，将按钮状态置为 `isGenerating = true`（显示“生成中...”与 loading 动画），构建完毕后一键保存并恢复按钮。

### 3.2 服务端 API 路由生成 PDF（备选方案）

* **原理**：如果客户端 PDF 方案在各种浏览器中兼容性或字体加载不稳定，可以在后端提供 `/api/subtitle/download-pdf` 路由。利用服务器本地安装的系统字体或 Node.js 环境中的字体文件，通过 `pdfkit` / `pdfmanager` / `puppeteer` 生成 PDF 后作为 `application/pdf` 流返回。
* **优点**：服务器端字体可完全控制，不占用前端包大小，且中文渲染 100% 稳定。

---

## 4. UI 评审核对表 (Design Acceptance Checklist)

* [ ] **一键下载**：点击按钮直接触发 PDF 讲义下载，**不应弹出系统的打印对话框**。
* [ ] **时间戳保留**：句子级/逐行模式均有正确的时间戳（句首 cue 对应时间，或每行 cue 对应时间），格式为 `[MM:SS]`。
* [ ] **西上中下布局**：双语模式下，西语加粗且在上方，中文颜色稍淡且在下方垂直缩进对齐。
* [ ] **分页断行防护**：单个字幕块（西语+中文）在跨页时，不可发生西语在一页、中文在下一页的割裂现象，必须保持在同一页（`page-break` 防护）。
* [ ] **中文字形验证**：导出的 PDF 文档在 Adobe Acrobat、Chrome PDF Viewer、手机端阅读器中打开，所有中文字形均完整显示，无乱码、缺字或方块。
