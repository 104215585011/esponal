# IMPORT-3 — "我的导入"列表 + 阅读器设计稿

**更新时间**: 2026-06-08
**状态**: 设计交付 (Ready for Implementation)
**作者**: Gemini1 (UI 设计师)
**设计基调**: 白绿极简美学 (White & Emerald)。复用 `MOBILE-002` 的移动端阅读组件，保持沉浸感。

---

## 1. "我的导入" 列表页 (Library)

**建议入口**: 在 `/lectura` 页面顶部或作为一个独立的 `/import/library` 页面（由开发根据路由决策）。如果独立，标题为“我的导入库”。

### 1.1 导入卡片 (Import Card)
复用现有的单列/三列网格卡片体系 (`shadow-card`, `border-zinc-200`)，但在状态表现上有所区分。

**通用样式**:
- 容器: `relative group flex flex-col gap-3 rounded-2xl border p-4 md:p-5 shadow-card bg-white active:scale-[0.98] transition-all`
- 标题: `font-display text-lg font-bold text-zinc-900 line-clamp-2`
- Meta: `flex items-center gap-2 text-[11px] font-medium text-zinc-500` (显示页数或时长)

**状态 1：处理中 (Processing)**
- 视觉表现: 全卡片采用呼吸动效 `animate-pulse`，背景增加轻微毛玻璃感。
- 标题: 渲染真实的 `title`，但下方正文区域用两行灰色骨架替代：`h-3 w-3/4 bg-zinc-200 rounded-full mt-2`。
- 状态胶囊: 卡片右上角浮动一个处理中胶囊：`inline-flex items-center gap-1.5 px-2 py-1 rounded-md bg-brand-50/50 text-[10px] font-semibold text-brand-600`，内部带一个 `<Loader2 className="w-3 h-3 animate-spin" />`。
- 进度感知: 卡片最底端有一条进度指示条：`absolute bottom-0 left-0 right-0 h-1 bg-zinc-100 overflow-hidden`，内嵌 `w-1/2 h-full bg-brand-400 animate-pulse rounded-full`。

**状态 2：已完成 (Ready)**
- 视觉表现: 正常的阅读卡片，Hover 时边框变绿 `hover:border-brand-300`。
- 交互: 点击整卡触发缩放反馈 `active:scale-[0.98]`，直接进入 `/import/[id]`。
- 类型徽标: 底部附加来源标签，如 `EPUB` (`bg-zinc-100 text-zinc-600 px-2 py-0.5 rounded-full text-[10px] font-medium`)。
- 已读进度: 底部展示细小的真实的进度条：`h-1 bg-zinc-100`，绿条 `bg-brand-500` 根据 `lastPageIndex / pageCount` 填充。

**状态 3：失败 (Failed / Needs OCR)**
- 视觉表现: 边框变红，背景带微红。`border-red-200 bg-red-50/30`
- 提示文案: 醒目的红色小字 `text-red-500`，如“解析失败: 需 OCR / 纯图片 PDF”。
- 操作: 提供一个垃圾桶图标 `Trash2` 以删除失败记录。

---

## 2. 导入阅读器 (`/import/[id]`)

**核心原则**: **100% 复用 `MOBILE-002` 的沉浸阅读器体验**。
对于用户来说，读一篇系统原生的短文，和读一本自己导入的 EPUB，UI 层面上应该感觉不到差异。

### 2.1 页面外壳与导航
- 顶部保留 `SiteHeader`。
- 标题区: 显示 `ImportedDocument.title`，副标题可以是“共 X 页，当前第 Y 页”。

### 2.2 正文区 (SpanishText 渲染)
- 复用 `LecturaReader` 的逻辑，直接渲染由 `DocumentSection.content` 返回的纯文本。
- 字号响应式: 严格沿用 `sm`, `md`, `lg` 的配置 (16px / 18px / 19px)。
- 查词: 点词弹出底部抽屉 (`MobileLookupSheet`) —— 这是必须保留的核心体验。

### 2.3 移动端悬浮控制条 (Bottom Bar) 与翻页交互
由于导入文档是长篇幅，翻页与进度管理变得比短文更重要：
- **控制胶囊基座**: `fixed inset-x-4 bottom-[calc(env(safe-area-inset-bottom)+12px)] z-30 flex h-16 items-center justify-between gap-1 rounded-full border border-zinc-200/60 bg-white/80 px-3 shadow-elevated backdrop-blur-md`。
- **左侧 (字号与朗读)**:
  - `Aa` 字号循环键 (保留原状)。
  - `▶` 全文/当页连续朗读键 (用绿底圆角矩形强调)。
- **中右侧 (翻页与进度)**:
  - 取消原有的“上一段/下一段”按键，替换为强烈的**“翻页组件”**。
  - `<button>` 上一页：`<ChevronLeft className="w-6 h-6 text-zinc-500 active:text-brand-600" />`。
  - **进度中心区**: 两个翻页键中间夹着纯数字提示 `text-xs font-display font-bold text-zinc-700`，如 `12 / 300`。
  - `<button>` 下一页：`<ChevronRight className="w-6 h-6 text-zinc-500 active:text-brand-600" />`。
- **隐形交互**: 点击中间的 `12/300` 数字，从屏幕底部弹出原生的滑块选页抽屉 (`<input type="range" className="accent-brand-500" />`)，方便大范围跳页。

---

## 3. 设计验收 Checklist (给 Codex1 & Codex2)
1. 处理中的文档是否有明确的 Loading 态，且不会让整个列表卡死。
2. 失败的文档是否有红色的视觉警告和删除入口。
3. 进入阅读页后，点词查词的底部抽屉（MOBILE-000）能否正常工作。
4. 移动端底部悬浮胶囊栏在滚动和查词时（z-index 处理）不能遮挡抽屉。
