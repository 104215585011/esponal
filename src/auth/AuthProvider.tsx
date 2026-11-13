// Timestamp: 2026-11-13 17:25
import { createContext, useCallback, useContext, useEffect, useMemo, useState } from "react";
import { API_BASE, apiFetch, setSessionExpiredHandler, tokenStore } from "@/api/client";

export type AuthUser = {
  id: string;
  email: string | null;
  name: string | null;
  image: string | null;
  plan: string;
};

type AuthState = {
  status: "loading" | "signedIn" | "signedOut";
  user: AuthUser | null;
  signIn: (email: string, password: string) => Promise<void>;
  signOut: () => Promise<void>;
};

const AuthContext = createContext<AuthState | null>(null);

type LoginResponse = {
  accessToken: string;
  refreshToken: string;
  user: AuthUser;
};

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [status, setStatus] = useState<AuthState["status"]>("loading");
  const [user, setUser] = useState<AuthUser | null>(null);

  // 启动:有 token 就当已登录。真实有效性由首个请求的 401 兜底(会触发刷新或登出)。
  useEffect(() => {
    let cancelled = false;

    (async () => {
      const [access, refresh] = await Promise.all([
        tokenStore.getAccess(),
        tokenStore.getRefresh()
      ]);

      if (cancelled) return;

      if (access && refresh) {
        setStatus("signedIn");
      } else {
        setStatus("signedOut");
      }
    })();

    return () => {
      cancelled = true;
    };
  }, []);

  // token 彻底失效时(refresh 也失败)由 client 通知回登录页
  useEffect(() => {
    setSessionExpiredHandler(() => {
      setUser(null);
      setStatus("signedOut");
    });
    return () => setSessionExpiredHandler(null);
  }, []);

  const signIn = useCallback(async (email: string, password: string) => {
    const res = await fetch(`${API_BASE}/api/mobile/auth/login`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ email, password })
    });

    const body = (await res.json().catch(() => null)) as
      | (LoginResponse & { error?: string; code?: string })
      | null;

    if (!res.ok || !body?.accessToken) {
      throw new Error(
        body?.code === "RATE_LIMITED"
          ? "尝试太频繁,请稍后再试"
          : body?.error === "invalid credentials"
            ? "邮箱或密码不正确"
            : "登录失败,请检查网络"
      );
    }

    await tokenStore.save(body.accessToken, body.refreshToken);
    setUser(body.user);
    setStatus("signedIn");
  }, []);

  const signOut = useCallback(async () => {
    const refreshToken = await tokenStore.getRefresh();

    // 尽力吊销,失败也要清本地
    if (refreshToken) {
      await apiFetch("/api/mobile/auth/logout", {
        method: "POST",
        body: JSON.stringify({ refreshToken })
      }).catch(() => undefined);
    }

    await tokenStore.clear();
    setUser(null);
    setStatus("signedOut");
  }, []);

  const value = useMemo(
    () => ({ status, user, signIn, signOut }),
    [status, user, signIn, signOut]
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error("useAuth must be used inside AuthProvider");
  return ctx;
}
