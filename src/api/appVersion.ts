// Timestamp: 2026-11-14 02:45
import Constants from "expo-constants";

import { apiFetch } from "@/api/client";

export type AppVersionInfo = {
  latestVersion: string;
  downloadUrl: string | null;
  notes: string;
  publishedAt: string | null;
  releaseUrl: string | null;
};

/** 当前安装的版本(来自 app.json 的 version,构建时写死进包) */
export function currentVersion(): string {
  return Constants.expoConfig?.version ?? "0.0.0";
}

/** 只比较 x.y.z,返回 1 表示 a 更新,0 相同,-1 表示 a 更旧 */
export function compareVersion(a: string, b: string): number {
  const pa = a.split(".").map((n) => Number.parseInt(n, 10) || 0);
  const pb = b.split(".").map((n) => Number.parseInt(n, 10) || 0);

  for (let i = 0; i < 3; i += 1) {
    const na = pa[i] ?? 0;
    const nb = pb[i] ?? 0;
    if (na > nb) return 1;
    if (na < nb) return -1;
  }
  return 0;
}

export async function fetchLatestVersion(): Promise<AppVersionInfo> {
  return apiFetch<AppVersionInfo>("/api/mobile/app-version");
}

export type UpdateCheckResult = {
  hasUpdate: boolean;
  current: string;
  latest: AppVersionInfo;
};

export async function checkForUpdate(): Promise<UpdateCheckResult> {
  const current = currentVersion();
  const latest = await fetchLatestVersion();

  return {
    hasUpdate: compareVersion(latest.latestVersion, current) > 0,
    current,
    latest
  };
}
