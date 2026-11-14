// Timestamp: 2026-11-13 17:25
import { createContext, useCallback, useContext, useEffect, useMemo, useState } from "react";
import { API_BASE, apiFetch, setSessionExpiredHandler, tokenStore } from "@/api/client";
import { GOOGLE_ANDROID_REDIRECT_URI } from "@/config/google";

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
  /** Google 登录:把 expo-auth-session 拿到的 id_token 交给服务端验签并换 token */
  signInWithGoogleToken: (idToken: string) => Promise<void>;
  /**
   * Google 登录(主路径):authorization code + PKCE verifier 交给服务端换 token。
   * 客户端自己换 code 的路径在 expo-auth-session 里没有任何错误处理,失败时一片安静,
   * 所以这里走服务端交换,Google 的具体错误能显示出来。
   */
  signInWithGoogleCode: (code: string, codeVerifier: string) => Promise<void>;
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

  // 启动:有 token 就当已登录,并恢复缓存的用户信息
  // (覆盖安装 APK 时 SecureStore 会保留,所以更新后不需要重新登录)
  useEffect(() => {
    let cancelled = false;

    (async () => {
      const [access, refresh, cachedUser] = await Promise.all([
        tokenStore.getAccess(),
        tokenStore.getRefresh(),
        tokenStore.getUser<AuthUser>()
      ]);

      if (cancelled) return;

      if (access && refresh) {
        if (cachedUser) setUser(cachedUser);
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
    await tokenStore.saveUser(body.user);
    setUser(body.user);
    setStatus("signedIn");
  }, []);

  const signInWithGoogleToken = useCallback(async (idToken: string) => {
    const res = await fetch(`${API_BASE}/api/mobile/auth/google`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ idToken })
    });

    const body = (await res.json().catch(() => null)) as
      | (LoginResponse & { error?: string | { code?: string; message?: string }; code?: string })
      | null;

    if (!res.ok || !body?.accessToken) {
      const code =
        typeof body?.error === "object" ? body?.error?.code : (body?.code ?? body?.error);
      throw new Error(
        code === "NOT_CONFIGURED"
          ? "服务端还没配置 Google 登录"
          : code === "INVALID_GOOGLE_TOKEN"
            ? "Google 凭证已失效,请重试"
            : code === "EMAIL_NOT_VERIFIED"
              ? "这个 Google 邮箱还没验证"
              : "Google 登录失败,请稍后再试"
      );
    }

    await tokenStore.save(body.accessToken, body.refreshToken);
    await tokenStore.saveUser(body.user);
    setUser(body.user);
    setStatus("signedIn");
  }, []);

  const signInWithGoogleCode = useCallback(async (code: string, codeVerifier: string) => {
    const res = await fetch(`${API_BASE}/api/mobile/auth/google-code`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ code, codeVerifier, redirectUri: GOOGLE_ANDROID_REDIRECT_URI })
    });

    const body = (await res.json().catch(() => null)) as
      | (LoginResponse & {
          error?: string | { code?: string; message?: string };
          code?: string;
          errorDescription?: string | null;
        })
      | null;

    if (!res.ok || !body?.accessToken) {
      const code =
        typeof body?.error === "object" ? body?.error?.code : (body?.code ?? body?.error);
      throw new Error(
        code === "NOT_CONFIGURED"
          ? "服务端还没配置 Google 登录"
          : code === "EMAIL_NOT_VERIFIED"
            ? "这个 Google 邮箱还没验证"
            : code === "GOOGLE_EXCHANGE_FAILED"
              ? `Google 授权交换失败:${body?.errorDescription ?? body?.error ?? "未知原因"}`
              : code === "INVALID_GOOGLE_TOKEN"
                ? "Google 凭证已失效,请重试"
                : "Google 登录失败,请稍后再试"
      );
    }

    await tokenStore.save(body.accessToken, body.refreshToken);
    await tokenStore.saveUser(body.user);
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
    () => ({ status, user, signIn, signInWithGoogleToken, signInWithGoogleCode, signOut }),
    [status, user, signIn, signInWithGoogleToken, signInWithGoogleCode, signOut]
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error("useAuth must be used inside AuthProvider");
  return ctx;
}
