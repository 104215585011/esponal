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
const KEY_USER = "esponal.user";

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
  /** 缓存用户信息,让 App 重启/覆盖更新后「我的」页仍能显示账号 */
  async saveUser(user: unknown) {
    try {
      await SecureStore.setItemAsync(KEY_USER, JSON.stringify(user));
    } catch {
      // 存不下不算致命
    }
  },
  async getUser<T>(): Promise<T | null> {
    try {
      const raw = await SecureStore.getItemAsync(KEY_USER);
      return raw ? (JSON.parse(raw) as T) : null;
    } catch {
      return null;
    }
  },
  async clear() {
    await Promise.all([
      SecureStore.deleteItemAsync(KEY_ACCESS),
      SecureStore.deleteItemAsync(KEY_REFRESH),
      SecureStore.deleteItemAsync(KEY_USER)
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
        user?: unknown;
      };
      await tokenStore.save(data.accessToken, data.refreshToken);
      // 刷新响应里带最新用户信息,顺带更新缓存
      if (data.user) await tokenStore.saveUser(data.user);
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
    // 服务端错误有两种形态:error 为字符串("rate limited"),或对象({code, message},如 402 额度不足)。
    // 兼容两种,否则对象会被塞进 message 显示成 [object Object]。
    const errorBody = body as
      | {
          error?: string | { code?: string; message?: string };
          code?: string;
          message?: string;
        }
      | null;

    const raw = errorBody?.error;
    const message =
      typeof raw === "string"
        ? raw
        : typeof raw?.message === "string" && raw.message
          ? raw.message
          : typeof errorBody?.message === "string" && errorBody.message
            ? errorBody.message
            : `请求失败 (${res.status})`;
    const code =
      typeof raw === "object" && raw?.code ? raw.code : errorBody?.code;

    throw new ApiError(message, res.status, code);
  }

  return body as T;
}
