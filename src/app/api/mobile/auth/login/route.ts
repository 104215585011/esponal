// Timestamp: 2026-11-13 17:10
import { NextResponse } from "next/server";
import bcrypt from "bcryptjs";
import { prisma } from "@/lib/prisma";
import { issueTokenPair } from "@/lib/mobile-token";
import { checkRateLimit, getRetryAfterSec, loginLimiter } from "@/lib/ratelimit";

/**
 * POST /api/mobile/auth/login
 *
 * 原生 App 登录入口。密码校验逻辑与 NextAuth 的 credentials provider 保持一致
 * (同样的 bcrypt.compare、同样的 email 归一化),只是把结果换成 Bearer token。
 *
 * 请求:{ email: string, password: string }
 * 响应:{ accessToken, refreshToken, accessTokenExpiresIn, refreshTokenExpiresIn, user }
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

  let body: { email?: unknown; password?: unknown };

  try {
    body = (await request.json()) as { email?: unknown; password?: unknown };
  } catch {
    return NextResponse.json({ error: "invalid json" }, { status: 400 });
  }

  const email = typeof body.email === "string" ? body.email.toLowerCase().trim() : "";
  const password = typeof body.password === "string" ? body.password : "";

  if (!email || !password) {
    return NextResponse.json(
      { error: "email and password are required", code: "INVALID_INPUT" },
      { status: 400 }
    );
  }

  const user = await prisma.user.findUnique({ where: { email } });

  // 统一返回同一句错误,不暴露"邮箱是否存在"
  if (!user?.password) {
    return NextResponse.json(
      { error: "invalid credentials", code: "INVALID_CREDENTIALS" },
      { status: 401 }
    );
  }

  const passwordOk = await bcrypt.compare(password, user.password);
  if (!passwordOk) {
    return NextResponse.json(
      { error: "invalid credentials", code: "INVALID_CREDENTIALS" },
      { status: 401 }
    );
  }

  const tokens = await issueTokenPair({
    id: user.id,
    email: user.email,
    name: user.name
  });

  return NextResponse.json({
    ...tokens,
    tokenType: "Bearer",
    user: {
      id: user.id,
      email: user.email,
      name: user.name,
      image: user.image,
      plan: user.plan
    }
  });
}
