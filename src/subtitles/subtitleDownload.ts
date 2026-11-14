// Timestamp: 2026-11-14 13:00
import * as Print from "expo-print";
import { Directory, File, Paths } from "expo-file-system";
import AsyncStorage from "@react-native-async-storage/async-storage";

import { translateText, type Cue } from "@/api/watch";

/**
 * 字幕下载管理器。
 *
 * 产物与 Web 端一致:双语 PDF 讲义(每句 = 时间戳 + 西语 + 中文),
 * 文件名 {标题}-bilingual.pdf,存到 App 沙盒 downloads/ 目录。
 *
 * 关键点:
 * 1. 全量翻译走 /api/translate(服务端有 v3 缓存),3 个并发 worker,进度实时广播
 * 2. 任务是模块级的 —— 用户中途离开播放页翻译不会中断,完成后自动入索引
 * 3. 索引存 AsyncStorage,「我的下载」页从这里读
 */

const INDEX_KEY = "esponal.downloads";
const TRANSLATION_WORKERS = 3;

export type DownloadEntry = {
  id: string;
  kind: "subtitle-pdf";
  videoId: string;
  title: string;
  fileName: string;
  uri: string;
  size: number;
  createdAt: string;
};

export type DownloadJobState = {
  running: boolean;
  videoId: string | null;
  title: string;
  translated: number;
  total: number;
  done: boolean;
  failed: string | null;
  entry: DownloadEntry | null;
};

let state: DownloadJobState = {
  running: false,
  videoId: null,
  title: "",
  translated: 0,
  total: 0,
  done: false,
  failed: null,
  entry: null
};

const listeners = new Set<(s: DownloadJobState) => void>();

function setState(patch: Partial<DownloadJobState>) {
  state = { ...state, ...patch };
  for (const listener of listeners) listener(state);
}

export function subscribeDownloadJob(fn: (s: DownloadJobState) => void) {
  listeners.add(fn);
  return () => {
    listeners.delete(fn);
  };
}

export function getDownloadJob() {
  return state;
}

function sanitizeFileName(raw: string) {
  return (
    raw
      .replace(/[^a-z0-9\u00c0-\u024f\u4e00-\u9fff_-]+/gi, "-")
      .replace(/^-+|-+$/g, "")
      .slice(0, 80) || "subtitles"
  );
}

