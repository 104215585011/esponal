# 统一导入 实现计划(Phase 1)— v2(方案 C + 腾讯云 COS)

> **执行**:后端票 Claude1→Codex1(TDD)→Codex2;UI 票 Claude1→Gemini1 设计稿→Codex1→Codex2→Gemini1 视觉→PM。
> **spec**:`docs/superpowers/specs/2026-06-08-unified-import-design.md`(v2)

**目标**:粘 YouTube URL 观看;上传 EPUB/PDF(图文忠实)→ 原件存 COS、按格式客户端渲染 + 点词,进"我的导入"库。

**架构**:原件**客户端直传 COS**(预签名 PUT,绕开 Vercel 体积限制);阅读时拿**预签名 GET**,**EPUB→epub.js / PDF→pdf.js+Range** 客户端渲染;点词复用现有查词;DB 只存 `ImportedDocument` 元信息+进度(不存正文)。

**Tech**:Next.js + Prisma + 腾讯云 COS(S3 兼容)+ pdf.js + epub.js + 现有查词/字幕管线。

---

## Ticket 依赖与顺序
```
IMPORT-1 后端(COS 存储封装 + 预签名 + 模型 + 文档/列表/读URL/进度)   ← 改造中(原按纯文本,现改 COS)
   ├ IMPORT-3 我的导入库 + 阅读器(epub.js/pdf.js 渲染 + 点词)  [依赖1;Gemini IMPORT-3-design ✅]
   └ IMPORT-4 导入入口(web /import + 移动 Popover + ImportSheet)+ 客户端直传 + YouTube URL [依赖1;Gemini IMPORT-4-design ✅]
IMPORT-2 扫描件 OCR 点词  = 后续(Phase 2,降级,本期扫描件能读不能点)
```
顺序:**IMPORT-1 → (IMPORT-3 ∥ IMPORT-4)**。

---

## IMPORT-1 — 导入后端(COS 存储 + 预签名 + 模型 + 接口)
**类型**:后端 · Codex1(TDD)→ Codex2 · 无 UI
> ⚠️ **改造说明**:本票原按"服务端上传+纯文本抽取+DocumentSection"写,现**全改为 COS 原件存储 + 客户端渲染**。**作废**纯文本抽取/切页/DocumentSection;若已写需移除。

**文件**
- Modify: `prisma/schema.prisma`(加 `ImportedDocument` + 枚举 `ImportKind`/`ImportStatus`,见 spec §5;**不要 DocumentSection**)
- Create: `src/lib/storage/cos.ts`(S3 兼容封装:`presignPut(key,contentType)` / `presignGet(key)`;读 `COS_*` env;provider 可换)
- Create: `src/app/api/import/presign/route.ts`(POST:校验登录/类型(epub,pdf)/大小≤100MB → 生成 ossKey(`imports/{userId}/{cuid}.{ext}`)→ 返回预签名 PUT URL + ossKey)
- Create: `src/app/api/import/document/route.ts`(POST `{title,kind,ossKey,sizeBytes,unitCount?}` → 建 ImportedDocument(ready);GET = 列表,见下或拆 documents)
- Create: `src/app/api/import/documents/route.ts`(GET 我的导入列表)
- Create: `src/app/api/import/[id]/route.ts`(GET 元信息,仅本人)
- Create: `src/app/api/import/[id]/url/route.ts`(GET 预签名 GET URL,短时效,仅本人)
- Create: `src/app/api/import/[id]/progress/route.ts`(POST `{lastPosition, unitCount?}`)
- Test: `tests/import-cos.test.mjs`、`tests/import-api.test.mjs`

**任务**
1. **Prisma 模型 + 迁移**:`ImportedDocument`(spec §5)+ 枚举。`prisma generate` + 迁移。提交。
2. **COS 封装 `cos.ts`**(TDD,mock S3 SDK):`presignPut`/`presignGet` 返回有效签名 URL;缺 env 报清晰错误。
3. **`presign` 接口**(TDD):登录(401);类型 ∉{epub,pdf}→400;size>100MB→400;合法→`{uploadUrl, ossKey}`。ossKey 带 userId 前缀防越权。
4. **`document` 建记录**(TDD):写 ImportedDocument(status=ready);字段校验;返回 docId。
5. **列表/元信息/读取URL/进度**(TDD):全部**仅限本人**(他人→404);`:id/url` 签发短时效 GET URL;`progress` upsert lastPosition(+unitCount)。
6. `npm test` 全绿 + `lint:encoding`。提交。

**验收**:能签发上传/读取预签名 URL;文档元信息入库;鉴权隔离;无任何纯文本/DocumentSection 残留;测试绿。
**不在本票**:任何 UI、实际渲染、OCR。

---

## IMPORT-4 — 导入入口(web /import + 移动 Popover + ImportSheet)+ 客户端直传 + YouTube URL(依赖1;UI)
**类型**:前端 UI(+少量后端 URL 解析)· 设计稿 `docs/tickets/IMPORT-4-design.md` ✅ → Codex1 → Codex2 真机 → Gemini1 视觉 → PM
**采用弹出面板(非扇出),复用查词卡 bottom-sheet。**

