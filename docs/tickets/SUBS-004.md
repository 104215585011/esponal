# SUBS-004 — 默认关闭 Apify 字幕源（省额度），回退链改 Supadata→Whisper

**优先级**：P2（成本控制）
**区域**：backend / `src/app/api/subtitle/route.ts`
**实现**：Codex1
**测试**：Codex2 + PM 验收
**依赖**：SUBS-002（Supadata 已是主力，passing）
**预估**：0.5 天

---

## 背景 / 目的

目的：**省钱**。Supadata 抓人工西语字幕质量=扩展、已是默认第一顺位；不想再默认消耗 Apify 额度。

现状回退链（`fetchSubtitlesWithFallback`，route line 383-393）：
```
Supadata → Apify(hybrid manual+ASR) → Whisper → 兜底
```
Apify 只在 Supadata 没字幕 / 字幕不合格（< 6 条 或 间隔 > 25s）时触发，但只要触发就烧 Apify 额度。

## 决策：软关，不硬删

**用环境变量开关，默认关闭 Apify，保留可逆。** 不删 Apify 代码（那套 manual+ASR 合并逻辑有价值），设 `APIFY_ENABLED=1` 可随时恢复。

兜底策略（PM 已定）：Supadata 拿不到 → **跳过 Apify → 直接 Whisper**（本机，经 Cloudflare Tunnel）。

---

## 用户可见行为

- 字幕抓取默认只用 Supadata。
- Supadata 拿不到或字幕不合格 → 跳过 Apify → 走本机 Whisper 兜底。
- 不再默认消耗 Apify 额度。

---

## 实施要求

1. **新增开关**：`const APIFY_ENABLED = process.env.APIFY_ENABLED === "1";`（默认 false）。
2. **回退链改造**（`fetchSubtitlesWithFallback`）：
   ```
   Supadata 不合格
     → if (APIFY_ENABLED) 才 fetchHybridSubtitles，合格则返回 apify
     → Whisper
   ```
   即在现有 Apify 那一步（line 389）外面包 `if (APIFY_ENABLED)`；关闭时直接跳到 Whisper。
3. **兜底分支**（line 412 `if (apifyCues.length > 0)`）：APIFY_ENABLED 关闭时 `apifyCues` 为空数组，该分支自然不触发，无需额外改；但确认逻辑正确（关闭时不会返回 apify）。
4. **`.env.example`**：加 `APIFY_ENABLED=""`（注释说明默认关，设 1 启用）。
5. **保留** `fetchHybridSubtitles`、`callApify`、`mergeManualWithAsr` 等代码不动，只是默认不调用。
6. **不动** `forceWhisper=1` 路径（仍直接 Whisper）。

---

## 验收标准

- [ ] `APIFY_ENABLED` 默认（未设/非 1）时，回退链跳过 Apify：Supadata → Whisper。
- [ ] 抓一个 Supadata 无字幕的视频，日志确认**未调用 Apify**、直接走 Whisper（无 `[subtitle] Apify fetched` 日志）。
- [ ] `APIFY_ENABLED=1` 时回退链恢复含 Apify，原逻辑不破坏。
- [ ] `.env.example` 记录 `APIFY_ENABLED`。
- [ ] route 单测（mock）覆盖开/关两种回退路径。
- [ ] `npm test` 全绿。

---

## 不在本 ticket 范围

- ❌ 删除 Apify 代码（保留可逆）。
- ❌ 改 Supadata 合格判定阈值（MIN_CUE=6 / GAP=25s）—— 如需调另开 ticket。
- ❌ 移动 Whisper 兜底架构。

---

## 流程

Claude1（本 ticket）→ Codex1（实现 + 单测）→ Codex2（测试）→ Claude1 验收。纯后端无 UI。

> 协作提醒：UTF-8 编辑器；勿改无关文件；SUPADATA_API_KEY / APIFY_API_TOKEN 真值只在 .env / Vercel，勿提交。
