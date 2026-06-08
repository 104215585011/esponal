# 统一导入 设计 spec(Phase 1)

> 2026-06-08 · Claude1(PM)brainstorm 定稿 · 关联:watch 字幕管线、lectura 阅读器、积分引擎

## 0. 背景与目标
让用户把外部内容带进 Esponal 学习:
- 粘贴**视频 URL**(Phase 1:YouTube)→ 生成字幕、站内观看。
- 上传**文档**(EPUB / PDF,含扫描件 OCR)→ 解析成可**点词查询**的读物,进"我的导入"库。
统一一个"导入"入口;**输入类型分批接**,本期 = YouTube URL + EPUB + PDF。本地视频/音频、Bilibili 为后续。

## 1. 范围:输入→管线→结果→计费
| 输入 | 管线 | 结果 | 计费 |
|---|---|---|---|
| YouTube URL | 解析 videoId → 现有字幕管线(Supadata 主 / Whisper 兜底) | 跳 `/watch?v=ID` 播放+字幕,进观看历史 | 字幕生成沿用 `video_unlock`=0.5(缓存未命中才扣) |
| EPUB | 解析章节 → 切页存储 | "我的导入"库 → 阅读器点词 | 免费 |
| 文本型 PDF | 直接抽取文字 → 切页存储 | 同上 | 免费 |
| 扫描型 PDF | 检测无文字层 → 云 OCR(西语)→ 切页存储 | 同上 | **消耗配额**(OCR 付费,按页计;费率待标定,先占位) |

**不在本期**:本地视频、本地音频(上传+存储+Whisper ASR);Bilibili URL(先可行性验证)。UI 上这些类型**灰显"即将支持"**。

## 2. 统一导入 UI
### Web — 新建 `/import` 页
- **URL 输入框**:粘贴视频链接 → 校验/解析 → 视频跳 watch。
- **文件上传区**:拖拽 / 选择,接受 `.epub`/`.pdf`;本地视频/音频项灰显"即将支持"。
- 上传后展示处理状态(处理中 → 可阅读 / 失败原因)。

### 移动端 — 底栏「导入」入口
- 底部 tab 栏加「导入」图标(BottomTabBar)。
- 点击 → **沿角标扇出**两个选项:`URL 上传` / `文件上传`(speed-dial 式)。
- 选中 → **自下而上 bottom-sheet** 输入框,**支持向下拖拽关闭**——**复用 MOBILE-000 查词卡那套**(`createPortal` + 拖拽手势 + 设计 token)。

## 3. 文档管线 + 数据模型 + 阅读器
### 解析(异步)
- Vercel 有函数超时限制 → **异步处理**:上传即建 `ImportedDocument(status=processing)` → 后台抽取/OCR/切页 → `status=ready`(或 `failed` 带原因)。UI 轮询/展示状态。
- **切页**:正文切成页单元存储。PDF=真实页;EPUB=可重排无固定页 → 按固定长度(建议 ~2–3k 字符)切"伪页"。
- **OCR**:文本 PDF 直接抽;检测到无文字层(扫描件)→ 走云 OCR(provider 可插拔,西语语种)。OCR 页数有上限(见 §5)。

### 数据模型(Prisma 新增)
```prisma
model ImportedDocument {
  id          String   @id @default(cuid())
  userId      String
  user        User     @relation(fields:[userId], references:[id], onDelete: Cascade)
  title       String
  kind        ImportKind            // epub | pdf_text | pdf_ocr
  status      ImportStatus @default(processing)  // processing | ready | failed
  failReason  String?
  pageCount   Int      @default(0)
  lastPageIndex Int    @default(0)  // 阅读进度
  createdAt   DateTime @default(now())
  sections    DocumentSection[]
  @@index([userId, createdAt])
}
model DocumentSection {
  id         String @id @default(cuid())
  documentId String
  document   ImportedDocument @relation(fields:[documentId], references:[id], onDelete: Cascade)
  pageIndex  Int
  content    String           // 该页正文(纯文本)
  @@unique([documentId, pageIndex])
  @@index([documentId, pageIndex])
}
enum ImportKind { epub pdf_text pdf_ocr }
enum ImportStatus { processing ready failed }
```

### 阅读器(复用)
- 复用 **`LecturaReader` / `SpanishText`**:点词查询、收藏、AI 回落全沿用(计费同现有规则)。
- 在「阅读」模块下加 **"我的导入"列表**(展示 ImportedDocument:标题/类型/状态/进度),可回看。
- **窗口加载**:阅读器只请求 `当前页 ±5 页` 的 section,翻页/滚动时增量拉相邻页;头尾收边(`from=max(0,cur-5)`,`to=min(pageCount-1,cur+5)`)。
- 进度:记 `lastPageIndex`,回看从上次页恢复并预取其窗口。

### 接口
- `POST /api/import/url` — 入参 URL,解析视频(本期 YouTube)→ 返回 `/watch?v=ID`。
- `POST /api/import/file` — 上传 epub/pdf → 建 ImportedDocument(processing)→ 触发异步处理 → 返回 docId。
- `GET /api/import/:id` — 文档状态/元信息。
- `GET /api/import/:id/pages?from=&to=` — 按页范围取 section(窗口加载)。
- `GET /api/import/documents` — 我的导入列表。
- `POST /api/import/:id/progress` — 记 lastPageIndex。

## 4. 计费
- 文档**导入/阅读免费**(契合输入式学习理念);查词沿用(本地免费、AI 回落 0.1)。
- **仅扫描件 OCR 消耗配额**(真实付费处理),按 OCR 页数计;费率写入 `ACTION_COST_MINOR`(新增键,值待真实成本标定,先占位),消费走积分引擎(扣费+流水 reason=spend, refType="ocr")。
- YouTube 导入字幕生成沿用 `video_unlock`。

## 5. 限制(控成本/稳定)
- 单文件 **≤100MB**。
- OCR 页数上限(默认建议 **300 页**,超出提示;防超大扫描书爆成本)。
- 仅西语内容(不做语言校验,默认假设;非西语查词体验自负)。
- 文件类型白名单:`.epub` / `.pdf`(本期)。

## 6. 错误处理
- URL 无法解析 / 非支持平台 → 内联报错。
- 文件超限/类型不符 → 上传前拦截 + 提示。
- 解析/OCR 失败 → `status=failed` + `failReason`,列表可见、可删除重试。
- OCR 配额不足 → 处理前置检查,非模态提示 + 跳 `/membership`(沿用 FE-003 不足提示)。

## 7. 测试要点
- URL 解析:各种 YouTube URL 形态(youtu.be / watch?v / shorts / 带参数)→ 正确 videoId;非法/非 YouTube → 报错。
- 文档切页:EPUB 章节→伪页、文本 PDF→页;pageCount 正确。
- 窗口加载:`pages?from=&to=` 收边正确、只返指定范围、越界不崩。
- OCR 判定:文本 PDF 不走 OCR、扫描件走 OCR 且扣费、配额不足拦截。
- 异步状态机:processing→ready / failed 流转;失败带原因。
- 阅读进度:lastPageIndex 记录与恢复。
- 计费:OCR 扣费+流水;EPUB/文本 PDF 不扣;阅读/查词沿用规则。

## 8. 不在范围(后续)
- 本地视频/音频导入(Whisper ASR + 上传存储)= Phase 2。
- Bilibili URL = 可行性验证后单列。
- 原始文件留存(本期只存解析后文本;是否存原件留待 Phase 2 决策)。
- 多语言内容、OCR 之外的版式还原(图片/表格)。
