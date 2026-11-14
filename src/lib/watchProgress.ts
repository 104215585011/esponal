// Timestamp: 2026-11-14 23:18
import AsyncStorage from "@react-native-async-storage/async-storage";

/**
 * 视频观看进度（本地）。
 *
 * 为什么先放本地而不是加服务端字段：续播是"这台设备上一次看到哪"的问题，
 * 本地读写零延迟、离线也能用；而且不改数据库就不用碰生产迁移。
 * 代价是换手机不同步——等 Web 端也要接续播时，再补到 VideoView 表上。
 *
 * 两处刻意不做「续播」的情况：
 *   1. 只看了不到 8 秒 —— 多半是点进去试了一下，从头上更合理
 *   2. 已经看到 92% 以上 —— 剩下是片尾，从他停的地方开始等于什么都没得看
 */

const KEY = "esponal.watch-progress.v1";

export type WatchProgress = {
  videoId: string;
  /** 秒 */
  position: number;
  /** 视频总长（秒），0 表示还没探测到 */
  duration: number;
  updatedAt: string;
};

/** 小于这个位置不续播 */
const MIN_RESUME_SEC = 8;
/** 超过这个比例认为看完了 */
const DONE_RATIO = 0.92;

let cache: Record<string, WatchProgress> = {};
let loaded = false;
let inflight: Promise<Record<string, WatchProgress>> | null = null;

export async function loadWatchProgress(): Promise<Record<string, WatchProgress>> {
  if (loaded) return cache;
  if (inflight) return inflight;

  inflight = AsyncStorage.getItem(KEY)
    .then((raw) => {
      cache = raw ? (JSON.parse(raw) as Record<string, WatchProgress>) : {};
      loaded = true;
      return cache;
    })
    .catch(() => {
      cache = {};
      loaded = true;
      return cache;
    })
    .finally(() => {
      inflight = null;
    });

  return inflight;
}

export function getWatchProgress(videoId: string): WatchProgress | undefined {
  return cache[videoId];
}

/** 首页「接着看」要一次拿到所有进度（只读快照，不改缓存） */
export function getAllWatchProgress(): Record<string, WatchProgress> {
  return { ...cache };
}

export function shouldResume(progress: WatchProgress | undefined): boolean {
  if (!progress) return false;
  if (progress.position < MIN_RESUME_SEC) return false;
  if (progress.duration > 0 && progress.position >= progress.duration * DONE_RATIO) return false;
  return true;
}

function persist(): Promise<void> {
  return AsyncStorage.setItem(KEY, JSON.stringify(cache)).catch(() => undefined);
}

/**
 * 采纳服务端那份进度。
 *
 * 只在「本地没有」或「服务端更靠后」时才采纳——同一台设备刚看完，
 * 服务端那条是 15 秒前上报的旧值，直接覆盖会把人往回拖。
 */
export function adoptServerProgress(
  videoId: string,
  position: number,
  duration: number
): boolean {
  if (!videoId || !Number.isFinite(position) || position <= 0) return false;

  const local = cache[videoId];
  if (local && local.position >= position) return false;

  cache = {
    ...cache,
    [videoId]: {
      videoId,
      position: Math.floor(position),
      duration: Number.isFinite(duration) && duration > 0 ? Math.floor(duration) : 0,
      updatedAt: new Date().toISOString()
    }
  };

  void persist();
  return true;
}

export async function saveWatchProgress(
  videoId: string,
  position: number,
  duration: number
): Promise<void> {
  if (!videoId) return;
  if (!Number.isFinite(position) || position < 0) return;

  cache = {
    ...cache,
    [videoId]: {
      videoId,
      position: Math.floor(position),
      duration: Number.isFinite(duration) && duration > 0 ? Math.floor(duration) : 0,
      updatedAt: new Date().toISOString()
    }
  };

  try {
    await AsyncStorage.setItem(KEY, JSON.stringify(cache));
  } catch {
    // 存不下不影响播放
  }
}

export async function clearWatchProgress(videoId: string): Promise<void> {
  const { [videoId]: _removed, ...rest } = cache;
  cache = rest;
  try {
    await AsyncStorage.setItem(KEY, JSON.stringify(cache));
  } catch {
    // ignore
  }
}

/** 首页「接着看」用：把秒数写成 1:23 这种 */
export function formatPosition(seconds: number): string {
  const total = Math.max(0, Math.floor(seconds));
  const h = Math.floor(total / 3600);
  const m = Math.floor((total % 3600) / 60);
  const s = total % 60;
  if (h > 0) return `${h}:${String(m).padStart(2, "0")}:${String(s).padStart(2, "0")}`;
  return `${m}:${String(s).padStart(2, "0")}`;
}
