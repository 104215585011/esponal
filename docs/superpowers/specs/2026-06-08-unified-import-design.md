# 统一导入 设计 spec(Phase 1)— v2(方案 C + 腾讯云 COS)

> 2026-06-08 · Claude1(PM)brainstorm 定稿(v2:改为按格式渲染 + 原件存 COS)· 关联:watch 字幕管线、lectura/SpanishText 查词、积分引擎

## 0. 背景与目标
让用户把外部内容带进 Esponal:
- 粘贴**视频 URL**(Phase 1:YouTube)→ 复用现有字幕管线观看。
- 上传 **EPUB / PDF**(可含插图、版式)→ **忠实渲染 + 点词查询**,进"我的导入"库可回看。
统一一个"导入"入口;本期类型 = YouTube URL + EPUB + PDF。本地视频/音频、Bilibili 为后续。

**核心取向(v2)**:面向**100MB+ 图文书**,要**良好阅读体验**(图/版式不能丢),所以**不抽纯文本**,而是**存原件 + 按格式原生渲染**。

## 0b. 部署与存储拓扑
- 主站在 **Vercel**(用户自带 VPN,可访问 + 能抓 YouTube)。
- **原始文件存腾讯云 COS**(S3 兼容;桶 `esponall-1311817841`,region `ap-guangzhou`,私有读写)。
- **客户端直传 + 客户端渲染**:绕开 Vercel API ~4.5MB 请求体上限;大文件不经 Vercel。
- env(已配 Vercel + 本地 .env,不进 git):`COS_SECRET_ID` / `COS_SECRET_KEY` / `COS_BUCKET` / `COS_REGION`。存储层 provider 可换(S3 SDK 指向 COS endpoint)。

## 1. 范围:输入→管线→结果→计费
| 输入 | 管线 | 结果 | 计费 |
|---|---|---|---|
| YouTube URL | 解析 videoId → 现有字幕管线 | 跳 `/watch?v=ID` 播放+字幕,进观看历史 | 沿用 `video_unlock`(缓存未命中) |
| EPUB | 客户端 epub.js 原生渲染(读 COS 原件) | "我的导入"库 → 沉浸阅读 + 点词 | 免费 |
| PDF(有文字层) | 客户端 pdf.js + Range 按页渲染(读 COS 原件) | 同上(图文忠实 + 点词) | 免费 |
| PDF(扫描件/无文字层) | pdf.js 仍能**忠实显示**;**点词需 OCR 文字层=本期不做** | 能读不能点(点词后续) | 免费 |

**不在本期**:本地视频/音频(上传+ASR);Bilibili URL(先验证);**扫描件点词(OCR 文字层)**。UI 上未支持类型灰显"即将支持"。

## 2. 统一导入 UI(设计稿:IMPORT-3-design.md / IMPORT-4-design.md,均已 Gemini1 交付+PM 放行)
### Web — 新建 `/import` 页
- 居中卡片:URL 输入框 + 文件上传区(接受 .epub/.pdf);本地音视频/Bilibili 灰显"即将支持"。
- 上传/处理有明确 Loading 反馈,防重复点击。

### 移动端 — 底栏「导入」入口
- BottomTabBar 加「导入」`+` 图标 → 点击弹出**两列卡片 Popover**(视频链接 / EPUB·PDF)(**采用弹出面板,非扇出**)。
- 选中 → **自下而上 bottom-sheet**(`ImportSheet`),**向下拖拽关闭**——**复用 MOBILE-000 查词卡** bottom-sheet 框架。

## 3. 存储与上传(原件存 COS + 客户端直传)
- **上传流程**:客户端校验类型/大小(≤100MB)→ 调 `POST /api/import/presign`(后端用 COS 凭证签发**预签名 PUT URL** + 生成 ossKey)→ 客户端 **PUT 原件直传 COS** → 调 `POST /api/import/document`(报 ossKey + 元信息)建 `ImportedDocument`。**原件全程 client→COS,不经 Vercel。**
- **读取**:阅读时调 `GET /api/import/:id/url` 拿**预签名 GET URL**(短时效)→ 客户端渲染器(pdf.js Range / epub.js)直接从该 URL 读。
- **程序化访问**:用预签名 + `fetch`/Range(非浏览器直链预览),配合桶 CORS(已配:Origin 含线上+localhost,Methods PUT/GET/HEAD,Expose `Content-Range`/`ETag`)。⚠️ 实现时实测确认 COS"默认域名预览限制"不影响程序化 Range 读;若被挡,退路=自定义域名(需备案)或换香港 region 桶。