function esc(value: string) {
  return value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

function formatClock(seconds: number) {
  const total = Math.max(0, Math.floor(seconds));
  const min = Math.floor(total / 60);
  const sec = total % 60;
  return `${min}:${String(sec).padStart(2, "0")}`;
}

/** 与 Web 端同款版式的双语讲义 HTML,expo-print 用系统 WebView 渲染成 PDF(中/西文都没问题) */
function buildHandoutHtml(
  title: string,
  videoId: string,
  rows: Array<{ start: number; es: string; zh: string }>
) {
  const rowsHtml = rows
    .map(
      (row, index) => `
      <div class="row${row.es.trim() ? "" : " empty"}">
        <span class="time">${formatClock(row.start)}</span>
        <div class="text">
          <div class="es">${index + 1}. ${esc(row.es)}</div>
          <div class="zh">${row.zh ? esc(row.zh) : "—"}</div>
        </div>
      </div>`
    )
    .join("");

  return `<!DOCTYPE html>
<html>
  <head>
    <meta charset="utf-8" />
    <style>
      body { font-family: sans-serif; color: #18181b; margin: 28px 34px; }
      h1 { font-size: 20px; margin: 0 0 4px; }
      .meta { font-size: 10.5px; color: #71717a; margin-bottom: 18px; }
      .row { display: flex; gap: 12px; padding: 7px 0; border-bottom: 1px solid #f1f1f1; }
      .row.empty { display: none; }
      .time { font-size: 10px; font-weight: 700; color: #16a34a; min-width: 34px; padding-top: 3px; }
      .text { flex: 1; }
      .es { font-size: 13px; line-height: 1.5; }
      .zh { font-size: 11.5px; line-height: 1.5; color: #52525b; margin-top: 2px; }
    </style>
  </head>
  <body>
    <h1>${esc(title)}</h1>
    <div class="meta">Esponal 双语字幕讲义 · youtube.com/watch?v=${esc(videoId)} · 共 ${rows.length} 句 · 生成于 ${new Date().toLocaleString("zh-CN")}</div>
    ${rowsHtml}
  </body>
</html>`;
}

export async function listDownloads(): Promise<DownloadEntry[]> {
  try {
    const raw = await AsyncStorage.getItem(INDEX_KEY);
    const list = raw ? (JSON.parse(raw) as DownloadEntry[]) : [];
    return list.sort((a, b) => (a.createdAt < b.createdAt ? 1 : -1));
  } catch {
    return [];
  }
}

export async function removeDownload(entry: DownloadEntry): Promise<void> {
  try {
    // SDK 58 新 API:File 实例方法(legacy 的 deleteAsync 在运行时直接抛错)
    new File(entry.uri).delete();
  } catch {
    // 文件已不在就算了
  }
  const list = await listDownloads();
  await AsyncStorage.setItem(
    INDEX_KEY,
    JSON.stringify(list.filter((item) => item.id !== entry.id))
  );
}

export type StartSubtitleDownloadArgs = {
  videoId: string;
  title: string;
  cues: Cue[];
  /** 播放页已翻过的句子直接复用,省额度 */
  translations: Record<number, string>;
};

export async function startSubtitleDownload({
  videoId,
  title,
  cues,
  translations
}: StartSubtitleDownloadArgs): Promise<void> {
  if (state.running) return;

  const usable = cues.filter((cue) => cue.text?.trim());
  setState({
    running: true,
    videoId,
    title: title || videoId,
    translated: 0,
    total: usable.length,
    done: false,
    failed: null,
    entry: null
  });

  try {
    // 1. 全量补齐翻译(并发 worker;服务端 v3 缓存,重复下载同一视频不会重复花钱)
    const missing: number[] = [];
    const collected: Record<number, string> = { ...translations };

    let cursor = 0;
    for (let i = 0; i < cues.length; i += 1) {
      if (!cues[i].text?.trim()) continue;
      if (collected[i]?.trim()) continue;
      missing.push(i);
    }

    setState({ total: usable.length, translated: usable.length - missing.length });

    async function worker() {
      while (cursor < missing.length) {
        const index = missing[cursor];
        cursor += 1;
        try {
          const translation = await translateText(cues[index].text);
          if (translation) collected[index] = translation;
        } catch {
          // 单句失败不阻塞整体,该行 PDF 里显示 —
        }
        setState({ translated: state.translated + 1 });
      }
    }

    await Promise.all(
      Array.from(
        { length: Math.min(TRANSLATION_WORKERS, missing.length) },
        () => worker()
      )
    );

    // 2. 生成 PDF(web 同款版式)
    const rows = cues.map((cue, index) => ({
      start: cue.start,
      es: cue.text ?? "",
      zh: collected[index] ?? ""
    }));
    const safeTitle = title?.trim() || videoId;
    const html = buildHandoutHtml(safeTitle, videoId, rows);
    const { uri: tmpUri } = await Print.printToFileAsync({ html });

    // 3. 挪进沙盒 downloads/ 目录并登记
    const downloadsDir = new Directory(Paths.document, "downloads");
    downloadsDir.create({ idempotent: true });
    const fileName = `${sanitizeFileName(safeTitle)}-bilingual.pdf`;
    const dest = new File(downloadsDir, fileName);
    const tmp = new File(tmpUri);
    await tmp.move(dest);

    const entry: DownloadEntry = {
      id: `${videoId}-${Date.now()}`,
      kind: "subtitle-pdf",
      videoId,
      title: safeTitle,
      fileName,
      uri: dest.uri,
      size: dest.size ?? 0,
      createdAt: new Date().toISOString()
    };

    // 同一视频重复下载:替换旧文件,不堆重复条目
    const previous = await listDownloads();
    const outdated = previous.filter(
      (item) => item.kind === entry.kind && item.videoId === videoId
    );
    for (const old of outdated) {
      try {
        new File(old.uri).delete();
      } catch {
        // 旧文件已不在
      }
    }
    await AsyncStorage.setItem(
      INDEX_KEY,
      JSON.stringify([entry, ...previous.filter((item) => !outdated.includes(item))])
    );

    setState({ running: false, done: true, entry });
  } catch (e) {
    setState({
      running: false,
      failed: e instanceof Error ? e.message : "下载失败"
    });
  }
}
