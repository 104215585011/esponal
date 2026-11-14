// Timestamp: 2026-11-14 23:45
import { redis } from "@/lib/redis";

/**
 * 观看进度的读写（Redis）。
 *
 * 历史接口和进度接口都要读进度，所以放这里共享一份 key 规则，
 * 免得两边各写一遍 key 前缀——那种错误极其安静：写进去了，但永远读不到。
 */

export const WATCH_PROGRESS_TTL_SEC = 60 * 60 * 24 * 90;

export type WatchProgressValue = {
  position: number;
  duration: number;
  updatedAt: string;
};

export function watchProgressKey(userId: string, videoId: string) {
  return `watch:progress:${userId}:${videoId}`;
}

export async function readWatchProgress(
  userId: string,
  videoIds: string[]
): Promise<Record<string, WatchProgressValue>> {
  const ids = videoIds.filter(Boolean).slice(0, 100);
  if (ids.length === 0) return {};

  try {
    const values = await redis.mget(ids.map((videoId) => watchProgressKey(userId, videoId)));
    const result: Record<string, WatchProgressValue> = {};

    values.forEach((value, index) => {
      if (typeof value !== "string") return;
      try {
        const parsed = JSON.parse(value) as WatchProgressValue;
        if (Number.isFinite(parsed.position)) result[ids[index]] = parsed;
      } catch {
        // 坏值当作没有
      }
    });

    return result;
  } catch (error) {
    console.error("Watch progress read failed", error);
    // 进度读不到不该让页面挂掉
    return {};
  }
}

export async function writeWatchProgress(
  userId: string,
  videoId: string,
  position: number,
  duration: number
): Promise<WatchProgressValue> {
  const value: WatchProgressValue = {
    position: Math.floor(position),
    duration: Number.isFinite(duration) && duration > 0 ? Math.floor(duration) : 0,
    updatedAt: new Date().toISOString()
  };

  await redis.set(
    watchProgressKey(userId, videoId),
    JSON.stringify(value),
    "EX",
    WATCH_PROGRESS_TTL_SEC
  );

  return value;
}
