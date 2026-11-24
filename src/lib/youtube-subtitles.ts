// Timestamp: 2026-11-24 10:15
export type YouTubeSubtitleCue = {
  start: number;
  dur: number;
  text: string;
};

type InnerTubeCaptionTrack = {
  baseUrl?: string;
  languageCode?: string;
  kind?: string;
  vssId?: string;
};

type InnerTubePlayerResponse = {
  captions?: {
    playerCaptionsTracklistRenderer?: {
      captionTracks?: InnerTubeCaptionTrack[];
    };
  };
};

function decodeXmlEntities(raw: string): string {
  return raw
    .replace(/&amp;/g, "&")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/&apos;/g, "'")
    .replace(/&#(\d+);/g, (_, code) => {
      const n = Number.parseInt(code, 10);
      return Number.isFinite(n) ? String.fromCodePoint(n) : _;
    });
}

function stripTagsAndNormalize(raw: string): string {
  return decodeXmlEntities(raw.replace(/<[^>]+>/g, ""))
    .replace(/\s+/g, " ")
    .trim();
}

export function parseTimedTextXml(xml: string): YouTubeSubtitleCue[] {
  if (!xml) return [];
  const cues: YouTubeSubtitleCue[] = [];

  // Format 3: <p t="3700" d="1710"><s>...</s></p>
  const pMatches = xml.matchAll(/<p\s+([^>]*?)>([\s\S]*?)<\/p>/g);
  for (const match of pMatches) {
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
    return cues;
  }

  // Legacy timedtext XML: <text start="3.7" dur="1.71">...</text>
  const textMatches = xml.matchAll(/<text\s+([^>]*?)>([\s\S]*?)<\/text>/g);
  for (const match of textMatches) {
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

  return cues;
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

function sanitizeRelayCues(raw: unknown): YouTubeSubtitleCue[] {
  if (!Array.isArray(raw)) return [];
  const cues: YouTubeSubtitleCue[] = [];
  for (const item of raw) {
    if (!item || typeof item !== "object") continue;
    const candidate = item as { start?: unknown; dur?: unknown; text?: unknown };
    const start = Number(candidate.start);
    const dur = Number(candidate.dur);
    const text = typeof candidate.text === "string" ? candidate.text.trim() : "";
    if (text && Number.isFinite(start) && Number.isFinite(dur) && start >= 0 && dur > 0) {
      cues.push({ start, dur, text });
    }
  }
  return cues;
}

/**
 * 可选自建中转（如家里电脑 + Cloudflare Tunnel）拉取 YouTube InnerTube 字幕。
 * 只要配置了 YOUTUBE_SUBTITLE_RELAY_URL 就优先走中转；电脑关机或超时时静默回退。
 */
async function fetchYouTubeSubtitlesViaRelay(
  videoId: string,
  lang: string
): Promise<YouTubeSubtitleCue[]> {
  const relayBase = process.env.YOUTUBE_SUBTITLE_RELAY_URL?.trim();
  if (!relayBase) return [];

  const token = process.env.YOUTUBE_SUBTITLE_RELAY_TOKEN?.trim();
  try {
    const url = new URL("/subtitle", relayBase.endsWith("/") ? relayBase : `${relayBase}/`);
    url.searchParams.set("v", videoId);
    url.searchParams.set("lang", lang);

    const headers: Record<string, string> = { Accept: "application/json" };
    if (token) {
      headers.Authorization = `Bearer ${token}`;
    }

    const res = await fetch(url, {
      method: "GET",
      headers,
      cache: "no-store",
      signal: AbortSignal.timeout(12000)
    });

    if (!res.ok) {
      console.warn("[subtitle] Relay request failed:", res.status);
      return [];
    }

    const payload = (await res.json()) as { cues?: unknown };
    const cues = sanitizeRelayCues(payload?.cues);
    if (cues.length > 0) {
      console.log("[subtitle] Relay fetched", cues.length, "cues for", videoId, lang);
    }
    return cues;
  } catch (error) {
    console.warn(
      "[subtitle] Relay unavailable, falling back:",
      error instanceof Error ? error.message : String(error)
    );
    return [];
  }
}

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

/**
 * 通过 YouTube InnerTube player 接口抓取公开原声字幕轨（优先人工字幕，其次 ASR）。
 * 若配置了 YOUTUBE_SUBTITLE_RELAY_URL，优先通过自建中转抓取（绕开云机房 IP 封锁）。
 * 零付费配额消耗，用于在 Supadata 不可用或配额耗尽时保证视频字幕稳定可用。
 */
export async function fetchYouTubeInnerTubeSubtitles(
  videoId: string,
  lang = "es"
): Promise<YouTubeSubtitleCue[]> {
  if (!videoId) return [];

  const relayCues = await fetchYouTubeSubtitlesViaRelay(videoId, lang);
  if (relayCues.length > 0) {
    return relayCues;
  }

  const hl = (lang || "es").trim().toLowerCase().split(/[-_]/)[0] || "es";

  for (const profile of INNERTUBE_CLIENTS) {
    try {
      const playerRes = await fetch("https://www.youtube.com/youtubei/v1/player?prettyPrint=false", {
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
          videoId
        }),
        cache: "no-store",
        signal: AbortSignal.timeout(12000)
      });

      if (!playerRes.ok) {
        continue;
      }

      const payload = (await playerRes.json()) as InnerTubePlayerResponse;
      const tracks = payload.captions?.playerCaptionsTracklistRenderer?.captionTracks ?? [];
      const chosen = pickPreferredCaptionTrack(tracks, lang);
      if (!chosen?.baseUrl) {
        if (tracks.length > 0) {
          return [];
        }
        continue;
      }

      const capRes = await fetch(chosen.baseUrl, {
        headers: {
          "User-Agent": profile.userAgent
        },
        cache: "no-store",
        signal: AbortSignal.timeout(12000)
      });
      if (!capRes.ok) {
        continue;
      }

      const xml = await capRes.text();
      const cues = parseTimedTextXml(xml);
      if (cues.length > 0) {
        return cues;
      }
    } catch {
      // 网络波动或机房被拒，尝试下一个客户端
    }
  }

  return [];
}
