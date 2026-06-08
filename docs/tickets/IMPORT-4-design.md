# IMPORT-4 — 统一导入入口设计稿

**更新时间**: 2026-06-08
**状态**: 设计交付 (Ready for Implementation)
**作者**: Gemini1 (UI 设计师)
**设计基调**: 苹果级流畅动画，优雅的扇出展开，极简的拖拽交互。

---

## 1. 移动端底栏入口 (BottomTabBar.tsx)

**目标**: 在原本拥挤的底栏中加入“导入”功能，采用主流的“中心 Fab” 或 “替换现有加号” 的扇出交互。

### 1.1 唤起按钮 (Trigger)
在现有的 `BottomTabBar` 导航项中间（或合适的位置），放置一个突出的 `+` 号按钮。
- **未点击状态**: 
  `w-12 h-12 rounded-full bg-brand-500 text-white shadow-[0_8px_16px_-6px_rgba(16,185,129,0.5)] flex items-center justify-center transition-transform active:scale-95`
- **图标**: `lucide-react` 的 `<Plus strokeWidth={2.5} />`。

### 1.2 扇出面板 (Popover / Sheet)
为了极致顺滑且开发成本可控，我们放弃悬浮的扇出花瓣，直接改用**极速响应的悬浮 Popover 或半高 Bottom Sheet**。
当用户点击 `+`，立即在底部安全区之上弹出：
- **容器**: `absolute bottom-20 left-1/2 -translate-x-1/2 w-[calc(100vw-32px)] max-w-sm bg-white rounded-[24px] shadow-[0_20px_60px_-16px_rgba(0,0,0,0.15)] p-2 z-50`
- **内部两列 Grid**: `grid grid-cols-2 gap-2`
  1. **YouTube 导入块**: `flex flex-col items-center gap-2 p-4 rounded-[18px] bg-red-50/50 active:bg-red-50 transition`。上方放置 `Youtube` 图标 (`text-red-500 w-7 h-7`)，下方文字 `text-[13px] font-semibold text-zinc-900` "视频链接"。
  2. **文档导入块**: `flex flex-col items-center gap-2 p-4 rounded-[18px] bg-brand-50/50 active:bg-brand-50 transition`。上方放置 `FileText` 图标 (`text-brand-500 w-7 h-7`)，下方文字 `text-[13px] font-semibold text-zinc-900` "EPUB/PDF"。

---

## 2. 移动端导入抽屉 (ImportSheet.tsx)

**目标**: 100% 复用查词抽屉的阻尼手感和底层框架。

### 2.1 抽屉外壳 (Bottom Sheet)
- **容器**: `fixed inset-0 z-50 flex flex-col justify-end`。
- **遮罩**: `bg-black/45 backdrop-blur-sm`，点击关闭。
- **面板**: `bg-white rounded-t-3xl pb-[safe-area]`。
- **拖拽手柄**: 顶部中央放一个 `w-10 h-1.5 bg-zinc-200 rounded-full mt-3 mx-auto`。必须支持向下拖拽关闭。

### 2.2 抽屉内容区
当用户选择了“链接”或“文档”后，抽屉内展示对应的输入界面：

**选项 A: 粘贴 YouTube 链接**
- 顶栏: 简单的居中标题 `text-lg font-bold text-zinc-900` "导入外部视频"。
- 输入区容器: `mt-6 relative`。
- 输入框: `w-full bg-zinc-50 border border-zinc-200 rounded-[20px] pl-4 pr-12 py-5 text-[15px] focus:border-brand-500 focus:ring-4 focus:ring-brand-500/10 outline-none transition-all placeholder:text-zinc-400`。
- 粘贴快捷键: 输入框右侧绝对定位一个小小的“粘贴”按钮 (`text-xs font-semibold text-brand-600 bg-brand-50 px-2 py-1 rounded-md`)，点击读取剪贴板。
- 按钮: 底部巨大的 `w-full mt-6 h-14 bg-brand-500 text-white rounded-full font-semibold shadow-md active:scale-[0.98]` "立即解析视频"。

**选项 B: 上传文档**
- 顶栏: 居中标题 "导入电子书或文档"。
- 拖拽区 / 点击区: 
  `mt-6 border-2 border-dashed border-zinc-200 bg-zinc-50 rounded-[28px] flex flex-col items-center justify-center p-10 active:bg-zinc-100 transition-colors`
- 视觉核心: 中心放一个带浅绿底色的圆形图标底座 `w-16 h-16 rounded-full bg-brand-50 flex items-center justify-center mb-4`，内部是 `text-brand-500` 的 `UploadCloud`。
- 提示: `text-[15px] font-semibold text-zinc-800` “点击选择文件”，下方跟随 `text-[12px] text-zinc-500 mt-1` “支持 EPUB、PDF (≤100MB)”。

---

## 3. Web 端导入页 (`/import`)

对于桌面端用户，需要一个完整的宽屏页面。

### 3.1 页面布局
- 居中的白板卡片设计: `max-w-2xl mx-auto mt-10 bg-white border border-zinc-200 rounded-[32px] p-10 shadow-elevated`。
- 头部: "统一导入引擎"，副标题 "将视频、电子书、PDF 转化为可交互的双语学习材料"。

### 3.2 双栏结构 (Grid)
- **左侧 (链接导入)**:
  - 巨大的输入框，绿色的“解析”按钮。
- **右侧 (文件拖拽区)**:
  - 虚线拖拽热区。
- **底部不可用功能 (灰显)**:
  - “本地音视频”、“Bilibili 链接” 处于 `opacity-40 grayscale` 状态，并打上 `即将支持` 的小 Tag (`bg-zinc-100 text-zinc-500 px-2 py-0.5 rounded-md text-[10px]`)。

---

## 4. 设计验收 Checklist (给 Codex1 & Codex2)
1. 移动端底栏的“加号”必须是无缝融入的，不能破坏现有 4 个 Tab 的等距平衡。
2. `ImportSheet` 必须能够通过拖拽顶部手柄平滑关闭（复用现有组件）。
3. 颜色必须严格遵守白绿准则（没有天蓝色，没有紫色）。
4. 上传状态（Loading / Parsing）必须在 UI 上有明确的绿色 Spinner 反馈，防止用户重复点击。
