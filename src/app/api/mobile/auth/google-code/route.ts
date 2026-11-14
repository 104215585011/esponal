import { NextResponse } from "next/server";
import { checkRateLimit, getRetryAfterSec, loginLimiter } from "@/lib/ratelimit";
import {
  BUILTIN_ANDROID_CLIENT_ID,
  exchangeGoogleCode,
  signInWithGoogleProfile,
  verifyGoogleIdToken
} from "@/lib/google-auth";

/**
 * POST /api/mobile/auth/google-code
 *
 * App 端 Google OAuth 走的是「浏览器授权 + PKCE」:Google 把 authorization code
 * 回跳给 App,这里负责换 token(客户端那一步 expo-auth-session 做了但没有任何
 * 错误处理,失败时一片安静,没法排查)。
 *
 * 请求:{ code: string, codeVerifier: string, redirectUri: string }
 * 响应:与 /api/mobile/auth/login 完全一致(tokens + user)
 *
 * 安全性:
 *   - code 是一次性的,PKCE verifier 在授权请求时就开始配对,重放无效
 *   - redirectUri 必须和授权请求里的一模一样,Google 端会校验
 *   - 换到的 id_token 仍然走完整验签(aud/iss/exp),audience 白名单在 lib 里
 */

type Body = {
  code?: unknown;
  codeVerifier?: unknown;
  redirectUri?: unknown;
};

export async function POST(request: Request) {
  const rateLimit = await checkRateLimit(loginLimiter, request, null);
  if (!rateLimit.allowed) {
    const retryAfterSec = getRetryAfterSec(rateLimit.reset);
    return NextResponse.json(
      { error: "too many attempts", code: "RATE_LIMITED", retryAfterSec },
      { status: 429, headers: { "Retry-After": String(retryAfterSec) } }
    );
  }

  let body: Body;
  try {
    body = (await request.json()) as Body;
  } catch {
    return NextResponse.json({ error: "invalid json" }, { status: 400 });
  }

  const code = typeof body.code === "string" ? body.code.trim() : "";
  const codeVerifier = typeof body.codeVerifier === "string" ? body.codeVerifier.trim() : "";
  const redirectUri = typeof body.redirectUri === "string" ? body.redirectUri.trim() : "";

  if (!code || !codeVerifier || !redirectUri) {
    return NextResponse.json(
      { error: "code, codeVerifier and redirectUri are required", code: "INVALID_INPUT" },
      { status: 400 }
    );
  }

  // redirectUri 只允许 Google Android 客户端的自定义 scheme,防止被当成开放代理
  const expectedPrefix = `com.googleusercontent.apps.${
    (process.env.GOOGLE_ANDROID_CLIENT_ID || BUILTIN_ANDROID_CLIENT_ID).split(".")[0]
  }`;
  if (!redirectUri.startsWith(expectedPrefix)) {
    return NextResponse.json(
      { error: "redirectUri does not match the registered client", code: "INVALID_REDIRECT_URI" },
      { status: 400 }
    );
  }

  const exchanged = await exchangeGoogleCode(code, codeVerifier, redirectUri);
  if (!exchanged.ok) {
    // 把 Google 的具体错误透传出去,App 端能显示真实原因而不是"登录失败"
    return NextResponse.json(
      {
        error: `google token exchange failed: ${exchanged.error}`,
        errorDescription: exchanged.errorDescription ?? null,
        code: "GOOGLE_EXCHANGE_FAILED"
      },
      { status: 401 }
    );
  }

  const profile = await verifyGoogleIdToken(exchanged.idToken);
  if (!profile) {
    return NextResponse.json(
      { error: "google token is invalid or expired", code: "INVALID_GOOGLE_TOKEN" },
      { status: 401 }
    );
  }

  const result = await signInWithGoogleProfile(profile);
  if (!result.ok) {
    return NextResponse.json(
      { error: result.error, code: result.code },
      { status: result.status }
    );
  }

  return NextResponse.json({
    ...result.tokens,
    tokenType: "Bearer",
    user: result.user
  });
}
