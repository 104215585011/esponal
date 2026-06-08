# 统一导入 实现计划(Phase 1)

> **执行方式**:本项目多 Agent 协作 —— 后端票 Claude1→Codex1(TDD)→Codex2;UI 票 Claude1→Gemini1 设计稿→Codex1→Codex2→Gemini1 视觉评审→PM 验收。本计划把 spec 拆成有序 ticket。
> **spec**:`docs/superpowers/specs/2026-06-08-unified-import-design.md`

**目标**:让用户粘贴 YouTube URL 生成字幕观看、上传 EPUB/PDF(含扫描件 OCR)解析成可点词读物进"我的导入"库。

**架构**:统一导入入口(web `/import` 页 + 移动底栏扇出 + bottom-sheet);文档异步解析切页存 `ImportedDocument`/`DocumentSection`;阅读复用 `LecturaReader`/`SpanishText` + 窗口加载(当前页±5);OCR/字幕生成接积分引擎计费。

**Tech**:Next.js App Router + Prisma(PostgreSQL)+ 现有 watch 字幕管线 + 现有 lectura 阅读器 + 云 OCR(provider 可插拔)+ EPUB/PDF 解析库。

---

## Ticket 依赖与顺序
```
IMPORT-1 (后端:模型+上传+EPUB/文本PDF解析+切页+窗口API+列表+进度)
   ├─ IMPORT-2 (后端:扫描件 OCR + 计费)            [依赖 1]
   ├─ IMPORT-3 (前端UI:我的导入列表 + 阅读器集成+窗口加载)  [依赖 1;Gemini 设计]
   └─ IMPORT-4 (前端UI:统一导入入口 web页+移动扇出+sheet + YouTube URL) [依赖 1;Gemini 设计]
```
建议顺序:**IMPORT-1 → (IMPORT-2 ∥ Gemini 给 IMPORT-3/4 设计稿) → IMPORT-3 → IMPORT-4**。

---

## IMPORT-1 — 文档导入后端核心(模型 + 上传 + EPUB/文本PDF + 切页 + 窗口API)
**类型**:后端 · Codex1(TDD)→ Codex2 · 无 UI

**文件**
- Modify: `prisma/schema.prisma`(加 `ImportedDocument`/`DocumentSection` + 枚举 `ImportKind`/`ImportStatus`,见 spec §3)
- Create: `src/lib/import/parse.ts`(解析:epub→章节文本、文本 PDF→逐页文本;统一产出 `{ title, pages: string[] }`)
- Create: `src/lib/import/paginate.ts`(EPUB 伪页切分:按 ~2500 字符切;PDF 已是页直接用)
- Create: `src/app/api/import/file/route.ts`(POST:校验类型/大小→建 ImportedDocument(processing)→触发解析→写 sections→ready/failed)
- Create: `src/app/api/import/[id]/route.ts`(GET 文档状态/元信息)
- Create: `src/app/api/import/[id]/pages/route.ts`(GET `?from=&to=` 范围取 section,收边)
- Create: `src/app/api/import/documents/route.ts`(GET 我的导入列表)
- Create: `src/app/api/import/[id]/progress/route.ts`(POST 记 lastPageIndex)
- Test: `tests/import-parse.test.mjs`、`tests/import-pages-window.test.mjs`、`tests/import-api.test.mjs`

**任务**
1. **Prisma 模型 + 迁移**:加两模型 + 枚举(spec §3 原样)。`npx prisma generate` + 迁移。提交。
2. **解析纯函数 `parse.ts`**(TDD):
   - 测试:给一段最小 EPUB / 文本 PDF fixture → 返回 `{title, pages:string[]}`,pages 非空、顺序正确。
   - 实现:EPUB 用解析库取各章 HTML→纯文本;文本 PDF 用解析库逐页 `extractText`。**检测无文字层 → 抛 `NeedsOcrError`**(交 IMPORT-2 处理;本票文本型走通,扫描件先标 failed/`needs_ocr`)。
