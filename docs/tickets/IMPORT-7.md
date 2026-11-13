# IMPORT-7 — 阅读器重写:改用成熟渲染引擎(epub.js + pdf.js viewer)【工程票·Codex1】

**优先级**:P0 · **实现**:Codex1 · **验证**:**用户真机为准**(源码读不出渲染质量,已反复证明)
**背景**:用户真机连续暴露:EPUB 截断 + 图全丢 + 词黏一起无空格;PDF 卡顿 + 灰边不 fit 屏。**根因 = 手搓阅读器引擎(自写多栏分页/切词/canvas)**,排版/图文/空格/分页这类硬问题填不完。对标 DejaVocab 质感差距大。**决策:停止手搓,改用成熟库,我们只叠查词层。**

## EPUB → 改用 epub.js(paginated rendition)
- 用 **epub.js** 直接渲染 **COS 原件**(经 `/api/import/:id/url` 预签名 GET;epub.js 支持 ArrayBuffer 或 URL)。
- `rendition = book.renderTo(el, { flow: "paginated", width, height, spread: "none" })` —— **分页/图片/空格/段落/内嵌CSS 全由 epub.js 处理**,不再自写多栏/切词。
- **查词层**:监听 `rendition.on("click"/"selected")` 或在 `rendition.hooks.content` 注入,拿到点击词 + 所在句 → 复用现有 `LookupCardStack`(查词/收藏/AI回落不变);整句朗读复用 `/api/tts`(缓存免扣)。
- **主题**:epub.js `rendition.themes` 注册 字号/行距/字体/三色纸张(白/米黄/夜间),替代我们手写的 CSS 变量;localStorage 持久化。
- **目录**:用 `book.navigation.toc`。**进度**:用 epub.js CFI(`rendition.currentLocation()`),存 `lastPosition`=CFI(迁移旧 `epub:idx`)。
- **安全**:epub.js 在 sandbox iframe 渲染;仍保留服务端对图片/资源的来源约束。删除我们自写的 sanitize 多栏/切词/wrapSentences 那套(或仅留必要)。

## PDF → pdf.js 正经按页 viewer
- `getDocument({ url: 预签名GET, rangeChunkSize: 65536, disableAutoFetch: true })` —— **HTTP Range 按页取**(Network 应见 206 Partial),治大文件卡顿。COS CORS 暴露 `Content-Range`/`Accept-Ranges`。
- **纯 fit-width / fit-page**:`scale = frameWidth / page.getViewport({scale:1}).width`(× devicePixelRatio 渲染清晰),一页一屏、居中、无灰边、**去掉百分比缩放模型**(删 effectivePdfZoom)。
- 文字层点词 + 整句朗读(现有实现 OK)叠加在渲染页上,保留。

## 交付节奏(分段,防再做一大坨整体废)
- **M1 最小可用(先做这个,停下等用户真机确认)**:epub.js 渲染一本 EPUB,**能翻页 + 显图 + 词间有空格**即可(查词/主题/PDF 先不做)。提交后**立即交用户真机看质感方向**,认可再继续。
- **M2**:叠查词层(rendition 事件→LookupCardStack)+ 整句朗读。
- **M3**:主题(字号/行距/字体/三色纸)+ 目录 + CFI 进度迁移。
- **M4**:PDF 换 Range+fit-width。
> 每段都可独立真机验;M1 不过不进 M2。

## 验收(以用户真机为准,逐条)
- [ ] EPUB:翻页完整**无截断**、**图片显示**、**词间有空格**、字号/三色纸张切换正常、点词查词可用、进度恢复。
- [ ] PDF:大文件首屏快(**Network 见 206 Range**)、一页 fit 屏不糊无灰边、点词/朗读可用。
- [ ] 质感对标:接近"真阅读器"(用户认可)。
- [ ] `npm test` 绿 + `npm run test:e2e` + lint:encoding。
> 引入 epub.js 作 dep;不再手搓分页。桌面不回退;UTF-8。若 epub.js 某细节不达预期,PM 复评再调,不退回手搓。
