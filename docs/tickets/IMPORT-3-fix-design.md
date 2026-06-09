# IMPORT-3 修缮图纸：PDF 原件渲染全屏沉浸化

**更新时间**: 2026-06-09 10:16
**状态**: ready for Codex1 implementation
**作者**: Gemini1 / PM handoff
**目标**: 解决 PDF 阅读器里的标题重复、多层嵌套、空间浪费和开发说明文字外露问题，把 `/import/[id]` 调整成更接近 Apple Books 的沉浸式阅读界面。

## 1. 净化外层路由

文件: `src/app/import/[id]/page.tsx`

要求:
- 删除外层 `<header>`，包括 `Imported Reading`、大标题、副标题、格式标签。
- 删除 `<section>` 的 `py-5 md:py-8`，让 `ImportReaderClient` 更贴近 `SiteHeader`。
- 保留结构只应包含 `<SiteHeader />` 和 `<section className="mx-auto max-w-app-shell px-4">` 包裹的 `ImportReaderClient`。

## 2. 重构阅读器外壳

文件: `src/app/import/[id]/ImportReaderClient.tsx`

要求:
- 删除最外层卡片壳：不要再使用 `rounded-[28px] border border-zinc-200/70 bg-white p-4 shadow-card md:p-6`。
- 替换为纯阅读容器：`relative flex min-h-[calc(100vh-80px)] w-full flex-col`。
- PDF 不应被放在卡片里；画布区域应尽量占据剩余空间。

## 3. 极简顶栏

要求:
- 顶栏只保留一行：格式小标签 + 单行书名 + 必要操作。
- 长书名必须使用 `truncate`，锁定在一行内。
- 格式标签使用迷你 `EPUB` / `PDF` badge。
- 删除顶部页码显示，因为移动底栏已经显示页码。
- 不要使用 `border-b border-zinc-100 pb-4` 这类额外分割线。

## 4. Canvas 区域

要求:
- PDF 容器使用克制的阅读底色，而不是卡片式边框和 padding。
- 推荐容器: `relative flex min-h-[calc(100dvh-156px)] flex-1 justify-center overflow-hidden rounded-2xl bg-zinc-100/50`。
- 保留横向滚动能力，避免放大后的 PDF 被裁死。
- 保留 text layer 点词能力。

## 5. 净化底栏

要求:
- 删除任何开发说明文字，比如“PDF 使用 pdf.js 同源渲染”“原件渲染”等。
- 移动底栏使用 52px 高度的悬浮胶囊：
  `fixed inset-x-4 bottom-[calc(env(safe-area-inset-bottom)+12px)] z-40 flex h-[52px] items-center justify-between rounded-full border border-zinc-200/60 bg-white/90 px-2 shadow-elevated backdrop-blur md:hidden`
- 左右按钮保持 40x40，触控面积清晰。
- 中间页码使用 `text-xs font-bold text-zinc-800 font-display`。

## 验收清单

- 长书名在移动端只显示一行，超出部分省略。
- 页面上不再出现 `Imported Reading` 和“原件渲染”等外层副标题。
- 阅读器不再有卡片套卡片的阴影外壳。
- PDF 区域更大，留白更少。
- 底栏是克制的悬浮胶囊。
- 已有 PDF 渲染、翻页、放大、text layer 点词不回退。
