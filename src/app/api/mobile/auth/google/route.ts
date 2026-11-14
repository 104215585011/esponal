import { NextResponse } from "next/server";
import { checkRateLimit, getRetryAfterSec, loginLimiter } from "@/lib/ratelimit";
import { allowedAudiences, signInWithGoogleProfile, verifyGoogleIdToken } from "@/lib/google-auth";

/**
 * POST /api/mobile/auth/google
 *
 * App 端用 expo-auth-session 拿到 Google id_token 后,在这里换取本站 Bearer token。
 *
 * 为什么不在 App 里直接拿 Google access_token 去调后端:
 * id_token 是 Google 签名的 JWT,服务端能用 JWKS 验签并校验 aud/iss/exp,
 * 不需要把 client_secret 放进客户端 —— 这是移动端 OAuth 的正确做法。
 *
 * 请求:{ idToken: string }
 * 响应:与 /api/mobile/auth/login 完全一致(tokens + user)
 */

export async function POST(request: Request) {
  const rateLimit = await checkRateLimit(loginLimiter, request, null);
  if (!rateLimit.allowed) {
    const retryAfterSec = getRetryAfterSec(rateLimit.reset);
    return NextResponse.json(
      { error: "too many attempts", code: "RATE_LIMITED", retryAfterSec },
      { status: 429, headers: { "Retry-After": String(retryAfterSec) } }
    );
  }

  if (allowedAudiences().length === 0) {
    // 没配 client id 时不要假装成功,直接告诉客户端"未启用"
    return NextResponse.json(
      { error: "google sign-in is not configured", code: "NOT_CONFIGURED" },
      { status: 501 }
    );
  }

  let body: { idToken?: unknown };
  try {
    body = (await request.json()) as { idToken?: unknown };
  } catch {
    return NextResponse.json({ error: "invalid json" }, { status: 400 });
  }

  const idToken = typeof body.idToken === "string" ? body.idToken.trim() : "";
  if (!idToken) {
    return NextResponse.json(
      { error: "idToken is required", code: "INVALID_INPUT" },
      { status: 400 }
    );
  }

  const profile = await verifyGoogleIdToken(idToken);
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
