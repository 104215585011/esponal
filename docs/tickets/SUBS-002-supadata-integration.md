# SUBS-002 — 把 Supadata 接入 /api/subtitle 作为字幕主力

**优先级**：P1（移动上线主线落地）
**区域**：watch / subtitles / `src/app/api/subtitle/route.ts`
**实现**：Codex1
**测试**：Codex2 + PM 验收
**依赖**：SUBS-001（POC 已通过 ✅ Supadata 质量=扩展、零运维）
**预估**：0.5-1 天

---

## 背景

SUBS-001 POC 证实：**Supadata 托管 API** 抓策划视频的人工西语字幕，质量与扩展抓取**逐条一致**（445/447，差异仅浮点）、5.4s 返回、零运维零反爬。

本 ticket 把它接进请求路径作**主力来源**，让移动端/Safari **零扩展**即得人工字幕。yt-dlp 已排除（bot 封锁，详见 SUBS-001）。

---

## 现状（route 已具备的基础）

`src/app/api/subtitle/route.ts` 已有：
- 请求路径：**先查 Redis 缓存命中即返回**；未命中才 `fetchSubtitlesWithFallback`。
- `fetchSubtitlesWithFallback` 返回 `{ cues, source }`（现为 apify → whisper）。
- 缓存 envelope：`{ cues, source, at }`，写 Redis；GET 读出 `source`。
- `clampOverlappingCues` 在返回前对**所有来源**统一去重叠（Supadata 也会过）。
- 响应头 `X-Subtitle-Source` + body `source` 字段已就绪。
- `SubtitleSource` 类型当前：`"extension" | "apify" | "whisper" | "cache" | "none"`。

---

## 实施要求

### 1. 新增 Supadata 抓取函数
- `async function fetchSupadataSubtitles(videoId, lang): Promise<SubtitleCue[]>`
- 读 `process.env.SUPADATA_API_KEY`（Vercel Production 已配）。**缺 key → 返回 []**（不抛，优雅跳过）。
- 调 Supadata transcript 接口（POC 用的同一个），请求 `lang=es`（含 es/es-419 处理）。
- 响应 `content[]` 每项 `{ text, offset(ms), duration(ms) }` → 归一化为标准 **`{ start: offset/1000, dur: duration/1000, text }`（秒）**。
- 网络错误/非 200/空 → 返回 `[]`（不抛）。

### 2. 接入回退链（顺序关键）
`fetchSubtitlesWithFallback` 改为：
```
1. Supadata(主力)  → 有有效 cue → return { cues, source: "supadata" }
2. Apify(hybrid)   → 有 → return { cues, source: "apify" }
3. Whisper(fallback) → 有 → return { cues, source: "whisper" }
4. 都没有 → { cues: [], source: "none" }
```
- `forceWhisper=1` 时维持现状（跳过 Supadata+Apify 直接 Whisper）。
- "有有效 cue" 判定：复用现有 `shouldUseWhisperFallback` 思路或 `cues.length >= MIN_REASONABLE_CUE_COUNT`，太少则视为无效、继续下一级。

### 3. 类型 + 来源标记
- `SubtitleSource` 加 `"supadata"`。
- 命中 Supadata → envelope `source:"supadata"` 写 Redis、响应头 `X-Subtitle-Source: supadata`。

### 4. 成本控制（务必）
- Supadata **只在缓存未命中时**被调用（请求路径已是缓存优先，Supadata 在 fetch fallback 内，天然满足）。
- 抓到的结果**写入 Redis 缓存**（envelope，TTL 同现有）→ 重复访问走 Redis，不重复打 Supadata。**确认这条链路成立**（别让某个分支跳过缓存写入）。

### 5. 密钥安全
- `SUPADATA_API_KEY` 只来自 `process.env`（Vercel 已配 + 本地 .env）。
- **绝不把真 key 写进提交的代码**。`.env.example` 可加占位 `SUPADATA_API_KEY=`（无值）。

### 6. 测试
- 加 route 单测（mock Supadata fetch）：
  - Supadata 返回有效 → source=supadata、cue 归一化正确（ms→秒）。
  - Supadata 空/报错 → 降级到 apify。
  - 缺 SUPADATA_API_KEY → 跳过 Supadata 不报错。
- `npm test` 全绿。

---

## 不在本 ticket 范围
- ❌ 自建批处理 worker（实时 Supadata + 缓存已够，不搭长驻基建）。
- ❌ 策划目录预热脚本（可选优化，单独 ticket）。
- ❌ 前端「字幕来源」UI 标签（单独 UI ticket，走 Gemini）。
- ❌ 移动端布局适配 / Capacitor 套壳（轨 B，另行）。

---

## 验收标准（PM）
- [ ] 查一个策划视频（如 `5vxteCt0WsY`，先清其 Redis 缓存）→ `X-Subtitle-Source: supadata`、字幕同步对、与扩展版一致
- [ ] 查一个 Supadata 拿不到的视频 → 优雅降级到 `apify`（不报错、不开天窗）
- [ ] 同一视频二次请求 → 命中 Redis 缓存（`X-Vercel-Cache` 行为 + 不再打 Supadata，成本有界）
- [ ] 缺 key 场景不崩（降级）
- [ ] `npm test` 通过、`tsc` 通过
- [ ] 部署后移动端打开策划视频，零扩展即出人工字幕

---

## 执行流程
```
Claude1（本 ticket）→ Codex1（改 route + Supadata 函数 + 测试）→ Codex2 回归 → PM 验收（X-Subtitle-Source=supadata + 质量 + 缓存 + 降级）→ passing
```
