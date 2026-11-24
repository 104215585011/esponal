// Timestamp: 2026-11-24 10:15
/**
 * 轻量级本地 YouTube 字幕中转服务（零第三方依赖，配合 Cloudflare Tunnel 给 Vercel 后端用）。
 *
 * 启动方式：
 *   node scripts/subtitle-relay-server.mjs
 *
 * 可选参数 / 环境变量：
 *   SUBTITLE_RELAY_PORT / --port   监听端口（默认 8787，仅绑定 127.0.0.1）
 *   SUBTITLE_RELAY_TOKEN / --token 鉴权密钥（未指定时自动生成并保存到 .cache/subtitle-relay-token.txt）
 */

import http from "node:http";
import crypto from "node:crypto";
import fs from "node:fs";
import path from "node:path";

const DEFAULT_HOST = "127.0.0.1";
const DEFAULT_PORT = 8787;
const TOKEN_FILE = path.join(process.cwd(), ".cache", "subtitle-relay-token.txt");

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
];

function parseCliArgs(argv) {
  const result = {};
  for (let i = 0; i < argv.length; i += 1) {
    const arg = argv[i];
    if (arg === "--port" && argv[i + 1]) {
      result.port = Number.parseInt(argv[i + 1], 10);
      i += 1;
    } else if (arg === "--token" && argv[i + 1]) {
      result.token = argv[i + 1].trim();
      i += 1;
    } else if (arg === "--host" && argv[i + 1]) {
      result.host = argv[i + 1].trim();
      i += 1;
    }
  }
  return result;
}

function loadOrCreateToken(explicitToken) {
  if (explicitToken) return explicitToken;
  if (process.env.SUBTITLE_RELAY_TOKEN?.trim()) {
    return process.env.SUBTITLE_RELAY_TOKEN.trim();
  }
  try {
    if (fs.existsSync(TOKEN_FILE)) {
      const existing = fs.readFileSync(TOKEN_FILE, "utf8").trim();
      if (existing.length >= 16) return existing;
    }
  } catch {
    // ignore read failure and generate fresh token
  }
  const generated = crypto.randomBytes(24).toString("hex");
  try {
    fs.mkdirSync(path.dirname(TOKEN_FILE), { recursive: true });
    fs.writeFileSync(TOKEN_FILE, `${generated}\n`, { encoding: "utf8", mode: 0o600 });
  } catch {
    // ignore write failure
  }
  return generated;
}

function constantTimeEqual(a, b) {
  const bufA = Buffer.from(a);
  const bufB = Buffer.from(b);
  if (bufA.length !== bufB.length) return false;
  return crypto.timingSafeEqual(bufA, bufB);
}

function decodeXmlEntities(raw) {
  return raw
    .replace(/&amp;/g, "&")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/&apos;/g, "'")
    .replace(/&#x([0-9a-fA-F]+);/g, (_, hex) => {
      const n = Number.parseInt(hex, 16);
      return Number.isFinite(n) ? String.fromCodePoint(n) : _;
    })
    .replace(/&#(\d+);/g, (_, code) => {
      const n = Number.parseInt(code, 10);
      return Number.isFinite(n) ? String.fromCodePoint(n) : _;
    });
}

function stripTagsAndNormalize(raw) {
  return decodeXmlEntities(raw.replace(/<[^>]+>/g, ""))
    .replace(/\s+/g, " ")
    .trim();
}

function clampOverlappingCues(cues) {
  const sorted = [...cues]
    .filter((cue) => Number.isFinite(cue.start) && Number.isFinite(cue.dur) && cue.dur > 0)
    .sort((a, b) => a.start - b.start);

  for (let i = 0; i < sorted.length - 1; i += 1) {
    const nextStart = sorted[i + 1].start;
    const end = sorted[i].start + sorted[i].dur;
    if (end > nextStart) {
      sorted[i] = { ...sorted[i], dur: Math.max(0.05, nextStart - sorted[i].start) };
    }
  }
  return sorted;
}

