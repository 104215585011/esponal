// Timestamp: 2026-11-18 10:18
/**
 * 西语共享视频库批量采集与字幕预检脚本。
 *
 * 从 `SPANISH_CURATED_SOURCES`（既有 3 频道 + 精选历史播放列表 + 新增日常/旅行/美食频道 + 人工精选单条视频）
 * 抓取候选视频，按 videoId 去重后逐条检查真实西语原文字幕，
 * 仅将 `subtitleStatus === "ready"` 且通过西语对白检验的视频写入 `src/data/spanish-video-catalog.json`
 * 并可选同步入 Postgres `video_catalog` 表。
 *
 * 用法：
 *   node scripts/ingest-spanish-videos.mjs --verify-url=https://www.pcmuz.cn/api/subtitle --sync-db
 */
import fs from "node:fs";
import path from "node:path";
import { SPANISH_CURATED_SOURCES } from "../src/lib/channels.ts";
import {
  analyzeSpanishSubtitleCues,
  assessSpanishVideoLevel,
  inferSpanishVideoTopic
} from "../src/lib/video-catalog.ts";
import { parseIsoDurationSeconds } from "../src/lib/video-pool-logic.ts";
import { fetchYouTubeInnerTubeSubtitles } from "../src/lib/youtube-subtitles.ts";

// 加载 .env
const envPath = path.join(process.cwd(), ".env");
if (fs.existsSync(envPath)) {
  for (const line of fs.readFileSync(envPath, "utf8").split(/\r?\n/)) {
    const m = /^([A-Z0-9_]+)="?([^"\r\n]*)"?$/.exec(line.trim());
    if (m && !process.env[m[1]]) process.env[m[1]] = m[2];
  }
}

const args = process.argv.slice(2);
const verifyUrlArg = args.find((a) => a.startsWith("--verify-url="))?.split("=")[1] || "";
const syncDb = args.includes("--sync-db");
const limitArg = Number(args.find((a) => a.startsWith("--limit="))?.split("=")[1] || "120");
const targetCount = Number(args.find((a) => a.startsWith("--target="))?.split("=")[1] || "85");

const MANUAL_CURATED_PICKS = [
  {
    videoId: "q48w51isHHc",
    sourceType: "curated",
    sourceId: "manual-es-picks",
    sourceLabel: "编辑精选 · 零基础入门",
    hintTopic: "慢速对话",
    hintLevel: "A1"
  },
  {
    videoId: "KvSxhLryGP0",
    sourceType: "curated",
    sourceId: "manual-es-picks",
    sourceLabel: "编辑精选 · 文化节日",
    hintTopic: "文化故事",
    hintLevel: "A1"
  },
  {
    videoId: "L4NhZKk1MPk",
    sourceType: "curated",
    sourceId: "manual-es-picks",
    sourceLabel: "编辑精选 · 慢速故事",
    hintTopic: "旅行探索",
    hintLevel: "A2"
  },
  {
    videoId: "12bbekXC7Zo",
    sourceType: "curated",
    sourceId: "manual-es-picks",
    sourceLabel: "编辑精选 · 文化地理",
    hintTopic: "文化故事",
    hintLevel: "A2"
  },
  {
    videoId: "HRH4jVhtfPc",
    sourceType: "curated",
    sourceId: "manual-es-picks",
    sourceLabel: "编辑精选 · 校园日常",
    hintTopic: "日常生活",
    hintLevel: "A2"
  },
  {
    videoId: "sh-K-uiJV8s",
    sourceType: "curated",
    sourceId: "manual-es-picks",
    sourceLabel: "编辑精选 · 长对话播客",
    hintTopic: "慢速对话",
    hintLevel: "B1"
  }
];

const ytKey = process.env.YOUTUBE_API_KEY?.trim();
if (!ytKey) {
  throw new Error("Missing YOUTUBE_API_KEY");
}

async function yt(endpoint, params) {
  const url = new URL(`https://www.googleapis.com/youtube/v3/${endpoint}`);
  url.searchParams.set("key", ytKey);
  for (const [k, v] of Object.entries(params)) url.searchParams.set(k, String(v));
  const res = await fetch(url);
  if (!res.ok) throw new Error(`${endpoint} ${res.status}: ${await res.text()}`);
  return res.json();
}

const byVideo = new Map();

