# SUBS-001 (POC) — 服务端字幕抓取与同步可行性验证

**优先级**：P1（移动上线的可行性闸门）
**区域**：watch / subtitles
**依赖**：无
**预估**：1.5 天
**前序**：本 POC 通过后才进 SUBS-002（批处理 worker + 管道集成）

> 原名 WEB-017-POC，因 WEB-017 已被「YouTube Data API 配额优化」占用，改编号为 SUBS-001。

---

## 背景

移动端上线的关键：**用户不装任何扩展，就能在播放页看到高质量西语字幕**。
本 POC 验证「**服务端用 yt-dlp 批量预抓策划频道人工西语字幕**」这条主线是否可行（质量、反爬、成本），以及托管 API 兜底的备选成本。

**架构定位（重要，别画歪）**：yt-dlp 是**离线批处理**，提前把字幕填进 Redis；**不在用户请求路径里实时跑**。请求路径只有「查缓存 →（off-catalog 才）托管 API 兜底」。本 POC 只验证抓取+解析能力，不碰请求路径。

---

## 范围

### 做

1. **验证脚本** `scripts/poc-server-subtitles.mjs`
   - 接受 `--video=VIDEO_ID`（可多个或读一个频道）。
   - 直接调用本地 `yt-dlp` 二进制，不引入新的 npm 依赖。

2. **yt-dlp 离线抓取 + 解析**
   - 探测目标视频是否有**人工**西语字幕轨（`es` / `es-419`；区分 auto-generated）。
   - 命令参考：
     `yt-dlp --write-subs --sub-langs es,es-419 --sub-format json3 --skip-download -o "tmp/%(id)s" "https://www.youtube.com/watch?v=VIDEO_ID"`
   - 把 json3 的 events 解析成**现有标准 Cue 格式**：
     **`{ start: number /*秒*/, dur: number /*秒*/, text: string }`**
     （与 `src/app/api/subtitle/route.ts` 的 `SubtitleCue` 及扩展 `extension/parseJson3.js` 完全一致：`start = tStartMs/1000`、`dur = dDurationMs/1000`）。

3. **质量对比（关键：用已有 ground truth）**
   - Redis 里已有 ~11 个扩展抓取版字幕（如 `5vxteCt0WsY`、`J8Bh7D7YXAc`、`ZdluAW5AjJM`）。
   - 对同一视频,把 yt-dlp 抓的 cue 和 Redis 里扩展抓的逐条对比:条数、时间轴、文本是否一致。
   - 这是"yt-dlp 质量≈扩展"的硬验证,比空测强得多。

4. **反爬 / IP 封锁测试**
   - 在数据中心 IP（如一个临时 VPS / GitHub Action runner）跑，评估是否触发 `429` 或 `Sign in to confirm you're not a bot`。
   - 记录是否需要 proxies / cookies，以及降频到什么程度能稳。

5. **托管 API 横向对比（兜底备选）**
   - 测一个托管字幕 API（Supadata 或 Apify transcript scraper）：延迟、收费/免费额度、yt-dlp 被封时能否顶上、质量。

### 不做
- ❌ 改 `/api/subtitle` 路由 / Redis 写入(下一张 ticket SUBS-002)
- ❌ 改数据库 schema
- ❌ 实时请求路径集成

---

## 验收标准

- [ ] `scripts/poc-server-subtitles.mjs` 能 `node` 独立运行,`--video=` 输出解析好的 **`{start,dur,text}`(秒)** cue 数组
- [ ] 对策划频道视频(至少含一个 Redis 已有扩展版的,如 `5vxteCt0WsY`)能稳定抓到**人工** es 轨
- [ ] **质量对比报告**:yt-dlp vs 扩展版,条数/时间轴/文本一致性结论
- [ ] **反爬报告**:数据中心 IP 是否被封、是否必须代理/cookies、稳定降频值
- [ ] **托管 API 对比**:Supadata/Apify 的质量 + 成本核算
- [ ] 不引入新 npm 依赖
- [ ] POC 结论:**主线选 yt-dlp 还是托管 API**(给出明确推荐 + 理由),写进本 ticket 或 walkthrough

---

## 通过标准(闸门)

**yt-dlp 对策划频道:质量 ≈ 扩展版,且裸 IP 不被封(或加轻量代理即可稳)** → 押批量预抓主线,进 SUBS-002。
若 yt-dlp 被重封且代理成本高 → 评估托管 API 是否质量够 + 成本可接受作为主线。