function parseTimedTextXml(xml) {
  if (!xml) return [];
  const cues = [];

  for (const match of xml.matchAll(/<p\s+([^>]*?)>([\s\S]*?)<\/p>/g)) {
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

  if (cues.length > 0) return clampOverlappingCues(cues);

  for (const match of xml.matchAll(/<text\s+([^>]*?)>([\s\S]*?)<\/text>/g)) {
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

function pickPreferredCaptionTrack(tracks, lang) {
  const baseLang = (lang || "es").trim().toLowerCase().split(/[-_]/)[0] || "es";
  const matching = tracks.filter((track) => {
    const lc = (track.languageCode ?? "").toLowerCase();
    return Boolean(track.baseUrl) && (lc === baseLang || lc.startsWith(`${baseLang}-`));
  });
  if (matching.length === 0) return null;

  return (
    matching.find((t) => t.kind !== "asr" && (t.languageCode ?? "").toLowerCase() === baseLang) ??
    matching.find((t) => t.kind !== "asr") ??
    matching.find((t) => (t.languageCode ?? "").toLowerCase() === baseLang) ??
    matching[0]
  );
}

async function fetchYouTubeDirect(videoId, lang) {
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
        signal: AbortSignal.timeout(10000)
      });

      if (!playerRes.ok) continue;

      const payload = await playerRes.json();
      const tracks = payload?.captions?.playerCaptionsTracklistRenderer?.captionTracks ?? [];
      const chosen = pickPreferredCaptionTrack(tracks, lang);
      if (!chosen?.baseUrl) {
        if (tracks.length > 0) {
          return { cues: [], trackLang: null, kind: null };
        }
        continue;
      }

      const capRes = await fetch(chosen.baseUrl, {
        headers: { "User-Agent": profile.userAgent },
        signal: AbortSignal.timeout(10000)
      });
      if (!capRes.ok) continue;

      const xml = await capRes.text();
      const cues = parseTimedTextXml(xml);
      if (cues.length > 0) {
        return {
          cues,
          trackLang: chosen.languageCode ?? lang,
          kind: chosen.kind === "asr" ? "asr" : "manual"
        };
      }
    } catch {
      // try next InnerTube client
    }
  }

  return { cues: [], trackLang: null, kind: null };
}

function sendJson(res, status, data) {
  const body = JSON.stringify(data);
  res.writeHead(status, {
    "Content-Type": "application/json; charset=utf-8",
    "Cache-Control": "no-store"
  });
  res.end(body);
}

export function createRelayServer({ token }) {
  return http.createServer(async (req, res) => {
    const reqUrl = new URL(req.url || "/", "http://127.0.0.1");

    if (req.method === "GET" && reqUrl.pathname === "/health") {
      sendJson(res, 200, { ok: true, service: "esponal-subtitle-relay" });
      return;
    }

    if (req.method !== "GET" || reqUrl.pathname !== "/subtitle") {
      sendJson(res, 404, { error: "not_found" });
      return;
    }

    const authHeader = req.headers.authorization || "";
    const bearer = authHeader.startsWith("Bearer ") ? authHeader.slice(7).trim() : "";
    const headerToken = typeof req.headers["x-relay-token"] === "string"
      ? req.headers["x-relay-token"].trim()
      : "";
    const supplied = bearer || headerToken;

    if (!supplied || !constantTimeEqual(supplied, token)) {
      sendJson(res, 401, { error: "unauthorized" });
      return;
    }

    const videoId = (reqUrl.searchParams.get("v") || "").trim();
    const lang = (reqUrl.searchParams.get("lang") || "es").trim();

    if (!/^[\w-]{1,32}$/.test(videoId) || !/^[a-z]{2}(?:-[A-Za-z0-9]+)?$/i.test(lang)) {
      sendJson(res, 400, { error: "invalid_params" });
      return;
    }

    const startedAt = Date.now();
    const result = await fetchYouTubeDirect(videoId, lang);
    const ms = Date.now() - startedAt;
    const now = new Date().toTimeString().slice(0, 8);
    console.log(
      `[${now}] ${videoId} (${lang}) -> ${result.cues.length} cues (${result.kind ?? "none"}) in ${ms}ms`
    );

    sendJson(res, 200, {
      cues: result.cues,
      count: result.cues.length,
      trackLang: result.trackLang,
      kind: result.kind
    });
  });
}

const isMain = process.argv[1] && path.resolve(process.argv[1]) === path.resolve(new URL(import.meta.url).pathname.replace(/^\/([A-Za-z]:)/, "$1"));

if (isMain) {
  const cli = parseCliArgs(process.argv.slice(2));
  const host = cli.host || process.env.SUBTITLE_RELAY_HOST || DEFAULT_HOST;
  const port = Number.isFinite(cli.port)
    ? cli.port
    : Number.parseInt(process.env.SUBTITLE_RELAY_PORT || String(DEFAULT_PORT), 10);
  const token = loadOrCreateToken(cli.token);

  const server = createRelayServer({ token });
  server.listen(port, host, () => {
    console.log("==========================================================");
    console.log(`Esponal 本地字幕中转服务已启动: http://${host}:${port}`);
    console.log(`健康检查: http://${host}:${port}/health`);
    console.log(`鉴权密钥 (YOUTUBE_SUBTITLE_RELAY_TOKEN):`);
    console.log(`  ${token}`);
    console.log("==========================================================");
    console.log("接下来在另一个终端运行 Cloudflare Tunnel 即可暴露给 Vercel:");
    console.log(`  cloudflared tunnel --url http://${host}:${port}`);
    console.log("==========================================================");
  });
}
