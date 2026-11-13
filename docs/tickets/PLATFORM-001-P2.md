# PLATFORM-001-P2 — 双语字幕 + 阅读模块【已实现】

> 2026-11-13 · 实现:Codex · 父票:`PLATFORM-001-native-app.md`
> App 端仓库:`C:\e`(远程 `esponal` 仓库 `mobile` 分支)

---

## 一、双语字幕

### 需求
看西语视频时,只看西语容易卡在生词上;纯机器翻译又会破坏语感。要「西语为主、中文辅助」,并且能一键关掉。

### 实现

**翻译策略:滑动窗口,不是全量**

```
当前播放句 = activeIndex
窗口       = [activeIndex - 2, activeIndex + 2]   ← 只翻这 5 句
执行方式   = 串行 for 循环(不并发)
缓存       = Map<原文, 译文>(跨句复用)
```

为什么不一次性翻全部字幕:
- 一集 18 分钟视频约 300 句,全翻要 300 次请求,直接打爆 `/api/translate` 的 60 次/分钟限流
- 而且用户可能只看前 2 分钟就退出,浪费额度

串行 + 窗口的好处:看视频时当前句永远有中文,滚到新位置时前 2 句已准备好,不会阻塞。

**降级**:翻译请求失败 → 静默返回 null,字幕只显示西语,**绝不因为翻译挂了而白屏**。

**开关**:播放控制条上的「中文」按钮,关掉即回纯西语沉浸模式(已翻译的结果保留在 state,再开不用重新请求)。

### 代码
| 文件 | 改动 |
|---|---|
| `src/api/watch.ts` | 新增 `translateText(text)` |
| `app/watch/[videoId].tsx` | `translations` state + 窗口翻译 effect + 「中文」开关 |
| `src/components/TranscriptRow.tsx` | 新增 `translation` 属性,西语下方渲染中文小字 |

### 排版
- 西语:16.5px(当前句 18px 加粗)
- 中文:12.5px(当前句 13.5px),灰色,最多 3 行截断
- 当前句整行底色 `brand-50`,与中文形成视觉分组

---

## 二、阅读模块

### 后端(新增接口,主仓库)

| 接口 | 说明 |
|---|---|
| `GET /api/lectura/stories` | 分级列表,**不返正文**(减小体积),登录后带 `isRead` |
| `GET /api/lectura/stories/[slug]` | 单篇详情:正文段落 + 生词表 |

- 走 **双通道鉴权**:未登录也能拿到列表(内容公开),带 Bearer 或 cookie 即可识别已读状态
- 数据源复用现有 `content/lectura/*.ts`(34 篇分级短文),不新增存储
- 文件:`src/app/api/lectura/stories/route.ts`、`src/app/api/lectura/stories/[slug]/route.ts`

### App 端

| 文件 | 内容 |
|---|---|
| `src/api/lectura.ts` | 列表 / 详情请求 + 类型 |
| `app/(tabs)/lectura.tsx` | 分级列表:A1/A2/B1 筛选、已读标记、下拉刷新 |
| `app/lectura/[slug].tsx` | 原生阅读器:段落 + 生词表折叠 + 返回 |
| `src/components/ParagraphBlock.tsx` | 段落内逐词可点(与字幕行共用同一套分词规则) |

### 阅读器交互
- **点任意单词** → 唤起 `LookupSheet`(与播放页同一个组件):释义、音标、例句、加入词库
- **生词表**默认折叠,展开后每行也可点(直接查该词)
- 段落连续排版(不像字幕那样按句切块),符合阅读节奏

---

## 三、证据

### 静态
- App:`npx tsc --noEmit` 通过
- 主仓库:`npx tsc --noEmit` 通过、编码检查通过

### 单测
- 主仓库 `npm test` → **529 / 529**

### 接口实测(生产环境)
```bash
curl https://www.pcmuz.cn/api/lectura/stories
→ {"items":[{"slug":"la-tortuga-y-la-liebre","title":"La tortuga y la liebre",
   "titleZh":"乌龟与兔子","level":"A1","paragraphCount":6,"isRead":false}, ...]}

curl https://www.pcmuz.cn/api/lectura/stories/la-tortuga-y-la-liebre
→ {"story":{"paragraphs":[6 段],"glossary":[],...}}
```

### 构建
- GitHub Actions `Build Android APK`:见 `mobile` 分支 Actions 记录
- 产物经 Release 发布为公开直链

---

## 四、已知限制

1. **双语字幕依赖翻译接口额度**:`/api/translate` 按用户限流 60 次/分钟。滑动窗口策略下正常观看不会触发,但快速拖动进度条可能瞬间消耗较多。
2. **翻译质量**:服务端走 DeepSeek/DashScope 链路,短语和习语偶尔直译。生词表类内容仍建议以查词为准。
3. **阅读 tab 的「已读」只读不改**:目前只展示历史已读,没有在 App 内标记已读(接口 `POST /api/lectura/[slug]/read` 已存在,接上即可)。
4. **阅读无段落音频**:Web 端有段落 mp3 朗读,App 端尚未接。
5. **离线缓存**未做:字幕、文章都需联网。

---

## 五、下一步建议

按价值排序:
1. **阅读器接段落朗读**(`/api/tts` 已有,Web 端有 mp3)——语言学习里「听读同步」价值很高
2. **字幕/文章本地缓存**(AsyncStorage + 版本号),解决地铁、飞机场景
3. **App 内标记已读**(一个 POST 的事)
4. AI 对话 tab(`/api/talk/*` 已就绪)
