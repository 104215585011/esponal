// Timestamp: 2026-11-18 10:02
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

/**
 * 通过 YouTube InnerTube ANDROID player 接口抓取公开原声字幕轨（优先人工字幕，其次 ASR）。
 * 零付费配额消耗，用于在 Supadata 不可用或配额耗尽时保证视频字幕稳定可用。
 */
export async function fetchYouTubeInnerTubeSubtitles(
  videoId: string,
  lang = "es"
): Promise<YouTubeSubtitleCue[]> {
  if (!videoId) return [];
  const hl = (lang || "es").trim().toLowerCase().split(/[-_]/)[0] || "es";

  try {
    const playerRes = await fetch("https://www.youtube.com/youtubei/v1/player?prettyPrint=false", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "User-Agent": "com.google.android.youtube/20.10.38 (Linux; U; Android 14)"
      },
      body: JSON.stringify({
        context: {
          client: {
            clientName: "ANDROID",
            clientVersion: "20.10.38",
            androidSdkVersion: 34,
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
      return [];
    }

    const payload = (await playerRes.json()) as InnerTubePlayerResponse;
    const tracks = payload.captions?.playerCaptionsTracklistRenderer?.captionTracks ?? [];
    const chosen = pickPreferredCaptionTrack(tracks, lang);
    if (!chosen?.baseUrl) {
      return [];
    }

    const capRes = await fetch(chosen.baseUrl, {
      headers: {
        "User-Agent": "com.google.android.youtube/20.10.38 (Linux; U; Android 14)"
      },
      cache: "no-store",
      signal: AbortSignal.timeout(12000)
    });
    if (!capRes.ok) {
      return [];
    }

    const xml = await capRes.text();
    return parseTimedTextXml(xml);
  } catch {
    return [];
  }
}
