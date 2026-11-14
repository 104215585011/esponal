// Timestamp: 2026-11-14 15:58
import { apiFetch } from "@/api/client";

export type CreditSummary = {
  plan: string;
  currentPlan: string;
  currentCycle: string | null;
  balanceDisplay: string;
  balanceMinor: number;
};

/** 注册(公开接口),成功后调用 signIn 拿 token */
export async function registerAccount(input: {
  email: string;
  password: string;
  name?: string;
}) {
  return apiFetch<{ ok: boolean }>("/api/auth/register", {
    method: "POST",
    body: JSON.stringify({
      email: input.email,
      password: input.password,
      name: input.name ?? ""
    })
  });
}

/** 积分余额:口语每轮会扣,「我的」里给个可见数字 */
export async function fetchCredits() {
  return apiFetch<CreditSummary>("/api/credits");
}