// 1. 拉取手工挑选的单条视频元数据
{
  const manualIds = MANUAL_CURATED_PICKS.map((p) => p.videoId);
  const vRes = await yt("videos", { part: "snippet,contentDetails,status", id: manualIds.join(",") });
  for (const item of vRes.items ?? []) {
    const pick = MANUAL_CURATED_PICKS.find((p) => p.videoId === item.id);
    if (!pick || item.status?.embeddable === false) continue;
    byVideo.set(item.id, {
      videoId: item.id,
      sourceType: pick.sourceType,
      sourceId: pick.sourceId,
      sourceLabel: pick.sourceLabel,
      channelId: item.snippet?.channelId ?? "",
      channelTitle: item.snippet?.channelTitle ?? "",
      title: item.snippet?.title ?? "",
      thumbnail:
        item.snippet?.thumbnails?.high?.url ||
        item.snippet?.thumbnails?.medium?.url ||
        `https://i.ytimg.com/vi/${item.id}/hqdefault.jpg`,
      publishedAt: item.snippet?.publishedAt ?? "",
      duration: item.contentDetails?.duration ?? "",
      embeddable: true,
      hintTopic: pick.hintTopic,
      hintLevel: pick.hintLevel
    });
  }
}

// 2. 拉取精选播放列表与扩展频道
for (const src of SPANISH_CURATED_SOURCES) {
  const pid = src.playlistId || src.sourceId;
  try {
    const res = await yt("playlistItems", { part: "snippet", playlistId: pid, maxResults: src.take });
    for (const item of res.items ?? []) {
      const sn = item.snippet;
      const vid = sn?.resourceId?.videoId;
      if (!vid || byVideo.has(vid)) continue;
      if (sn.title === "Private video" || sn.title === "Deleted video") continue;
      byVideo.set(vid, {
        videoId: vid,
        sourceType: src.sourceType,
        sourceId: src.sourceId,
        sourceLabel: src.label,
        channelId: sn.videoOwnerChannelId || src.channelId,
        channelTitle: sn.videoOwnerChannelTitle || src.channelTitle,
        title: sn.title,
        thumbnail:
          sn.thumbnails?.high?.url ||
          sn.thumbnails?.medium?.url ||
          `https://i.ytimg.com/vi/${vid}/hqdefault.jpg`,
        publishedAt: sn.publishedAt || "",
        hintTopic: src.hintTopic,
        hintLevel: src.hintLevel
      });
    }
  } catch (err) {
    console.warn("Source skipped:", src.label, err instanceof Error ? err.message : err);
  }
}

const needDurationIds = Array.from(byVideo.values())
  .filter((v) => !v.duration)
  .map((v) => v.videoId);
for (let i = 0; i < needDurationIds.length; i += 50) {
  const chunk = needDurationIds.slice(i, i + 50);
  const vRes = await yt("videos", { part: "contentDetails,status", id: chunk.join(",") });
  for (const v of vRes.items ?? []) {
    const rec = byVideo.get(v.id);
    if (!rec) continue;
    rec.duration = v.contentDetails?.duration ?? "";
    rec.embeddable = v.status?.embeddable ?? true;
  }
}

// 按频道均衡抽样候选集
const channelBuckets = new Map();
for (const v of byVideo.values()) {
  if (v.embeddable === false) continue;
  const durSec = parseIsoDurationSeconds(v.duration ?? "");
  if (durSec < 35 || durSec > 2400) continue;
  const list = channelBuckets.get(v.channelId) ?? [];
  list.push({ ...v, durationSec: durSec });
  channelBuckets.set(v.channelId, list);
}

const candidates = [];
const cursors = new Map();
let added = true;
while (added && candidates.length < limitArg) {
  added = false;
  for (const [cid, list] of channelBuckets.entries()) {
    const idx = cursors.get(cid) ?? 0;
    if (idx < list.length && candidates.length < limitArg) {
      candidates.push(list[idx]);
      cursors.set(cid, idx + 1);
      added = true;
    }
  }
}

console.log(`Checking Spanish subtitles for ${candidates.length} balanced candidates...`);