**文件**
- Create: `src/lib/import/parse-video-url.ts`(YouTube URL→videoId:youtu.be/watch/shorts/带参;非法→null)
- Create: `src/app/api/import/url/route.ts`(POST→`{redirect:"/watch?v=ID"}` / 400)
- Create: `src/lib/import/upload-client.ts`(客户端:`presign`→PUT 直传 COS→`document`;进度回调;失败重试)
- Create: `src/app/import/page.tsx`(web 导入页:URL 框 + 文件区;本地音视频/Bilibili 灰显"即将支持")
- Create: `src/app/components/web/ImportSheet.tsx`(移动 bottom-sheet,复用 MOBILE-000 框架,拖拽关闭)
- Modify: `src/app/components/web/BottomTabBar.tsx`(加「导入」`+` → 弹两列 Popover:视频链接/EPUB·PDF)
- Test: `tests/import-video-url.test.mjs`、`tests/import-ui.test.mjs`(源码契约)

**任务**
1. **URL 解析纯函数**(TDD):覆盖各 YouTube 形态→videoId;非 YouTube/非法→null。
2. **`import/url` 接口**(TDD):合法→redirect;非法→400。
3. **客户端直传 `upload-client.ts`**:校验大小/类型→`presign`→`fetch` PUT 到 COS(带 onProgress)→`document` 建记录;失败可重试。
4. **web `/import` 页**:URL 框(→url 接口→跳 watch)+ 文件上传(→upload-client,显 Loading/成功/失败);未支持类型灰显。
5. **移动入口**:BottomTabBar 加「导入」→ 点击弹两列 Popover;选项→唤起 `ImportSheet`(拖拽关闭),内含 URL 输入 / 文件选择(走 upload-client)。
6. 测试:URL 全形态;源码契约(/import、底栏图标、ImportSheet、upload-client)。`npm test` 绿 + lint。
7. Gemini1 视觉评审 → PM 验收。

**验收**:web 能粘 URL 跳播放、能传 epub/pdf(直传 COS 成功建记录);移动底栏「导入」弹 Popover + ImportSheet 拖拽关闭;桌面不回退;UTF-8。

---

## IMPORT-3 — "我的导入"库 + 阅读器(epub.js / pdf.js 渲染 + 点词)(依赖1;UI)
**类型**:前端 UI · 设计稿 `docs/tickets/IMPORT-3-design.md` ✅ → Codex1 → Codex2 真机 → Gemini1 视觉 → PM
**100% 复用沉浸阅读体验 + 现有查词抽屉。**

**文件**
- Create: `src/app/import/library/page.tsx`(或并入 `/lectura`;我的导入列表)
- Create: `src/app/import/[id]/page.tsx` + `ImportReaderClient.tsx`(按 kind 分发渲染)
- Create: `src/app/components/import/EpubReader.tsx`(epub.js:拉 `:id/url`→渲染 spine/章节→挂点词)
- Create: `src/app/components/import/PdfReader.tsx`(pdf.js:`:id/url`→Range 按页渲 canvas+文字层→挂点词;翻页 12/300+滑块)
- Test: `tests/import-reader.test.mjs`(源码契约:epub.js/pdf.js 挂载、查词唤起、进度上报)

**任务**
1. **列表页**:拉 `documents`,三态(ready/上传中/failed:红+原因+删除);进度条 `lastPosition/unitCount`;点 ready 进 `/import/[id]`。
2. **阅读器分发**:`ImportReaderClient` 按 `kind` 渲染 `EpubReader`/`PdfReader`,顶部 SiteHeader + 标题/“第Y页/共X页”。
3. **EpubReader**:epub.js 挂载预签名 URL,按章渲染;点词→唤起现有 `MobileLookupSheet`/`LookupCard`(复用查词→收藏→AI 回落)。
4. **PdfReader**:pdf.js 以 Range 取当前页±5;canvas 渲染 + 文字层;文字层点词→查词;底部控制条(字号/朗读/`◀ 12/300 ▶`/点数字弹滑块跳页);**扫描件无文字层→提示"暂不支持点词"但正常显示**。
5. **进度**:`lastPosition` 上报(PDF=页码/EPUB=cfi)+ 首载回报 `unitCount` + 恢复。
6. 测试 + `npm test` 绿 + lint。Gemini1 视觉评审 → PM 验收。

**验收**:"我的导入"能看到并打开读物;EPUB 图文忠实、PDF 大书按页流畅不卡;点词查询可用(扫描件除外);进度记忆。

---

## IMPORT-2(降级·后续)— 扫描件 OCR 点词
**类型**:后续(Phase 2)。本期扫描件**能读不能点**。
未来:无文字层 PDF → 客户端渲页为图 → 云 OCR 出文字层(带词位置)→ 叠加可点;OCR 按页扣配额(`ocr_per_page`,接积分引擎,refType="ocr",labels 加"扫描件文字识别")。**不在本期实现。**

---

## 计划自查
- **spec 覆盖**:存储/直传/预签名(1)、模型(1)、导入入口+客户端上传+YouTube URL(4)、库+渲染+点词+窗口(3)、计费(沿用)、限制100MB/类型(1/4)、错误(各票)、扫描件OCR(降级 2)。✅
- **占位**:无 TBD(OCR 整体降级到后续,不在本期占位)。
- **类型一致**:`ImportedDocument`/`ImportKind`/`ImportStatus`/`ossKey`/`lastPosition`/`unitCount` 各票一致;接口 `presign`/`document`/`:id/url`/`progress` 一致;`cos.ts` 的 `presignPut`/`presignGet` 一致。✅
- **改造提示**:IMPORT-1 原纯文本方案作废,Codex1 需切 COS(handoff 已记)。
