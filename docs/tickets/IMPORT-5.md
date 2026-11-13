# IMPORT-5 — 导入阅读改进:EPUB 恢复图文 + 阅读器拆分【工程票·Codex1】

**优先级**:P1(PM 核验发现实现偏离 v2 spec)
**实现**:Codex1 · **测试**:Codex2 + 真机 · **验收**:PM 对照 spec v2 §4

## 背景(PM 核验结论,2026-06-11)
- 当前 EPUB 走"服务端抽**纯文本**章节(/api/import/[id]/epub)+ 客户端白文本渲染",**插图全部丢失** —— 违背 spec v2 "图文忠实"核心取向(用户场景=带图教材如 Aula internacional)。
- `ImportReaderClient.tsx` 745 行,EPUB/PDF 揉在一个文件,违背计划的 EpubReader/PdfReader 拆分。
- PDF 半边(pdf.js+文字层点词+复用 LookupCardStack)实现良好,**不要动**。

## 任务
1. **EPUB 恢复图文**:章节渲染保留 HTML 结构与**图片**(两条路任选其一,说明取舍):
   a. 客户端 epub.js 直读预签名 URL 渲染(spec 原案);
   b. 保留服务端解包,但章节返回**净化后的 HTML(含 img,图片资源转预签名 URL/内联)**,客户端 `dangerouslySetInnerHTML` 前必须 sanitize(防 XSS:白名单标签/属性,去 script/事件)。
   - 点词:在渲染后的文字节点上挂现有查词(LookupCardStack),不丢现有能力。
2. **拆分**:`ImportReaderClient.tsx` → `EpubReader.tsx` + `PdfReader.tsx` + 壳(分发/共享控制条),逻辑不变,纯结构整理。
3. **回归**:PDF 阅读、点词、进度(lastPosition)、扫描件提示全部不回退;`npm test` 全绿 + lint:encoding。

## 验收
- [ ] 带插图 EPUB(用户的 Aula 教材类)真机打开:图在、版式可读、点词可用。
- [ ] XSS 防护有测试(注入 script/onerror 的 EPUB 被净化)。
- [ ] 拆分后文件各 <400 行,行为零变化;PDF 回归通过。