async function verifySubtitlesForCandidate(videoId) {
  if (verifyUrlArg) {
    const u = `${verifyUrlArg.replace(/\/+$/, "")}?v=${encodeURIComponent(videoId)}&lang=es`;
    const r = await fetch(u, { signal: AbortSignal.timeout(20000) });
    if (!r.ok) return { cues: [], source: "none" };
    const j = await r.json();
    return { cues: j.cues ?? [], source: j.source ?? "supadata" };
  }
  const cues = await fetchYouTubeInnerTubeSubtitles(videoId, "es");
  return { cues, source: "youtube" };
}

const verified = [];
let rejectedCount = 0;

for (const cur of candidates) {
  if (verified.length >= targetCount) break;
  try {
    const { cues, source } = await verifySubtitlesForCandidate(cur.videoId);
    const analysis = analyzeSpanishSubtitleCues(cues, cur.durationSec);
    if (!analysis.ok) {
      rejectedCount += 1;
      continue;
    }
    const lvl = assessSpanishVideoLevel({
      title: cur.title,
      hintLevel: cur.hintLevel,
      durationSec: cur.durationSec,
      wpm: analysis.wpm
    });
    verified.push({
      videoId: cur.videoId,
      language: "es",
      sourceType: cur.sourceType,
      sourceId: cur.sourceId,
      sourceLabel: cur.sourceLabel,
      channelId: cur.channelId,
      channelTitle: cur.channelTitle,
      title: cur.title,
      thumbnail: cur.thumbnail,
      duration: cur.duration,
      durationSec: cur.durationSec,
      publishedAt: cur.publishedAt,
      topic: inferSpanishVideoTopic(cur.title, cur.sourceLabel, cur.hintTopic),
      level: lvl.level,
      levelSource: lvl.levelSource,
      subtitleStatus: "ready",
      subtitleSource: source,
      subtitleCueCount: analysis.cueCount,
      subtitleSampleEs: analysis.sample
    });
  } catch {
    rejectedCount += 1;
  }
  await new Promise((r) => setTimeout(r, 250));
}

const seedPath = path.join(process.cwd(), "src", "data", "spanish-video-catalog.json");
fs.mkdirSync(path.dirname(seedPath), { recursive: true });
fs.writeFileSync(seedPath, JSON.stringify(verified, null, 2));

const byCh = {};
const byLvl = { A1: 0, A2: 0, B1: 0, untagged: 0 };
const byTopic = {};
for (const v of verified) {
  byCh[v.channelTitle] = (byCh[v.channelTitle] || 0) + 1;
  if (v.level) byLvl[v.level] += 1;
  else byLvl.untagged += 1;
  byTopic[v.topic] = (byTopic[v.topic] || 0) + 1;
}

console.log(`Saved ${verified.length} verified Spanish videos (rejected ${rejectedCount}) -> ${seedPath}`);
console.log("By channel:", byCh);
console.log("By level:", byLvl);
console.log("By topic:", byTopic);

if (syncDb && verified.length > 0) {
  const { PrismaClient } = await import("@prisma/client");
  const prisma = new PrismaClient();
  const now = new Date();
  for (const item of verified) {
    await prisma.videoCatalog.upsert({
      where: { videoId: item.videoId },
      create: {
        videoId: item.videoId,
        language: "es",
        sourceType: item.sourceType,
        sourceId: item.sourceId,
        sourceLabel: item.sourceLabel,
        channelId: item.channelId,
        channelTitle: item.channelTitle,
        title: item.title,
        thumbnail: item.thumbnail,
        duration: item.duration,
        durationSec: item.durationSec,
        publishedAt: item.publishedAt,
        topic: item.topic,
        level: item.level,
        levelSource: item.levelSource,
        subtitleStatus: "ready",
        subtitleSource: item.subtitleSource,
        subtitleCueCount: item.subtitleCueCount,
        subtitleSampleEs: item.subtitleSampleEs,
        subtitleCheckedAt: now,
        embeddable: true,
        isActive: true
      },
      update: {
        sourceType: item.sourceType,
        sourceId: item.sourceId,
        sourceLabel: item.sourceLabel,
        topic: item.topic,
        level: item.level,
        levelSource: item.levelSource,
        subtitleStatus: "ready",
        subtitleSource: item.subtitleSource,
        subtitleCueCount: item.subtitleCueCount,
        subtitleSampleEs: item.subtitleSampleEs,
        subtitleCheckedAt: now,
        isActive: true
      }
    });
  }
  await prisma.$disconnect();
  console.log("Synced to Postgres video_catalog.");
}