3. **切页 `paginate.ts`**(TDD):EPUB 文本按 ~2500 字符边界(优先段落边界)切成页数组;PDF 透传。测试:长文本→页数符合预期、不截断词中间(就近段落/句边界)。
4. **上传接口 `import/file`**(TDD,源码契约 + 行为):
   - 校验:类型 ∈ {epub,pdf}、大小 ≤100MB(超限 413/400)、登录(401)。
   - 流程:建 ImportedDocument(processing)→ parse+paginate → 批量写 DocumentSection(pageIndex 0..n)→ 更新 pageCount/status=ready;解析异常→status=failed+failReason。
   - 测试:小 fixture 上传→ready+pageCount>0+sections 入库;超大/错类型→拒。
5. **窗口取页 `[id]/pages`**(TDD):`from/to` clamp 到 `[0,pageCount-1]`,只返该范围 `{pageIndex,content}[]`;越界/缺参兜底;只返本人文档(否则 404/403)。测试:from=-3→0、to>max→max、跨界正常。
6. **列表 / 状态 / 进度接口**(TDD):`documents` 返本人列表(标题/类型/状态/进度/pageCount);`[id]` 状态;`progress` upsert lastPageIndex。测试:鉴权 + 只见本人。
7. `npm test` 全绿 + `lint:encoding`。提交。

**验收**:上传 epub/文本pdf→ready 且能按窗口取页;扫描件暂置 failed(needs_ocr);全程鉴权隔离;测试绿。
**不在本票**:OCR、任何 UI。

---

## IMPORT-2 — 扫描件 OCR + 计费(依赖 IMPORT-1)
**类型**:后端 · Codex1(TDD)→ Codex2 · 无 UI

**文件**
- Create: `src/lib/import/ocr.ts`(provider 可插拔:`runOcr(pages: image[]) => string[]`;先接一个云 OCR provider,西语语种;密钥进 `.env`)
- Modify: `src/lib/import/parse.ts`(扫描件分支:PDF 无文字层→渲染页为图→`runOcr`)
- Modify: `src/lib/credits/config.ts`(`ACTION_COST_MINOR` 加 `ocr_per_page`,值占位待标定)
- Modify: `src/lib/credits/labels.ts`(加 `ocr: "扫描件文字识别"`)
- Modify: `src/app/api/import/file/route.ts`(OCR 前 `requireCredits(ocr 页数×ocr_per_page)`,不足→402+非模态提示语;成功后 `spendCredits(..., "ocr")`)
- Test: `tests/import-ocr.test.mjs`、扩展 `tests/credits-*.test.mjs`

**任务**
1. **`ocr.ts` provider 接口 + 一个实现**(TDD,mock provider 测流程):输入页图、输出每页文本;失败可重试/标记。
2. **parse 扫描件分支**:检测无文字层→PDF 页渲染成图→runOcr→pages 文本。页数受 spec §5 上限(默认 300,超出→failed/提示)。
3. **计费接入**:config 加 `ocr_per_page`;file 路由 OCR 前 `requireCredits(pageCount*ocr_per_page)`→不足拦截;成功 `spendCredits(..., reason=spend, refType="ocr")`;labels 加 "ocr"。
4. 测试:扫描件 fixture→OCR 走通+扣费+流水 refType=ocr;文本 PDF 不走 OCR 不扣;配额不足拦截;超页数上限拒。
5. `npm test` 全绿 + `lint:encoding`。提交。

**验收**:扫描件能 OCR 成可读文本、按页扣配额并记流水;文本型不受影响;不足/超限正确拦截。

---

## IMPORT-3 — "我的导入"列表 + 阅读器集成(窗口加载)(依赖 IMPORT-1;UI)
**类型**:前端 UI · **Gemini1 设计稿** → Codex1 → Codex2 真机 → Gemini1 视觉 → PM
**设计基准**:`MOBILE-design-language.md`(干净现代);复用 `LecturaReader`/`SpanishText`;桌面不回退。

**文件**
- Create: `src/app/import/library/page.tsx` 或并入 `src/app/lectura/page.tsx` 增"我的导入"分区(Gemini 定位置)
- Create: `src/app/import/[id]/page.tsx` + reader client(复用 `LecturaReader`,接窗口加载)
- Create: `src/app/import/[id]/ImportReaderClient.tsx`(窗口加载逻辑:当前页±5,翻页增量拉 `pages?from=&to=`,头尾收边;进度上报)
- Test: `tests/import-reader.test.mjs`(窗口请求范围正确、进度恢复)

