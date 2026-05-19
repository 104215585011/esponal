# AUDIO-002 — 词语发音改为服务端 TTS（修手机版哑巴问题）

**优先级**：P1 | **负责人**：Codex1 | **日期**：2026-05-19
**触发**：PM 真机测试发现手机版（Android Chrome）LookupCard 词语🔊按钮**完全不显示**
**关联**：AUDIO-001 ✅ 结构通过，但词语发音机制本身需要改架构
**状态**：`ready_for_dev`

---

## Bug

AUDIO-001 把词语发音定为 Web Speech API（`window.speechSynthesis`）。`src/lib/speak.ts` 的 `useSpeechAvailable()` 检测浏览器是否有 `lang.startsWith("es")` 的 voice，没有就**隐藏按钮**。

桌面 Edge/Safari 自带西语 voice 所以正常。但：

- **Android Chrome 在中国地区默认不安装西语 TTS 包**
- 用户要去系统设置 → 语言 → TTS → Google → 下载西语数据，**99% 的用户不会做这个动作**
- iOS Safari 看系统语言设置，不稳定

结论：**手机版词语发音功能基本完全无法触达目标用户**。

## 决定

把词语/例句发音迁移到**服务端 msedge-tts**——和 Lectura、COURSE-001 同一条 TTS 路径。设备一致性 100%，不依赖客户端 voice 包。

Lectura 段落不动（已经是预生成 MP3）。

## 一、新建 `/api/tts` 路由

`src/app/api/tts/route.ts`：

```ts
import { NextResponse } from "next/server";
import { MsEdgeTTS, OUTPUT_FORMAT } from "msedge-tts";
import { createHash } from "node:crypto";
import { redis } from "@/lib/redis";
import { checkRateLimit, getRetryAfterSec, ttsLimiter } from "@/lib/ratelimit";

export const runtime = "nodejs";

const VOICE = "es-MX-DaliaNeural";
const MAX_LEN = 200;
const CACHE_TTL = 60 * 60 * 24 * 30; // 30 天

const CORS = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "GET, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type"
};

export async function OPTIONS() {
  return new NextResponse(null, { status: 204, headers: CORS });
}

export async function GET(request: Request) {
  const rl = await checkRateLimit(ttsLimiter, request, null);
  if (!rl.allowed) {
    return NextResponse.json(
      { error: "rate limited", retryAfterSec: getRetryAfterSec(rl.reset) },
      { status: 429, headers: { ...CORS, "Retry-After": String(getRetryAfterSec(rl.reset)) } }
    );
  }

  const text = (new URL(request.url)).searchParams.get("text")?.trim() ?? "";
  if (!text || text.length > MAX_LEN) {
    return NextResponse.json({ error: "invalid text" }, { status: 400, headers: CORS });
  }

  const hash = createHash("sha256").update(text).digest("hex").slice(0, 16);
  const cacheKey = `tts:${hash}`;

  // 1. Try Redis cache (base64)
  try {
    const cached = await redis.get(cacheKey);
    if (typeof cached === "string") {
      const buf = Buffer.from(cached, "base64");
      return new NextResponse(buf, {
        status: 200,
        headers: {
          ...CORS,
          "Content-Type": "audio/mpeg",
          "Content-Length": String(buf.length),
          "Cache-Control": "public, max-age=2592000, immutable"
        }
      });
    }
  } catch {
    // cache miss is fine
  }

  // 2. Generate with msedge-tts
  try {
    const tts = new MsEdgeTTS();
    await tts.setMetadata(VOICE, OUTPUT_FORMAT.AUDIO_24KHZ_48KBITRATE_MONO_MP3);
    const stream = tts.toStream(text);
    const chunks: Buffer[] = [];
    for await (const chunk of stream.audioStream) chunks.push(chunk);
    const buf = Buffer.concat(chunks);

    // 3. Store base64 in Redis (词典级长度合理，最大 200 chars → MP3 约几十 KB)
    redis.set(cacheKey, buf.toString("base64"), "EX", CACHE_TTL).catch(() => {});

    return new NextResponse(buf, {
      status: 200,
      headers: {
        ...CORS,
        "Content-Type": "audio/mpeg",
        "Content-Length": String(buf.length),
        "Cache-Control": "public, max-age=2592000, immutable"
      }
    });
  } catch (error) {
    console.error("TTS synth failed", error);
    return NextResponse.json({ error: "synth failed" }, { status: 500, headers: CORS });
  }
}
```

### Rate limit 新增

`src/lib/ratelimit.ts` 加：

```ts
export const ttsLimiter = createLimiter(60, "rl:tts"); // 60/min per IP，词典级别用量
```

## 二、改造 `src/lib/speak.ts`

废弃浏览器 voice 检测，改成**永远返回 true**，speak 函数改为 fetch + `<audio>` 播放：

