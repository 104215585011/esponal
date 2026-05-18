# CONTENT-001 — YouTube 视频音频批量离线下载

**优先级**：P1 | **负责人**：Codex1 / PM | **日期**：2026-05-18
**前置依赖**：无（`yt-dlp` 已在 `.env.example` 配置，`localWhisper.ts` 已有 `downloadYoutubeAudio` 可参考）

---

## 背景

字幕识别管线的真实痛点定位：Apify 拿到的字幕中间会有洞，本地 Whisper 又只能 offline 跑（`subprocess + .pt`），Vercel 生产环境跑不动。

方案 A 选定：**本地预转录策划频道 → JSON 写入 Upstash Redis → 生产环境直接命中缓存**。

整个流水线分三步，本 ticket 只做第一步：**把要预转录的视频音频先下载到本地缓存**。

把下载从转录里拆出来的原因：
- 下载是网络密集型、最慢、最不稳定（地区锁、超时、视频下架）
- 转录是 GPU 密集型、本地可控
- 分离后失败可分别重试；下载可以连夜跑，转录第二天慢慢做

---

## 一、命令行约定

```bash
# 下载所有策划频道的最近 N 个视频音频
node scripts/download-videos.mjs --channels=all --recent=20

# 只下载某频道
node scripts/download-videos.mjs --channel=UCouyFdE9-Lrjo3M_2idKq1A --recent=10

# 显式视频 ID
node scripts/download-videos.mjs --videos=dQw4w9WgXcQ,abc123xyz

# 重跑已失败的（manifest 里 status="failed" 的）
node scripts/download-videos.mjs --retry-failed
```

---

## 二、产出

### 文件结构

```
.cache/whisper/
├── manifest.json              # 索引：videoId -> 状态、路径、元数据
├── audio/
│   ├── dQw4w9WgXcQ.m4a       # 实际音频文件（让 yt-dlp 选最佳音频格式）
│   ├── abc123xyz.m4a
│   └── ...
└── failures/
    └── dQw4w9WgXcQ.log        # 失败时保留 yt-dlp 的 stderr，方便诊断
```

### manifest.json 格式

```json
{
  "version": 1,
  "updatedAt": "2026-05-18T12:34:56.000Z",
  "videos": {
    "dQw4w9WgXcQ": {
      "status": "downloaded",
      "channelId": "UCouyFdE9-Lrjo3M_2idKq1A",
      "channelTitle": "Dreaming Spanish",
      "title": "...",
      "durationSec": 482,
      "audioPath": "audio/dQw4w9WgXcQ.m4a",
      "audioBytes": 7392841,
      "downloadedAt": "2026-05-18T12:34:56.000Z"
    },
    "deadVideo": {
      "status": "failed",
      "channelId": "...",
      "title": "...",
      "lastAttemptAt": "2026-05-18T12:35:00.000Z",
      "attemptCount": 3,
      "lastError": "video unavailable"
    },
    "queued1": {
      "status": "pending",
      "channelId": "...",
      "title": "...",
      "discoveredAt": "..."
    }
  }
}
```

状态机：
- `pending` — 已从 channel API 发现，未下载
- `downloaded` — 音频文件就绪
- `failed` — 三次重试失败，需要人工干预（手动改 status 重试）

---

## 三、实现要点

### 复用现有 yt-dlp 调用

`src/lib/localWhisper.ts` 里已经有 `downloadYoutubeAudio(videoId, config)`。**抽出来**到独立模块 `src/lib/ytdlpDownload.ts`，两边都用：

```ts
// src/lib/ytdlpDownload.ts
export type DownloadResult = {
  videoId: string;
  audioPath: string;
  audioBytes: number;
};

export async function downloadYoutubeAudio(
  videoId: string,
  options: { outputDir: string; ytdlpPath?: string; timeoutMs?: number }
): Promise<DownloadResult>;
```

`localWhisper.ts` 改为 import 这个；行为不变。

### 视频发现

调用 `src/lib/youtube.ts` 里现有的 `getChannelUploads()` 或类似函数拿最近 N 个视频。**不要重复实现 YouTube Data API 调用**。

策划频道列表从 `src/lib/channels.ts` 读。

