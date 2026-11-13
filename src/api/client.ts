// Timestamp: 2026-11-13 17:22
import * as SecureStore from "expo-secure-store";

/**
 * API 客户端。
 *
 * 两个要点(与 docs/api-contract.md 一致):
 * 1. token 存 expo-secure-store(iOS Keychain / Android Keystore),不用 AsyncStorage 明文。
 * 2. refresh 必须"单飞":并发的 401 只触发一次刷新,否则 rotation 会让第二个请求拿旧 token 失败,误踢登录态。
 */

export const API_BASE = process.env.EXPO_PUBLIC_API_BASE ?? "https://www.pcmuz.cn";

const KEY_ACCESS = "esponal.accessToken";
const KEY_REFRESH = "esponal.refreshToken";

export const tokenStore = {
  async getAccess() {
    return SecureStore.getItemAsync(KEY_ACCESS);
  },
  async getRefresh() {
    return SecureStore.getItemAsync(KEY_REFRESH);
  },
  async save(accessToken: string, refreshToken: string) {
    await Promise.all([
      SecureStore.setItemAsync(KEY_ACCESS, accessToken),
      SecureStore.setItemAsync(KEY_REFRESH, refreshToken)
    ]);
  },
  async clear() {
    await Promise.all([
      SecureStore.deleteItemAsync(KEY_ACCESS),
      SecureStore.deleteItemAsync(KEY_REFRESH)
    ]);
  }
};

/** 刷新回调:token 彻底失效时通知上层跳登录页 */
let onSessionExpired: (() => void) | null = null;
export function setSessionExpiredHandler(handler: (() => void) | null) {
  onSessionExpired = handler;
}

let refreshing: Promise<string | null> | null = null;

async function refreshAccessToken(): Promise<string | null> {
  if (!refreshing) {
    refreshing = (async () => {
      const refreshToken = await tokenStore.getRefresh();
      if (!refreshToken) return null;

      const res = await fetch(`${API_BASE}/api/mobile/auth/refresh`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ refreshToken })
      });

      if (!res.ok) {
        await tokenStore.clear();
        onSessionExpired?.();
        return null;
      }

      const data = (await res.json()) as {
        accessToken: string;
        refreshToken: string;
      };
      await tokenStore.save(data.accessToken, data.refreshToken);
      return data.accessToken;
    })().finally(() => {
      refreshing = null;
    });
  }

  return refreshing;
}

export class ApiError extends Error {
  status: number;
  code?: string;

  constructor(message: string, status: number, code?: string) {
    super(message);
    this.status = status;
    this.code = code;
  }
}

export async function apiFetch<T>(
  path: string,
  init: RequestInit = {},
  retry = true
): Promise<T> {
  const token = await tokenStore.getAccess();

  const res = await fetch(`${API_BASE}${path}`, {
    ...init,
    headers: {
      "Content-Type": "application/json",
      ...init.headers,
      ...(token ? { Authorization: `Bearer ${token}` } : {})
    }
  });

  if (res.status === 401 && retry) {
    const next = await refreshAccessToken();
    if (next) {
      return apiFetch<T>(path, init, false);
    }
  }

  const text = await res.text();
  let body: unknown = null;
  try {
    body = text ? JSON.parse(text) : null;
  } catch {
    body = text;
  }

  if (!res.ok) {
    const errorBody = body as { error?: string; code?: string } | null;
    throw new ApiError(
      errorBody?.error ?? `请求失败 (${res.status})`,
      res.status,
      errorBody?.code
    );
  }

  return body as T;
}
