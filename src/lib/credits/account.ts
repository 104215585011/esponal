// Timestamp: 2026-06-04 17:19
import { PLAN_CONFIG, SIGNUP_GRANT_MINOR, type CreditSource, type Plan } from "./config.ts";

export type BalanceAccount = {
  balanceMinor: number;
};

export type RefillAccount = {
  plan: Plan;
  source: CreditSource;
  balanceMinor: number;
};

export type SignupAccount = {
  signupGranted: boolean;
  balanceMinor: number;
};

export function deduct(account: BalanceAccount, costMinor: number) {
  if (costMinor <= 0) {
    return { ok: true, balanceMinor: account.balanceMinor };
  }

  if (account.balanceMinor < costMinor) {
    return { ok: false, balanceMinor: account.balanceMinor };
  }

  return { ok: true, balanceMinor: account.balanceMinor - costMinor };
}

export function applyMonthlyRefill(account: RefillAccount): RefillAccount {
  const config = PLAN_CONFIG[account.plan];

  if (config.source === "free") {
    return { ...account, balanceMinor: account.balanceMinor };
  }

  if (config.source === "subscription") {
    return { ...account, balanceMinor: config.monthlyMinor };
  }

  return { ...account, balanceMinor: account.balanceMinor + config.monthlyMinor };
}

export function grantSignup(account: SignupAccount): SignupAccount {
  if (account.signupGranted) {
    return account;
  }

  return {
    ...account,
    signupGranted: true,
    balanceMinor: account.balanceMinor + SIGNUP_GRANT_MINOR,
  };
}
