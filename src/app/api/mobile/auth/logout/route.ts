// Timestamp: 2026-11-13 17:13
import { NextResponse } from "next/server";
import { revokeRefreshToken } from "@/lib/mobile-token";

/**
 * POST /api/mobile/auth/logout
 *
 * 吊销 refreshToken。accessToken 是无状态 JWT,无法吊销,
 * 但 15 分钟即过期,且 App 端会同时清空本地存储,实际影响可忽略。
 *
 * 请求:{ refreshToken?: string }
 * 响应:{ ok: true }
 */
export async function POST(request: Request) {
  let body: { refreshToken?: unknown } = {};

  try {
    body = (await request.json()) as { refreshToken?: unknown };
  } catch {
    // logout 不该因为 body 格式失败而卡住客户端
  }

  if (typeof body.refreshToken === "string" && body.refreshToken.trim()) {
    await revokeRefreshToken(body.refreshToken.trim());
  }

  return NextResponse.json({ ok: true });
}