### yt-dlp 命令

```
yt-dlp \
  --format "bestaudio[ext=m4a]/bestaudio/best" \
  --output "{outputDir}/audio/%(id)s.%(ext)s" \
  --no-playlist \
  --no-warnings \
  --quiet \
  https://www.youtube.com/watch?v={videoId}
```

不要下完整视频。`bestaudio` 大多是 m4a，几 MB 而非几十 MB。

### 重试 & 跳过

- 每个视频最多 3 次重试，指数退避（2s, 6s, 18s）
- 已 `downloaded` 状态的跳过（除非 `--force` 加上）
- 已 `failed` 的默认跳过，加 `--retry-failed` 才重新尝试

### 并发

最多 **3 个**并发下载（避免 YouTube 限速）。用简单的 worker pool 实现。

### 进度输出

```
[CONTENT-001] discovering videos for 3 channels...
[CONTENT-001] found 60 videos (20 per channel × 3)
[CONTENT-001] [1/60] dQw4w9WgXcQ "Rick Astley - Never..." downloading... 7.4 MB ✓
[CONTENT-001] [2/60] abc123xyz "..." skipped (already downloaded)
[CONTENT-001] [3/60] deadXYZ "..." FAILED: video unavailable
...
[CONTENT-001] done: 55 downloaded, 4 skipped, 1 failed
```

---

## 四、文件清单

**新增**：
- `scripts/download-videos.mjs`
- `src/lib/ytdlpDownload.ts`（从 `localWhisper.ts` 抽出）
- `tests/content001.test.mjs`

**修改**：
- `src/lib/localWhisper.ts`：改为 import `downloadYoutubeAudio` from 抽出的模块
- `.gitignore`：确认含 `.cache/`（应该已经有了）

---

## 五、测试断言（contract-only，不真跑 yt-dlp）

- `scripts/download-videos.mjs` 存在且 import `src/lib/ytdlpDownload.ts`
- `src/lib/ytdlpDownload.ts` 存在且 export `downloadYoutubeAudio`
- `src/lib/localWhisper.ts` 不再自己 `spawn("yt-dlp", ...)`，改为调用抽出模块
- manifest 类型定义包含 `status: "pending" | "downloaded" | "failed"`
- 脚本支持 `--channels` / `--channel` / `--videos` / `--retry-failed` 参数（grep CLI 解析）

实际下载行为需要本地手动验证（脚本跑通 + 看 `.cache/whisper/manifest.json` + 音频文件存在）。

---

## 六、验收（PM 手验，不走 Codex2 自动 QA，因为要真跑 yt-dlp）

1. `npm test` 通过（合同测试）
2. `npm run build` 通过
3. 本地跑 `node scripts/download-videos.mjs --channel=UCouyFdE9-Lrjo3M_2idKq1A --recent=3`
4. `.cache/whisper/audio/` 下有 3 个 `.m4a` 文件
5. `.cache/whisper/manifest.json` 三条记录状态都是 `downloaded`
6. 重跑同命令 → 三条都 `skipped`，不重复下载
7. 给一个不存在的 videoId（`--videos=DOES_NOT_EXIST_123`）→ 状态 `failed`，stderr 写入 `failures/`

---

## 七、不在本 ticket 范围内

- **CONTENT-002**（下一票）：Whisper 批量转录读 manifest 里的 `downloaded` 状态，转录后写 JSON
- **CONTENT-003**（再下一票）：转录 JSON 推送 Upstash Redis，验证 `/api/subtitle` 缓存命中
- 自动定时拉取新视频（cron job）→ 长远再说
- 用户向的「下载视频离线学」功能 → 完全不同方向，不在本 phase

---

## 注意事项

- yt-dlp 自身要在系统 PATH 或 `YTDLP_PATH` 指向。如果未安装，脚本第一句话提示安装方法（`pip install -U yt-dlp` 或下载二进制）
- 不要把 `.cache/whisper/audio/*.m4a` 入 git——可能几 GB
- YouTube Data API quota：发现 60 个视频大约 0.6 quota unit，可忽略
- 音频下载失败常见原因：地区锁（部分频道）、年龄限制、视频已删除——manifest 里 lastError 字段如实记录
