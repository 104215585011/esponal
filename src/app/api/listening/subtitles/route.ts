// Timestamp: 2026-11-15 15:16
import { createHash } from "node:crypto";
import { NextResponse } from "next/server";
import { getOptionalUserId } from "@/lib/api-auth";
import { isAllowedPodcastAudioUrl, type PodcastCue } from "@/lib/listening-audio";
import { readJsonCache, writeJsonCache } from "@/lib/rss-shared";
import { isConfiguredSecret } from "@/lib/talk/env";

export const runtime = "nodejs";
export const maxDuration = 60;
export const preferredRegion = "hnd1";

const DASHSCOPE_COMPAT_URL = "https://dashscope.aliyuncs.com/compatible-mode/v1/chat/completions";
const OMNI_MODEL = process.env.DASHSCOPE_OMNI_MODEL?.trim() || "qwen3-omni-flash";

// 30 秒分片大幅缩小跨洋音频传输体积（约 240~360KB），避免 Serverless 超时
const WINDOW_SEC = 30;
const DEFAULT_SLICE_BYTES = 240 * 1024;
const MAX_SLICE_BYTES = 360 * 1024;

type AudioMeta = {
  totalBytes: number;
  bytesPerSec: number;
};

function parseTotalBytesFromRange(header: string | null): number {
  if (!header) return 0;
  const m = header.match(/\/(\d+)\s*$/);
  if (!m) return 0;
  const n = Number(m[1]);
  return Number.isFinite(n) && n > 0 ? n : 0;
}

function parseCuesJson(raw: string, windowStartSec: number, windowSec: number): PodcastCue[] {
  const cleaned = raw
    .replace(/^```(?:json)?\s*/i, "")
    .replace(/\s*```$/i, "")
    .trim();
  const s = cleaned.indexOf("[");
  const e = cleaned.lastIndexOf("]");
  const slice = s >= 0 && e > s ? cleaned.slice(s, e + 1) : cleaned;

  try {
    const arr = JSON.parse(slice) as Array<{
      offsetSec?: unknown;
      start?: unknown;
      es?: unknown;
      text?: unknown;
      zh?: unknown;
    }>;
    if (!Array.isArray(arr)) return [];

    const valid = arr
      .map((item) => {
        const rel =
          typeof item.offsetSec === "number" && Number.isFinite(item.offsetSec)
            ? Math.max(0, item.offsetSec)
            : typeof item.start === "number" && Number.isFinite(item.start)
              ? Math.max(0, item.start)
              : 0;
        const text =
          typeof item.es === "string"
            ? item.es.trim()
            : typeof item.text === "string"
              ? item.text.trim()
              : "";
        const zh = typeof item.zh === "string" ? item.zh.trim() : "";
        return { rel: Math.min(rel, Math.max(0, windowSec - 1)), text, zh };
      })
      .filter((item) => item.text.length > 0);

    return valid.map((item, idx) => {
      const nextRel = valid[idx + 1]?.rel ?? windowSec;
      return {
        start: Number((windowStartSec + item.rel).toFixed(1)),
        dur: Number(Math.max(1.5, nextRel - item.rel).toFixed(1)),
        text: item.text,
        zh: item.zh
      };
    });
  } catch {
    return [];
  }
}

/**
 * POST /api/listening/subtitles
 * 拉取播客 MP3 指定 30s 时间窗切片并由 Qwen3-Omni 直接生成带时间轴的双语字幕（7 天 Redis 缓存）。
 */
