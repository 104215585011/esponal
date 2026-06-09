# IMPORT-3 UI 重构图纸 (全屏沉浸式阅读器 V2)

**更新时间**: 2026-06-09
**状态**: 待执行 (For Codex1)
**作者**: Gemini1 (UI 设计师)
**目标**: 放弃之前的网页式排版，将阅读界面**彻底重构为类似 Apple Books / 微信读书的沉浸式小说阅读器**。无多余留白，菜单默认隐藏，点击唤出，支持滑动/点击翻页，并补齐退出路径。

---

## 1. 彻底清空外壳 (`src/app/import/[id]/page.tsx`)

我们要把整个网页彻底变成一个全屏 App 视图。
**修改要求**：
1. **删除 `SiteHeader`**：阅读页不需要全局导航栏！
2. **强制全屏容器**：把 `<main>` 和 `<section>` 的所有 `padding`、`margin`、`max-w`、`pb-24` 全部删掉。
3. **极简结构**：
   ```tsx
   <main className="h-[100dvh] w-screen overflow-hidden bg-[#f9f9f9] dark:bg-[#121212]">
     <ImportReaderClient ... />
   </main>
   ```

---

## 2. 核心交互逻辑重构 (`ImportReaderClient.tsx`)

现在的界面是所有控制栏都固定显示，极其占用空间。必须引入**“点击唤出 (Tap-to-Toggle)”**机制。

### 2.1 屏幕三分区控制法 (The 3-Zone Touch)
在 PDF 画布（Canvas）之上，覆盖一层透明的绝对定位拦截层（或者监听容器的点击事件），将屏幕分为三个垂直区域：
- **左侧 30%**：点击触发**上一页**。
- **右侧 30%**：点击触发**下一页**。
- **中间 40%**：点击触发**隐藏 / 唤出菜单**（切换状态 `isMenuVisible`）。
*(注：由于 pdf.js 原生画布不支持手势滑动，点击左右侧翻页是业界最成熟的阅读器平替方案。如果有余力，可以用 `onTouchStart` 实现横向 Swipe 监听翻页)*

### 2.2 隐形水印提示 (默认状态)
当菜单隐藏 (`isMenuVisible === false`) 时，屏幕上除了书本内容，**只允许存在两个极小、极淡的文字**：
- **左上角书名缩略**：`absolute top-3 left-4 text-[10px] text-zinc-400 truncate max-w-[50%]` (如：`Aula internacional...`)
- **右下角页码**：`absolute bottom-3 right-4 text-[10px] text-zinc-400` (如：`19 / 844`)

---

## 3. 滑动菜单设计 (The Hidden Menus)

当 `isMenuVisible === true` 时，顶栏和底栏才从屏幕外滑入 (`transition-transform duration-300`)。

### 3.1 顶部滑出栏 (Top Navigation)
负责“退出”和基础信息。
- **容器**：`absolute top-0 inset-x-0 h-14 bg-white/95 backdrop-blur-md border-b border-zinc-200/50 z-50 flex items-center px-2 shadow-sm transition-transform` (隐藏时加上 `-translate-y-full`)。
- **左侧退出键**：放置一个大热区的返回按钮（解决用户没有退出路径的痛点）。
  ```tsx
  <Link href="/import/library" className="flex h-10 w-10 items-center justify-center text-zinc-700 active:bg-zinc-100 rounded-full">
    <ChevronLeft className="w-6 h-6" />
  </Link>
  ```
- **中央标题**：`flex-1 truncate text-center text-sm font-bold text-zinc-900 px-4` (强制单行)。

### 3.2 底部滑出控制台 (Bottom Control Center)
抛弃那个丑陋的浮动胶囊，做一个扎实的底部抽屉级控制栏。
- **容器**：`absolute bottom-0 inset-x-0 bg-white/95 backdrop-blur-md border-t border-zinc-200/50 z-50 pb-[env(safe-area-inset-bottom)] transition-transform` (隐藏时加上 `translate-y-full`)。
- **第一层：进度条区 (Slider)**
  - 占满全宽的一行，左右是页码数字，中间是原生的 `<input type="range">`。
  - `<div className="flex items-center gap-4 px-6 py-4">`
  - 左数字：`text-xs font-medium text-zinc-500 w-8 text-right`
  - 滑块：`flex-1 accent-brand-500`
  - 右数字：`text-xs font-medium text-zinc-500 w-8`
- **第二层：操作栏区 (Actions)**
  - `<div className="flex items-center justify-between px-8 pb-4 pt-2">`
  - 放置几个纯图标按钮 (图标大小 `w-6 h-6 text-zinc-700`)，如：`List` (目录预留), `Sun` (护眼预留), `Type` (Aa 排版预留)。
  - 如果开发评估左右点击翻页不够明显，这里也可以兜底放两个 `<ChevronLeft>` 和 `<ChevronRight>` 作为明确的翻页物理按键。

---

## 4. 给 Codex1 的验收标准 (Checklist)
1. **真全屏**：`SiteHeader` 必须消失，页面必须达到 `100dvh`，上下绝对不能有大块的留白。
2. **退出路径**：点击中间唤出顶栏后，必须能点左上角的 `<` 成功退回到列表页。
3. **点击翻页与唤醒**：在隐藏菜单的状态下，点击画布边缘能翻页，点击中间能顺滑呼出顶/底栏 (`transition-transform`)。
4. **清爽度**：菜单隐藏时，界面必须像真实的纸质书一样干净，除了左上角的淡色书名和右下角的淡色页码，绝对不允许出现任何按钮、胶囊或边框。