## 4. 渲染与点词(方案 C:按格式)
- **EPUB**:`epub.js` 渲染 spine/章节(图/版式天然保留);**按章加载**=天然窗口化;在渲染文字上挂点击 → 唤起现有查词(`MobileLookupSheet`/`LookupCard`)。
- **PDF**:`pdf.js` 用 **HTTP Range 按页取**(只拉在看的页,当前页±5)→ canvas 渲染(图文忠实)+ 文字层;在文字层挂点击 → 查词。
- **复用**:查词卡 / `SpanishText` 的查词→收藏→AI 回落逻辑全沿用(计费同现有规则)。

## 5. 数据模型(Prisma 新增,简化:不存正文文本)
```prisma
model ImportedDocument {
  id          String   @id @default(cuid())
  userId      String
  user        User     @relation(fields:[userId], references:[id], onDelete: Cascade)
  title       String
  kind        ImportKind            // epub | pdf
  ossKey      String                // COS 对象键
  sizeBytes   Int
  unitCount   Int      @default(0)  // PDF=页数 / EPUB=spine 项数(客户端首载后回报)
  lastPosition String  @default("") // 阅读进度:PDF=页码字符串 / EPUB=cfi
  status      ImportStatus @default(ready)  // ready | failed
  failReason  String?
  createdAt   DateTime @default(now())
  @@index([userId, createdAt])
}
enum ImportKind { epub pdf }
enum ImportStatus { ready failed }
```
> 不存 `DocumentSection` 正文——渲染器直接读 COS 原件;DB 只存元信息 + 进度。

## 6. "我的导入"库 + 阅读器(设计:IMPORT-3-design.md)
- 列表(「阅读」模块下分区或独立 `/import/library`):卡片显示标题/类型徽标/进度;`failed` 显红色原因 + 删除;上传中显处理态。
- 阅读页 `/import/[id]`:复用沉浸阅读器外壳;移动端底部悬浮控制条(字号/朗读/翻页 `12/300`/滑块跳页);进度记 `lastPosition` 并恢复。

## 7. 接口
- `POST /api/import/url` — 解析视频 URL(本期 YouTube)→ `{redirect:"/watch?v=ID"}`;非法→400。
- `POST /api/import/presign` — 入参 `{filename, kind, sizeBytes}`,校验后签发**预签名 PUT URL** + ossKey。
- `POST /api/import/document` — 入参 `{title, kind, ossKey, sizeBytes, unitCount?}` → 建 ImportedDocument。
- `GET /api/import/documents` — 我的导入列表。
- `GET /api/import/:id` — 文档元信息。
- `GET /api/import/:id/url` — 签发**预签名 GET URL**(短时效)供渲染读取(只限本人文档)。
- `POST /api/import/:id/progress` — 记 `lastPosition`(+ 首载回报 `unitCount`)。
- 存储封装:`src/lib/storage/cos.ts`(presignPut/presignGet,S3 兼容,可换 provider)。

## 8. 限制
- 单文件 **≤100MB**(客户端上传前校验)。
- 类型白名单:`.epub` / `.pdf`。
- 仅西语内容(不校验,默认假设)。

## 9. 错误处理
- URL 非法/非 YouTube → 内联报错。
- 文件超限/类型不符 → 上传前拦截。
- 直传失败/中断 → 可重试;失败文档 `status=failed`+`failReason`,列表可删可重试。
- 预签名过期 → 重新签发。
- 扫描件无文字层 → 可正常阅读;点词处提示"该书为扫描件,暂不支持点词"。

## 10. 不在本期(后续)
- 本地视频/音频导入(Whisper ASR + 存储)= Phase 2。
- Bilibili URL = 可行性验证后单列。
- **扫描件点词(OCR 文字层 + 词位置)**= 后续(本期扫描件能读不能点)。
- 原件之外的衍生资源、多语言、版式深度还原。

## 11. 测试要点
- URL 解析:各种 YouTube 形态→videoId;非法→报错。
- presign:鉴权、类型/大小校验、签发可用的 PUT URL;document 建记录正确。
- 读取签名:`:id/url` 只对本人文档签发、短时效。
- 列表/进度:只见本人;`lastPosition`/`unitCount` 记录与恢复。
- 渲染(前端,源码契约 + 关键行为):EPUB epub.js 挂载、PDF pdf.js Range 取页、点词唤起查词。
- 限制:>100MB / 非 epub-pdf 被拦。
- COS 封装:presignPut/presignGet 单测(可 mock SDK)。