export async function POST(request: Request) {
  await getOptionalUserId(request);

  const apiKey = process.env.DASHSCOPE_API_KEY?.trim();
  if (!isConfiguredSecret(apiKey) || !apiKey) {
    return NextResponse.json({ error: "subtitle_ai_unconfigured" }, { status: 503 });
  }

  let body: { audioUrl?: unknown; startSec?: unknown; durationSec?: unknown };
  try {
    body = (await request.json()) as typeof body;
  } catch {
    return NextResponse.json({ error: "invalid_json" }, { status: 400 });
  }

  const audioUrlRaw = typeof body.audioUrl === "string" ? body.audioUrl.trim() : "";
  const target = isAllowedPodcastAudioUrl(audioUrlRaw);
  if (!target) {
    return NextResponse.json({ error: "unsupported_audio_url" }, { status: 400 });
  }

  const requestedStart =
    typeof body.startSec === "number" && Number.isFinite(body.startSec)
      ? Math.max(0, Math.floor(body.startSec))
      : 0;
  const windowStartSec = Math.floor(requestedStart / WINDOW_SEC) * WINDOW_SEC;
  const durationSec =
    typeof body.durationSec === "number" && Number.isFinite(body.durationSec) && body.durationSec > 0
      ? body.durationSec
      : 1200;

  const urlHash = createHash("sha1").update(target.toString()).digest("hex").slice(0, 12);
  const cacheKey = `listening:sub:v3:${urlHash}:${windowStartSec}`;
  const cached = await readJsonCache<PodcastCue[]>(cacheKey);
  if (cached && cached.length > 0) {
    return NextResponse.json({
      cues: cached,
      windowStartSec,
      windowEndSec: windowStartSec + WINDOW_SEC,
      cached: true
    });
  }

  const metaKey = `listening:meta:v1:${urlHash}`;
  const cachedMeta = await readJsonCache<AudioMeta>(metaKey);
  const totalBytes = cachedMeta?.totalBytes ?? 0;
  const bytesPerSec = cachedMeta?.bytesPerSec ?? 12_000;

  const startByte = windowStartSec === 0 ? 0 : Math.floor(windowStartSec * bytesPerSec);
  const sliceLen = Math.min(MAX_SLICE_BYTES, Math.max(DEFAULT_SLICE_BYTES, bytesPerSec * WINDOW_SEC));
  const endByte =
    totalBytes > 0 ? Math.min(totalBytes - 1, startByte + sliceLen) : startByte + sliceLen;

  if (totalBytes > 0 && startByte >= totalBytes) {
    return NextResponse.json({ cues: [], windowStartSec, windowEndSec: windowStartSec });
  }

  let sliceRes: Response;
  try {
    sliceRes = await fetch(target.toString(), {
      headers: {
        Range: `bytes=${startByte}-${endByte}`,
        "User-Agent": "EsponalPodcastProxy/1.0 (+https://www.pcmuz.cn)"
      },
      redirect: "follow",
      signal: AbortSignal.timeout(12_000)
    });
  } catch (err) {
    return NextResponse.json(
      { error: "audio_fetch_timeout", detail: err instanceof Error ? err.message : "timeout" },
      { status: 504 }
    );
  }

  if (!sliceRes.ok && sliceRes.status !== 206) {
    return NextResponse.json(
      { error: "audio_slice_failed", status: sliceRes.status },
      { status: 502 }
    );
  }

  const detectedTotal = parseTotalBytesFromRange(sliceRes.headers.get("content-range"));
  const effectiveTotal = detectedTotal || totalBytes;
  const effectiveBps =
    effectiveTotal > 0 && durationSec > 0
      ? Math.max(8_000, Math.min(48_000, Math.round(effectiveTotal / durationSec)))
      : bytesPerSec;
  if (detectedTotal > 0 && !cachedMeta) {
    void writeJsonCache(metaKey, { totalBytes: detectedTotal, bytesPerSec: effectiveBps }, 7 * 24 * 3600);
  }

  let mp3Buf: Buffer;
  try {
    mp3Buf = Buffer.from(await sliceRes.arrayBuffer());
  } catch (err) {
    return NextResponse.json(
      { error: "audio_read_failed", detail: err instanceof Error ? err.message : "read_error" },
      { status: 502 }
    );
  }

  if (mp3Buf.length < 4000) {
    return NextResponse.json({ cues: [], windowStartSec, windowEndSec: windowStartSec });
  }

  const actualWindowSec = Math.max(15, Math.min(40, Math.round(mp3Buf.length / effectiveBps)));

  let aiRes: Response;
  try {
    aiRes = await fetch(DASHSCOPE_COMPAT_URL, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${apiKey}`,
        "Content-Type": "application/json"
      },
      body: JSON.stringify({
        model: OMNI_MODEL,
        modalities: ["text"],
        stream: true,
        max_tokens: 900,
        messages: [
          {
            role: "system",
            content: `Transcribe this ~${actualWindowSec}s Spanish podcast excerpt into 4-8 chronological cues paired with natural Simplified Chinese translations. Output ONLY a JSON array: [{"offsetSec":0,"es":"...","zh":"..."}].`
          },
          {
            role: "user",
            content: [
              {
                type: "input_audio",
                input_audio: {
                  data: `data:;base64,${mp3Buf.toString("base64")}`,
                  format: "mp3"
                }
              }
            ]
          }
        ]
      }),
      signal: AbortSignal.timeout(48_000)
    });
  } catch (err) {
    return NextResponse.json(
      { error: "subtitle_ai_timeout", detail: err instanceof Error ? err.message : "timeout" },
      { status: 504 }
    );
  }

  if (!aiRes.ok) {
    const err = await aiRes.text().catch(() => "");
    return NextResponse.json(
      { error: "subtitle_generation_failed", detail: err.slice(0, 120) },
      { status: 502 }
    );
  }

  const sse = await aiRes.text();
  let txt = "";
  for (const line of sse.split(/\r?\n/)) {
    if (!line.startsWith("data: ") || line.includes("[DONE]")) continue;
    try {
      txt += JSON.parse(line.slice(6)).choices?.[0]?.delta?.content ?? "";
    } catch {
      // ignore
    }
  }

  const cues = parseCuesJson(txt, windowStartSec, actualWindowSec);
  if (cues.length > 0) {
    await writeJsonCache(cacheKey, cues, 7 * 24 * 3600);
  }

  return NextResponse.json({
    cues,
    windowStartSec,
    windowEndSec: windowStartSec + actualWindowSec,
    cached: false
  });
}