```ts
// src/lib/speak.ts
type SpeakOptions = {
  rate?: number;
  onStart?: () => void;
  onEnd?: () => void;
};

let currentAudio: HTMLAudioElement | null = null;

export function speak(text: string, opts: SpeakOptions = {}): boolean {
  if (typeof window === "undefined" || !text.trim()) return false;

  // Stop previous if any
  if (currentAudio) {
    currentAudio.pause();
    currentAudio.currentTime = 0;
    currentAudio = null;
  }

  const audio = new Audio(`/api/tts?text=${encodeURIComponent(text)}`);
  audio.playbackRate = opts.rate ?? 1.0;
  currentAudio = audio;

  audio.addEventListener("play", () => opts.onStart?.(), { once: true });
  audio.addEventListener("ended", () => {
    if (currentAudio === audio) currentAudio = null;
    opts.onEnd?.();
  }, { once: true });
  audio.addEventListener("error", () => {
    if (currentAudio === audio) currentAudio = null;
    opts.onEnd?.();
  }, { once: true });

  audio.play().catch(() => opts.onEnd?.());
  return true;
}

// 兼容旧调用面 — 永远返回 true，不再依赖客户端 voice
export function useSpeechAvailable(): boolean {
  return true;
}
```

`useSpeechAvailable` 保留是为了让 `LookupCard.tsx` 不用改（它现在用这个 hook 决定要不要渲染按钮）。

## 三、LookupCard 不用改

由于 `useSpeechAvailable` 永远返回 true，按钮在所有设备显示。`speak()` 调用面不变。

实际效果：手机版立刻能听到了，音质和桌面 100% 一致。

## 四、Service Worker 缓存

`src/sw.ts` 的 `runtimeCaching` 加一条：

```ts
{
  urlPattern: /\/api\/tts\?text=/,
  handler: "CacheFirst",
  options: {
    cacheName: "tts-audio",
    expiration: { maxAgeSeconds: 60 * 60 * 24 * 30, maxEntries: 500 }
  }
}
```

效果：装到主屏的 PWA 用户**听过的词永久缓存在本地**，离线模式也能复听。

## 五、文件清单

**新增**：
- `src/app/api/tts/route.ts`
- `tests/audio002.test.mjs`

**修改**：
- `src/lib/speak.ts`（重写为服务端模式 + 留 `useSpeechAvailable` 永真兼容）
- `src/lib/ratelimit.ts`（加 `ttsLimiter`）
- `src/sw.ts`（加 /api/tts 缓存规则）
- `.env.example`：无需新增（msedge-tts 不需要 API key）

**LookupCard.tsx 不动**——这是本 ticket 的设计目标，调用面不变。

## 六、测试断言

- `src/app/api/tts/route.ts` 存在并 export GET + OPTIONS
- 路由含 token-less rate limit（`ttsLimiter`）+ 200 char 限制 + sha256 cacheKey
- `src/lib/speak.ts` 不再含 `window.speechSynthesis` 或 `SpeechSynthesisUtterance` 引用
- `speak()` 使用 `new Audio` + `/api/tts?text=`
- `useSpeechAvailable()` 永真返回 `true`
- `src/lib/ratelimit.ts` export `ttsLimiter`
- `src/sw.ts` runtimeCaching 含 `/api/tts` pattern

## 七、验收

1. `npm test` 通过；`npm run build` 通过
2. **桌面验证**：访问任意视频 → 点字幕词 → LookupCard 🔊 按钮 → 点 → 听到自然西语女声
3. **手机验证（关键）**：手机 Chrome 同样路径 → 听到**和桌面完全一样**的声音
4. **缓存验证**：浏览器 DevTools Network 看，第二次点同一个词，response 来自 `(memory cache)` 或 `(disk cache)` 或服务端 200 with `cached` 来源
5. **PWA 离线验证**：装到桌面 + 听过某个词 + 飞行模式 + 再点同词 → 仍能播放
6. **rate limit**：连发 70 次 → 第 61 次开始 429

## 八、不在本 ticket 范围内

- 用户自选朗读语速 UI → 留 polish
- 用户自选 voice（不同口音） → 长远 ticket，先不动
- 词库 `/vocab` 加发音按钮 → 独立 ticket（同样可以复用 `speak()`）
- 例句之外的整段朗读 → Lectura 段落已经是预生成路径，不变
- 多语言 TTS（中文翻译朗读）→ 暂不做

## 九、注意

- msedge-tts **不能并发跑**（COURSE-004 + AUDIO-001 教训），但本 API 是 per-request 同步生成，自然顺序，无并发问题
- Redis 存 base64 而不是直接存 Buffer，因为 Upstash 是字符串接口
- 一个西语单词的 MP3 通常 5-15KB，cache 500 条 ≈ 5MB，完全可控
- 不要把 `/api/tts` 加进 OPS-002 的限流——它在本 ticket 自己加专属 `ttsLimiter`
- iOS Safari 对 `Audio.play()` 有 user gesture 要求，但点按钮就是用户手势，没问题
