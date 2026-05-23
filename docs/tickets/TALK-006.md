# TALK-006 — 语音识别接入本机 Whisper Large v3 Turbo（via Cloudflare Tunnel）

**优先级**：P1（替换 Web Speech API + 失效的 Fish Audio ASR，明显改善西语识别）
**区域**：talk
**依赖**：TALK 集成 P3 ✅、TALK-002 ✅（fix 完后再做）

---

## 背景

当前语音输入链路：
```
TalkClient → 浏览器 Web Speech API → 文字 → /api/talk/message → DeepSeek
```

问题：
- Web Speech API 西语识别质量一般，不同浏览器表现差异大，Safari/Firefox 不支持
- 老的 `/api/talk/recognize` 走 Fish Audio ASR，**用户验证：识别不出来**

PM（王）已在本机部署 **Whisper Large v3 Turbo** + FastAPI 服务（端口 8000），并通过 Cloudflare Tunnel 暴露出公网 URL：

```
https://thoroughly-ashley-pediatric-collaborative.trycloudflare.com
```

`/health` 端点已联调通。`/transcribe` 端点契约（PM 已设置）：

```http
POST /transcribe
Content-Type: application/json
Body: { "audio_base64": "...", "language": "es", "suffix": ".webm" }
Response: { text, segments?: [{ start, end, text, avg_logprob? }] }
```

## 范围

### 做

**后端**：

1. 改 `src/app/api/talk/recognize/route.ts`：
   - 移除现有 Fish Audio 调用
   - 改为转发到 `process.env.WHISPER_TUNNEL_URL + "/transcribe"`
   - body 改为 `{ audio_base64, language, suffix }` 格式（去掉 Fish Audio 的 multipart）
   - 透传 Whisper 返回的 `text` + 可选 `segments`
   - `WHISPER_TUNNEL_URL` 未配 / 返回失败 / 超时（> 20s）→ 返回 `{ transcript: "", provider: "unavailable" }`，不抛 500
2. 新增 `src/lib/talk/whisper-client.ts`（薄封装，含 fetch + 超时 + 错误归一化）

**前端**：

1. 改 `src/app/talk/[characterId]/TalkClient.tsx`：
   - **撤回**当前用的 Web Speech API 那条路径
   - 改回 MediaRecorder 录音方案（之前的初版逻辑），但调用 `/api/talk/recognize` 拿转写
   - 录音 UX 保留"点击切换"模式（**不**做 TALK-004 的按住说话——那是另外的票）
   - 实时反馈：录音中显示「正在录音 0:03」（不显示实时识别中字，因为 Whisper 是一次性返回，非流式）
   - 录完显示「识别中...」→ Whisper 返回 → 转写文本进输入框，**用户可编辑后回车发送**
2. 兜底：如果 `/api/talk/recognize` 返回 `provider: "unavailable"`（隧道断），**降级到 Web Speech API**（保留原代码作为 fallback）

**env**：

1. `.env.local`、`.env`、`.env.production.example` 各加一行：
   ```env
   WHISPER_TUNNEL_URL="https://thoroughly-ashley-pediatric-collaborative.trycloudflare.com"
   ```
2. Vercel 控制台同步设置

**文档**：

1. `docs/talk-whisper-tunnel.md`（新增）写明：
   - 隧道 URL 是临时的，cloudflared 重启会变
   - 个人用：开机后跑 `whisper_service.py` + `cloudflared`，env 更新一次
   - 生产用：不可行——见 TALK-004 / 其他长期方案

### 不做

- ❌ 不做"按住说话"UX（那是 TALK-004 范围）
- ❌ 不做语音气泡（仍是「转写后塞进输入框」）
- ❌ 不读 Whisper 的 segment confidence 用于发音提示（留给独立 follow-up）
- ❌ 不接生产长期方案（OpenAI Whisper API / 阿里云 Paraformer）——单独开票

## 验收

- [ ] 设 `WHISPER_TUNNEL_URL`，本机 Whisper 服务跑着，cloudflared 跑着
- [ ] `/talk/carlos` 点🎤 → 录音 → 停 → 输入框出现西语转写
- [ ] Whisper 服务关掉 → 录音停止后自动降级到 Web Speech API（不卡死）
- [ ] `WHISPER_TUNNEL_URL` 未配置 → 直接走 Web Speech，控制台不报错
- [ ] 移动端 / Safari → 由于 Web Speech 兼容性差，至少 Whisper 路径在 Chrome/Edge 桌面端必须工作
- [ ] 200 / N tests 通过（新加 1-2 条覆盖：env 缺 / 隧道超时 / 隧道返回 200 三种）
- [ ] 不回归 TALK-001 / TALK-002

## 技术草图

```ts
// src/lib/talk/whisper-client.ts
export async function transcribeViaWhisperTunnel(input: {
  audioBase64: string;
  language: string;
  mimeType: string;
}): Promise<{ transcript: string; provider: "whisper" | "unavailable" }> {
  const url = process.env.WHISPER_TUNNEL_URL;
  if (!url) return { transcript: "", provider: "unavailable" };

  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), 20_000);
  try {
    const res = await fetch(`${url}/transcribe`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({
        audio_base64: input.audioBase64,
        language: input.language.split("-")[0] ?? "es",
        suffix: input.mimeType.includes("webm") ? ".webm" : ".mp3"
      }),
      signal: controller.signal
    });
    if (!res.ok) return { transcript: "", provider: "unavailable" };
    const data = await res.json() as { text?: string };
    return { transcript: data.text ?? "", provider: "whisper" };
  } catch {
    return { transcript: "", provider: "unavailable" };
  } finally {
    clearTimeout(timer);
  }
}
```

## 隐私 / 安全提示

- 当前 Whisper 隧道**没有鉴权**——任何人拿到 URL 都能 transcribe。建议 PM 在 `whisper_service.py` 加一个共享 secret：
  ```env
  WHISPER_AUTH_TOKEN="random-string"
  ```
  并让 Vercel 这边发请求时带 `Authorization: Bearer $WHISPER_AUTH_TOKEN`。但这是**可选优化**，本票不强求——临时 URL 本身就有时效性。

## 成本估计

**0.5-1 天**（API 改造 + 前端切回 MediaRecorder + 降级链路 + 测试 + 文档）

## 风险

- **隧道 URL 不稳**：cloudflared 重启换 URL → Vercel env 要同步改。PM 自己用没问题，但任何"协作场景"会断
- **延迟**：Whisper 跑在你 PC，音频要传到你家网线再回到 Vercel，延迟比纯云方案高 1-2s
- **个人电脑安全**：开放端口给公网总有风险，建议至少加 auth token
