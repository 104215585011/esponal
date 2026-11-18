// Timestamp: 2026-11-18 10:58
import { AsyncLocalStorage } from "node:async_hooks";
import { prisma } from "./prisma.ts";

const context = new AsyncLocalStorage<{ userId: string | null }>();

export function withApiUsage<T>(userId: string | null, run: () => Promise<T>) {
  return context.run({ userId }, run);
}

type Usage = { provider: string; feature: string; unit?: string; units?: number };

export async function recordApiUsage(usage: Usage, outcome: string) {
  const caller = context.getStore();
  try {
    await prisma.apiUsageEvent.create({
      data: {
        ...usage,
        userId: caller?.userId,
        origin: caller ? (caller.userId ? "user" : "guest") : "background",
        outcome
      }
    });
  } catch (error) {
    console.warn("API usage write failed", usage.provider, error instanceof Error ? error.name : "Unknown");
  }
}

export async function meteredFetch(usage: Usage, input: URL | string, init: RequestInit, measureTokens = false) {
  let response: Response;
  try {
    response = await fetch(input, init);
  } catch (error) {
    await recordApiUsage(usage, "network_error");
    throw error;
  }
  let units = usage.units;
  if (measureTokens && response.ok) {
    const payload = await response.clone().json().catch(() => null);
    const count = payload?.usage?.total_tokens;
    if (Number.isSafeInteger(count) && count >= 0 && count <= 2147483647) units = count;
  }
  const outcome = response.ok ? "success" :
    response.status === 429 ? "rate_limited" : response.status === 402 ? "quota_or_plan" : "error";
  await recordApiUsage({ ...usage, units }, outcome);
  return response;
}