**任务**
1. Gemini1 出设计稿 `docs/tickets/IMPORT-3-design.md`(列表卡:标题/类型/状态徽标/进度;阅读页布局复用 lectura)。
2. Codex1:列表页(拉 `documents`,processing 显"处理中"、failed 显原因可删/重试);阅读页复用 LecturaReader + `ImportReaderClient` 窗口加载(初始 `from=max(0,cur-5),to=min(max,cur+5)`,翻页预取相邻、收边、不重复拉)。
3. 点词/收藏/AI 回落沿用现有(计费同现有规则)。进度 `lastPageIndex` 上报+恢复。
4. 测试:窗口请求范围断言;进度恢复;空态/处理中/失败态。`npm test` 绿 + lint。
5. Gemini1 视觉评审 → PM 验收。

**验收**:能在"我的导入"看到读物并打开;大书只按窗口加载不卡;点词查询可用;进度记忆。

---

## IMPORT-4 — 统一导入入口(web 页 + 移动扇出 + bottom-sheet)+ YouTube URL(依赖 IMPORT-1;UI)
**类型**:前端 UI(+少量后端 URL 解析)· **Gemini1 设计稿** → Codex1 → Codex2 真机 → Gemini1 视觉 → PM

**文件**
- Create: `src/app/api/import/url/route.ts`(POST:解析视频 URL→本期 YouTube videoId→返回 `/watch?v=ID`;非法/非 YouTube→报错)
- Create: `src/lib/import/parse-video-url.ts`(纯函数:各种 YouTube URL→videoId;含 youtu.be/watch/shorts/带参)
- Create: `src/app/import/page.tsx`(web 导入页:URL 框 + 文件上传区;本地视频/音频灰显"即将支持")
- Create: `src/app/components/web/ImportSheet.tsx`(移动 bottom-sheet,**复用 MOBILE-000 查词卡** createPortal+拖拽关闭)
- Modify: `src/app/components/web/BottomTabBar.tsx`(加「导入」图标 + 点击扇出 URL/文件 两选项)
- Test: `tests/import-video-url.test.mjs`(URL→videoId 各形态)、`tests/import-ui.test.mjs`(源码契约)

**任务**
1. Gemini1 出设计稿 `docs/tickets/IMPORT-4-design.md`(web 导入页布局;移动底栏「导入」图标 + 角标扇出动画 + bottom-sheet 输入,拖拽关闭,对齐查词卡手感)。
2. **URL 解析纯函数**(TDD):`parse-video-url.ts` 覆盖 youtu.be/`watch?v=`/shorts/带 `&t=` 等→正确 videoId;非 YouTube/非法→null。
3. **`import/url` 接口**(TDD):合法→`{redirect:"/watch?v=ID"}`;非法→400 内联错误。
4. **web `/import` 页**:URL 框(提交→调 url 接口→跳 watch)+ 文件上传(调 `import/file`,显处理状态);非本期类型灰显。
5. **移动入口**:BottomTabBar 加「导入」;点击沿角标扇出两项;选 URL/文件→唤起 `ImportSheet`(复用查词卡 bottom-sheet,向下拖拽关闭)。
6. 测试:URL 解析全形态;源码契约(导入页/底栏图标/sheet 存在)。`npm test` 绿 + lint。
7. Gemini1 视觉评审 → PM 验收。

**验收**:web 有 `/import` 页可粘 URL 跳播放、可传文件;移动底栏「导入」扇出 + bottom-sheet 可拖拽关闭;YouTube 各种链接都能解析;桌面不回退;UTF-8。

---

## 计划自查
- **spec 覆盖**:统一UI(4)、文档管线/模型/切页/窗口API(1)、OCR+计费(2)、阅读器复用+窗口加载+进度(3)、YouTube URL(4)、计费(2/沿用)、限制100MB/300页(1/2)、异步状态机(1)、错误处理(各票)、不在本期(本地媒体/Bilibili 已排除)。✅
- **占位**:仅 OCR 费率(`ocr_per_page`)待标定——spec 已声明,实现先占位。其余无 TBD。
- **类型一致**:`ImportedDocument`/`DocumentSection`/`ImportKind`/`ImportStatus` 全票一致;`pages?from=&to=`、`lastPageIndex`、refType `"ocr"` 各处一致。✅
