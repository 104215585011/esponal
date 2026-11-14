import { NextResponse } from "next/server";
import { OAuth2Client } from "google-auth-library";
import { prisma } from "@/lib/prisma";
import { issueTokenPair } from "@/lib/mobile-token";
import { checkRateLimit, getRetryAfterSec, loginLimiter } from "@/lib/ratelimit";

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

/**
 * 允许的 audience:
 *   - GOOGLE_ANDROID_CLIENT_ID:App 打包时用的 Android 客户端(环境变量)
 *   - GOOGLE_CLIENT_ID:Web 端 OAuth 的客户端(NextAuth 已在用)
 *   - BUILTIN:兜底内置的自家 Android 客户端 id
 *
 * 内置一份的原因:这个 id 是公开信息(每个 APK 里都能翻出来),而 Vercel
 * 环境变量名字写错/漏配会让 App 登录在最后一步失败,排查成本远高于内置的成本。
 * 它只放宽到「本项目的客户端」,不会接受别人的 id_token。
 */
const BUILTIN_ANDROID_CLIENT_ID =
  "944314756480-p5qqusb05evjcbf18dhvk8prril23onv.apps.googleusercontent.com";

function allowedAudiences() {
  const candidates = [
    process.env.GOOGLE_ANDROID_CLIENT_ID,
    process.env.GOOGLE_CLIENT_ID,
    BUILTIN_ANDROID_CLIENT_ID
  ];

  return Array.from(
    new Set(candidates.filter((v): v is string => Boolean(v && v.trim())).map((v) => v.trim()))
  );
}

export async function POST(request: Request) {
  const rateLimit = await checkRateLimit(loginLimiter, request, null);
  if (!rateLimit.allowed) {
    const retryAfterSec = getRetryAfterSec(rateLimit.reset);
    return NextResponse.json(
      { error: "too many attempts", code: "RATE_LIMITED", retryAfterSec },
      { status: 429, headers: { "Retry-After": String(retryAfterSec) } }
    );
  }

  const audiences = allowedAudiences();
  if (audiences.length === 0) {
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

  let email = "";
  let name: string | null = null;
  let picture: string | null = null;
  let emailVerified = false;

  try {
    const client = new OAuth2Client();
    const ticket = await client.verifyIdToken({ idToken, audience: audiences });
    const payload = ticket.getPayload();

    email = (payload?.email ?? "").toLowerCase().trim();
    name = payload?.name ?? null;
    picture = payload?.picture ?? null;
    emailVerified = payload?.email_verified === true;
  } catch {
    return NextResponse.json(
      { error: "google token is invalid or expired", code: "INVALID_GOOGLE_TOKEN" },
      { status: 401 }
    );
  }

  if (!email) {
    return NextResponse.json(
      { error: "google account has no email", code: "NO_EMAIL" },
      { status: 400 }
    );
  }
  if (!emailVerified) {
    return NextResponse.json(
      { error: "google email is not verified", code: "EMAIL_NOT_VERIFIED" },
      { status: 403 }
    );
  }

  // 已有账号(含邮箱密码注册过的)直接登录;没有就建一个无密码账号
  const existing = await prisma.user.findUnique({
    where: { email },
    select: { id: true, email: true, name: true, image: true, plan: true }
  });

  let user = existing;
  if (!user) {
    user = await prisma.user.create({
      data: {
        email,
        name,
        image: picture,
        emailVerified: new Date()
      },
      select: { id: true, email: true, name: true, image: true, plan: true }
    });
  } else if ((!user.name && name) || (!user.image && picture)) {
    // 只补空字段,不覆盖用户自己改过的昵称/头像
    user = await prisma.user.update({
      where: { id: user.id },
      data: {
        name: user.name ?? name,
        image: user.image ?? picture
      },
      select: { id: true, email: true, name: true, image: true, plan: true }
    });
  }

  const tokens = await issueTokenPair({
    id: user.id,
    email: user.email,
    name: user.name ?? name
  });

  return NextResponse.json({
    ...tokens,
    tokenType: "Bearer",
    user: {
      id: user.id,
      email: user.email,
      name: user.name ?? name,
      image: user.image ?? picture,
      plan: user.plan
    }
  });
}
