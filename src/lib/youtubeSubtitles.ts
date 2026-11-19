// Timestamp: 2026-11-19 17:10
import type { Cue } from "@/api/watch";

type InnerTubeCaptionTrack = {
  baseUrl?: string;
  languageCode?: string;
  kind?: string;
  vssId?: string;
};

type InnerTubePlayerResponse = {
  playabilityStatus?: {
    status?: string;
  };
  captions?: {
    playerCaptionsTracklistRenderer?: {
      captionTracks?: InnerTubeCaptionTrack[];
    };
  };
};

export type DirectSubtitleResult = {
  cues: Cue[];
  reachable: boolean;
  hasAnyTracks: boolean;
};

const INNERTUBE_CLIENTS = [
  {
    userAgent: "com.google.android.youtube/20.10.38 (Linux; U; Android 14)",
    client: {
      clientName: "ANDROID",
      clientVersion: "20.10.38",
      androidSdkVersion: 34
    }
  },
  {
    userAgent: "com.google.ios.youtube/20.10.4 (iPhone16,2; U; CPU iOS 18_3 like Mac OS X)",
    client: {
      clientName: "IOS",
      clientVersion: "20.10.4"
    }
  }
] as const;

function decodeXmlEntities(raw: string): string {
  return raw
    .replace(/&amp;/g, "&")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/&apos;/g, "'")
    .replace(/&#x([0-9a-fA-F]+);/g, (_, hex: string) => {
      const n = Number.parseInt(hex, 16);
      return Number.isFinite(n) ? String.fromCodePoint(n) : _;
    })
    .replace(/&#(\d+);/g, (_, code: string) => {
      const n = Number.parseInt(code, 10);
      return Number.isFinite(n) ? String.fromCodePoint(n) : _;
    });
}

function stripTagsAndNormalize(raw: string): string {
  return decodeXmlEntities(raw.replace(/<[^>]+>/g, ""))
    .replace(/\s+/g, " ")
    .trim();
}

export function clampOverlappingCues(cues: Cue[]): Cue[] {
  const sorted = [...cues]
    .filter((cue) => Number.isFinite(cue.start) && Number.isFinite(cue.dur) && cue.dur > 0)
    .sort((a, b) => a.start - b.start);

  for (let i = 0; i < sorted.length - 1; i += 1) {
    const nextStart = sorted[i + 1].start;
    const end = sorted[i].start + sorted[i].dur;
    if (end > nextStart) {
      const clampedDur = Math.max(0.05, nextStart - sorted[i].start);
      sorted[i] = { ...sorted[i], dur: clampedDur };
    }
  }

  return sorted;
}

export function parseTimedTextXml(xml: string): Cue[] {
  if (!xml) return [];
  const cues: Cue[] = [];

  // Format 3: <p t="3700" d="1710"><s>...</s></p>
  const pRegex = /<p\s+([^>]*?)>([\s\S]*?)<\/p>/g;
  let match: RegExpExecArray | null = null;
  while ((match = pRegex.exec(xml)) !== null) {
    const attrs = match[1] ?? "";
    const inner = match[2] ?? "";
    const tMatch = /\bt="(\d+(?:\.\d+)?)"/.exec(attrs);
    if (!tMatch) continue;
    const dMatch = /\bd="(\d+(?:\.\d+)?)"/.exec(attrs);
    const start = Number.parseFloat(tMatch[1]) / 1000;
    const dur = dMatch ? Number.parseFloat(dMatch[1]) / 1000 : 2.5;
    const text = stripTagsAndNormalize(inner);
    if (text && Number.isFinite(start) && Number.isFinite(dur) && dur > 0) {
      cues.push({ start, dur, text });
    }
  }

  if (cues.length > 0) {
    return clampOverlappingCues(cues);
  }

  // Legacy timedtext XML: <text start="3.7" dur="1.71">...</text>
  const textRegex = /<text\s+([^>]*?)>([\s\S]*?)<\/text>/g;
  while ((match = textRegex.exec(xml)) !== null) {
    const attrs = match[1] ?? "";
    const inner = match[2] ?? "";
    const startMatch = /\bstart="(\d+(?:\.\d+)?)"/.exec(attrs);
    if (!startMatch) continue;
    const durMatch = /\bdur="(\d+(?:\.\d+)?)"/.exec(attrs);
    const start = Number.parseFloat(startMatch[1]);
    const dur = durMatch ? Number.parseFloat(durMatch[1]) : 2.5;
    const text = stripTagsAndNormalize(inner);
    if (text && Number.isFinite(start) && Number.isFinite(dur) && dur > 0) {
      cues.push({ start, dur, text });
    }
  }

  return clampOverlappingCues(cues);
}

