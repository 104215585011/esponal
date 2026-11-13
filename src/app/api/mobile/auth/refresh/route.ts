// Timestamp: 2026-11-13 17:12
import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import {
  ACCESS_TOKEN_TTL_SEC,
  REFRESH_TOKEN_TTL_SEC,
  issueAccessToken,
  rotateRefreshToken
} from "@/lib/mobile-token";

/**
 * POST /api/mobile/auth/refresh
 *
 * 用 refreshToken 换一对新 token。旧 refreshToken 立即作废(rotation),
 * 所以同一 token 无法被重放。
 *
 * 请求:{ refreshToken: string }
 * 响应:{ accessToken, refreshToken, accessTokenExpiresIn, refreshTokenExpiresIn, user }
 */
export async function POST(request: Request) {
  let body: { refreshToken?: unknown };

  try {
    body = (await request.json()) as { refreshToken?: unknown };
  } catch {
    return NextResponse.json({ error: "invalid json" }, { status: 400 });
  }

  const refreshToken =
    typeof body.refreshToken === "string" ? body.refreshToken.trim() : "";

  if (!refreshToken) {
    return NextResponse.json(
      { error: "refreshToken is required", code: "INVALID_INPUT" },
      { status: 400 }
    );
  }

  const rotated = await rotateRefreshToken(refreshToken);

  if (!rotated) {
    // 无效 / 已过期 / 已被使用过 —— App 应清空本地 token 回到登录页
    return NextResponse.json(
      { error: "invalid refresh token", code: "INVALID_REFRESH_TOKEN" },
      { status: 401 }
    );
  }

  const user = await prisma.user.findUnique({
    where: { id: rotated.userId },
    select: { id: true, email: true, name: true, image: true, plan: true }
  });

  if (!user) {
    // token 有效但账号已删除
    return NextResponse.json(
      { error: "user not found", code: "USER_NOT_FOUND" },
      { status: 401 }
    );
  }

  const accessToken = await issueAccessToken({
    id: user.id,
    email: user.email,
    name: user.name
  });

  return NextResponse.json({
    accessToken,
    refreshToken: rotated.refreshToken,
    accessTokenExpiresIn: ACCESS_TOKEN_TTL_SEC,
    refreshTokenExpiresIn: REFRESH_TOKEN_TTL_SEC,
    tokenType: "Bearer",
    user
  });
}
