// Timestamp: 2026-06-04 17:23
import { prisma } from "../prisma.ts";
import { deduct, grantSignup } from "./account.ts";
import { SIGNUP_GRANT_MINOR } from "./config.ts";

export async function getBalanceMinor(userId: string): Promise<number> {
  const user = await prisma.user.findUnique({
    where: { id: userId },
    select: { creditBalanceMinor: true },
  });

  return user?.creditBalanceMinor ?? 0;
}

export async function ensureSignupGrant(userId: string): Promise<void> {
  await prisma.$transaction(async (tx) => {
    const user = await tx.user.findUnique({
      where: { id: userId },
      select: { signupGranted: true, creditBalanceMinor: true },
    });

    if (!user || user.signupGranted) {
      return;
    }

    const next = grantSignup({
      signupGranted: user.signupGranted,
      balanceMinor: user.creditBalanceMinor,
    });

    await tx.user.update({
      where: { id: userId },
      data: {
        signupGranted: true,
        creditBalanceMinor: next.balanceMinor,
      },
    });

    await tx.creditTransaction.create({
      data: {
        userId,
        deltaMinor: SIGNUP_GRANT_MINOR,
        reason: "grant",
        balanceAfterMinor: next.balanceMinor,
      },
    });
  });
}

export async function spendCredits(
  userId: string,
  costMinor: number,
  refType: string,
  refId?: string,
): Promise<{ ok: boolean; balanceMinor: number }> {
  return prisma.$transaction(async (tx) => {
    const user = await tx.user.findUnique({
      where: { id: userId },
      select: { creditBalanceMinor: true },
    });

    if (costMinor <= 0) {
      return { ok: false, balanceMinor: user?.creditBalanceMinor ?? 0 };
    }

    const result = deduct({ balanceMinor: user?.creditBalanceMinor ?? 0 }, costMinor);
    if (!result.ok) {
      return { ok: false, balanceMinor: result.balanceMinor };
    }

    await tx.user.update({
      where: { id: userId },
      data: { creditBalanceMinor: result.balanceMinor },
    });

    await tx.creditTransaction.create({
      data: {
        userId,
        deltaMinor: -costMinor,
        reason: "spend",
        refType,
        refId,
        balanceAfterMinor: result.balanceMinor,
      },
    });

    return { ok: true, balanceMinor: result.balanceMinor };
  });
}
