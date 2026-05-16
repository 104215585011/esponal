import { Ratelimit } from "@upstash/ratelimit";
import { Redis } from "@upstash/redis";

type LimitResult = {
  success: boolean;
  reset: number;
};

type Limitable = {
  limit: (key: string) => Promise<LimitResult>;
};

const upstashUrl =
  process.env.UPSTASH_REDIS_REST_URL ?? process.env.KV_REST_API_URL ?? "";
const upstashToken =
  process.env.UPSTASH_REDIS_REST_TOKEN ?? process.env.KV_REST_API_TOKEN ?? "";
const redis =
  upstashUrl && upstashToken
    ? new Redis({ url: upstashUrl, token: upstashToken })
    : null;

function createFailOpenLimiter(): Limitable {
  return {
    async limit() {
      throw new Error("Upstash rate limit is not configured");
    }
  };
}

function createLimiter(limit: number, prefix: string): Limitable {
  if (!redis) {
    return createFailOpenLimiter();
  }

  return new Ratelimit({
    redis,
    limiter: Ratelimit.slidingWindow(limit, "1 m"),
    prefix,
    analytics: false
  });
}

export const translateLimiter = createLimiter(60, "rl:translate");
export const lookupLimiter = createLimiter(30, "rl:lookup");
export const addLimiter = createLimiter(20, "rl:vocab:add");
export const searchLimiter = createLimiter(20, "rl:youtube:search");
export const channelLimiter = createLimiter(30, "rl:youtube:channel");

export function getClientIp(request: Request) {
  const forwardedFor = request.headers.get("x-forwarded-for");

  if (forwardedFor) {
    return forwardedFor.split(",")[0]?.trim() || "unknown";
  }

  return request.headers.get("x-real-ip")?.trim() || "unknown";
}

export async function checkRateLimit(
  limiter: Limitable,
  request: Request,
  userId: string | null
): Promise<{ allowed: boolean; reset: number }> {
  try {
    const ipResult = await limiter.limit(`ip:${getClientIp(request)}`);

    if (!ipResult.success) {
      return { allowed: false, reset: ipResult.reset };
    }

    if (userId) {
      const userResult = await limiter.limit(`user:${userId}`);

      if (!userResult.success) {
        return { allowed: false, reset: userResult.reset };
      }
    }

    return { allowed: true, reset: 0 };
  } catch {
    return { allowed: true, reset: 0 };
  }
}

export function getRetryAfterSec(reset: number) {
  return Math.max(1, Math.ceil((reset - Date.now()) / 1000));
}
