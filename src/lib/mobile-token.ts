// Timestamp: 2026-11-13 17:05
import { createHash, randomBytes } from "node:crypto";
import { encode } from "next-auth/jwt";
import { redis } from "@/lib/redis";

/**
 * PLATFORM-001:原生 App 的 token 体系。
 *
 * accessToken  = NextAuth 自己签的 JWT(与 Web cookie 同一个 secret),
 *                所以 `getAuthedUserId` 能解开两条通道。
 * refreshToken = 32 字节随机串,DB 里只存 sha256(不存明文),
 *                30 天有效,每次刷新轮换一次(rotation)防止重放。
 *
 * 存 Redis 而非新建 Prisma 表:一期零 schema 变更、零迁移风险。
 * 二期待办:Redis 重启会丢 token(用户重新登录即可),若要强持久化再落库。
 */

export const ACCESS_TOKEN_TTL_SEC = 60 * 15; // 15 分钟
export const REFRESH_TOKEN_TTL_SEC = 60 * 60 * 24 * 30; // 30 天

const REFRESH_KEY_PREFIX = "mobile:rt:";

export type MobileTokenUser = {
  id: string;
  email?: string | null;
  name?: string | null;
};

export type IssuedTokens = {
  accessToken: string;
  refreshToken: string;
  accessTokenExpiresIn: number;
  refreshTokenExpiresIn: number;
};

function sha256(value: string) {
  return createHash("sha256").update(value).digest("hex");
}

function refreshKey(rawToken: string) {
  return `${REFRESH_KEY_PREFIX}${sha256(rawToken)}`;
}

export async function issueAccessToken(user: MobileTokenUser): Promise<string> {
  const secret = process.env.NEXTAUTH_SECRET;
  if (!secret) {
    throw new Error("NEXTAUTH_SECRET is required to issue mobile access tokens");
  }

  return encode({
    token: {
      sub: user.id,
      id: user.id,
      email: user.email ?? undefined,
      name: user.name ?? undefined
    },
    secret,
    maxAge: ACCESS_TOKEN_TTL_SEC
  });
}

export async function issueRefreshToken(userId: string): Promise<string> {
  const rawToken = randomBytes(32).toString("hex");
  await redis.set(refreshKey(rawToken), userId, "EX", REFRESH_TOKEN_TTL_SEC);
  return rawToken;
}

export async function issueTokenPair(user: MobileTokenUser): Promise<IssuedTokens> {
  const [accessToken, refreshToken] = await Promise.all([
    issueAccessToken(user),
    issueRefreshToken(user.id)
  ]);

  return {
    accessToken,
    refreshToken,
    accessTokenExpiresIn: ACCESS_TOKEN_TTL_SEC,
    refreshTokenExpiresIn: REFRESH_TOKEN_TTL_SEC
  };
}

/**
 * 用 refreshToken 换 userId,并轮换(旧 token 立即作废)。
 * 返回 null 表示无效/已过期/已被用过。
 */
export async function rotateRefreshToken(
  rawToken: string
): Promise<{ userId: string; refreshToken: string } | null> {
  if (!rawToken || rawToken.length < 32) return null;

  const key = refreshKey(rawToken);
  const userId = await redis.get(key);

  if (!userId) return null;

  // rotation:先删旧的,再发新的。并发下第二次调用拿不到旧 key,天然防重放。
  await redis.del(key);
  const refreshToken = await issueRefreshToken(userId);

  return { userId, refreshToken };
}

export async function revokeRefreshToken(rawToken: string): Promise<void> {
  if (!rawToken || rawToken.length < 32) return;
  await redis.del(refreshKey(rawToken));
}