export function pickPreferredCaptionTrack(
  tracks: InnerTubeCaptionTrack[],
  lang: string
): InnerTubeCaptionTrack | null {
  const baseLang = (lang || "es").trim().toLowerCase().split(/[-_]/)[0] || "es";
  const matching = tracks.filter((track) => {
    const lc = (track.languageCode ?? "").toLowerCase();
    return Boolean(track.baseUrl) && (lc === baseLang || lc.startsWith(`${baseLang}-`));
  });
  if (matching.length === 0) return null;

  const manualExact = matching.find(
    (t) => t.kind !== "asr" && (t.languageCode ?? "").toLowerCase() === baseLang
  );
  if (manualExact) return manualExact;

  const manualRegional = matching.find((t) => t.kind !== "asr");
  if (manualRegional) return manualRegional;

  const asrExact = matching.find((t) => (t.languageCode ?? "").toLowerCase() === baseLang);
  return asrExact ?? matching[0];
}

async function fetchWithTimeout(
  url: string,
  init: RequestInit,
  timeoutMs = 10_000
): Promise<Response> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);
  try {
    return await fetch(url, { ...init, signal: controller.signal });
  } finally {
    clearTimeout(timer);
  }
}

/**
 * 手机端直连 YouTube InnerTube 拉取公开字幕（走用户自身网络，不受服务端机房 IP 封锁，0 付费配额）。
 * 先尝试 ANDROID 客户端，若未返回轨列表再尝试 IOS 客户端。
 */
export async function fetchYouTubeSubtitlesDirect(
  videoId: string,
  lang = "es"
): Promise<DirectSubtitleResult> {
  const cleanId = videoId.trim();
  if (!cleanId) {
    return { cues: [], reachable: false, hasAnyTracks: false };
  }

  const hl = (lang || "es").trim().toLowerCase().split(/[-_]/)[0] || "es";
  let reachable = false;
  let hasAnyTracks = false;

  for (const profile of INNERTUBE_CLIENTS) {
    try {
      const playerRes = await fetchWithTimeout(
        "https://www.youtube.com/youtubei/v1/player?prettyPrint=false",
        {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            "User-Agent": profile.userAgent
          },
          body: JSON.stringify({
            context: {
              client: {
                ...profile.client,
                hl,
                gl: "US"
              }
            },
            videoId: cleanId
          })
        },
        10_000
      );

      if (!playerRes.ok) {
        continue;
      }

      reachable = true;
      const payload = (await playerRes.json()) as InnerTubePlayerResponse;
      const tracks = payload.captions?.playerCaptionsTracklistRenderer?.captionTracks ?? [];
      if (tracks.length > 0) {
        hasAnyTracks = true;
      }

      const chosen = pickPreferredCaptionTrack(tracks, lang);
      if (!chosen?.baseUrl) {
        if (tracks.length > 0) {
          // 已经拿到了完整字幕轨清单但确实不含目标语种，无需再试下一个客户端
          return { cues: [], reachable: true, hasAnyTracks: true };
        }
        continue;
      }

      const capRes = await fetchWithTimeout(
        chosen.baseUrl,
        {
          method: "GET",
          headers: {
            "User-Agent": profile.userAgent
          }
        },
        10_000
      );
      if (!capRes.ok) {
        continue;
      }

      const xml = await capRes.text();
      const cues = parseTimedTextXml(xml);
      if (cues.length > 0) {
        return { cues, reachable: true, hasAnyTracks: true };
      }
    } catch {
      // 网络波动或超时，继续尝试下一个 profile
    }
  }

  return { cues: [], reachable, hasAnyTracks };
}
