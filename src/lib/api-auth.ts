// Timestamp: 2026-11-13 17:00
import { getServerSession } from "next-auth";
import { decode } from "next-auth/jwt";
import { getAuthOptions } from "@/lib/auth";

/**
 * PLATFORM-001:双通道鉴权。
 *
 * Web 走 NextAuth 的 HttpOnly cookie;原生 App(Expo/RN)没有 cookie,
 * 走 `Authorization: Bearer <jwt>` —— token 由 NextAuth 同一个 secret 签发,
 * 所以两条通道解出来的是同一个 userId,账号体系不分叉。
 *
 * 用法:
 *   const userId = await getAuthedUserId(req);       // 必需登录
 *   if (!userId) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
 *
 *   const userId = await getOptionalUserId(req);     // 可选登录(个性化/限流 key)
 *
 * 关于过期:token 过期与伪造在这里都返回 null(NextAuth 的 decode 对过期会抛错,
 * 无法可靠区分)。App 端收到 401 即用 refreshToken 静默换新 token 再重试 —— 这是标准做法。
 */
export async function getAuthedUserId(req: Request): Promise<string | null> {
  const bearer = readBearerToken(req);

  if (bearer) {
    // Bearer 存在但无效:直接判定未登录,不再回退 cookie。
    // 避免"过期 token + 陈旧 cookie"混用导致身份串味。
    return verifyBearerToken(bearer);
  }

  const session = await getServerSession(getAuthOptions()).catch(() => null);
  const id = (session?.user as { id?: string } | undefined)?.id;
  return typeof id === "string" && id.length > 0 ? id : null;
}

/** 同上,但把所有异常都吞掉 —— 用于"登录有更好,没登录也能用"的场景(个性化/限流)。 */
export async function getOptionalUserId(req: Request): Promise<string | null> {
  try {
    return await getAuthedUserId(req);
  } catch {
    return null;
  }
}

export function readBearerToken(req: Request): string | null {
  const header = req.headers.get("authorization");
  if (!header) return null;
  const match = /^Bearer\s+(.+)$/i.exec(header.trim());
  return match ? match[1].trim() : null;
}

/** 校验 Bearer JWT,返回 userId;无效或过期返回 null。 */
export async function verifyBearerToken(token: string): Promise<string | null> {
  const secret = process.env.NEXTAUTH_SECRET;
  if (!secret || !token) return null;

  try {
    const payload = (await decode({ token, secret })) as
      | ({ sub?: string; id?: string } & Record<string, unknown>)
      | null;

    if (!payload) return null;

    const userId =
      typeof payload.id === "string"
        ? payload.id
        : typeof payload.sub === "string"
          ? payload.sub
          : null;

    return userId && userId.length > 0 ? userId : null;
  } catch {
    // 签名错误 / 格式错误 / 已过期 —— 一律视为无效
    return null;
  }
}
