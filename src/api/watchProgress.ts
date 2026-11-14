// Timestamp: 2026-11-14 23:50
import { apiFetch } from "@/api/client";

/**
 * 服务端观看进度。
 *
 * 端上是「本地优先」：
 *   - 本地有就立刻用（打开播放页不等网络）
 *   - 服务端那份只用来补"别的设备看到哪"和"换手机后没有本地记录"的情况
 *
 * 上报是 fire-and-forget：进度丢一次只是重看一段，不值得为它弹错误。
 */

export type ServerProgress = {
  position: number;
  duration: number;
  updatedAt: string;
};

/** 一次最多 50 个，服务端也限制了这个数 */
export async function fetchServerProgress(
  videoIds: string[]
): Promise<Record<string, ServerProgress>> {
  const ids = videoIds.filter(Boolean).slice(0, 50);
  if (ids.length === 0) return {};

  try {
    const res = await apiFetch<{ items?: Record<string, ServerProgress> }>(
      `/api/watch/progress?videoIds=${encodeURIComponent(ids.join(","))}`
    );
    return res.items ?? {};
  } catch {
    return {};
  }
}

export async function pushServerProgress(
  videoId: string,
  position: number,
  duration: number
): Promise<void> {
  if (!videoId || !Number.isFinite(position) || position <= 0) return;
  try {
    await apiFetch("/api/watch/progress", {
      method: "POST",
      body: JSON.stringify({ videoId, position, duration })
    });
  } catch {
    // 进度只是辅助数据，失败静默
  }
}
