// Timestamp: 2026-11-18 10:58
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

    const updated = await tx.user.updateMany({
      where: { id: userId, signupGranted: false },
      data: {
        signupGranted: true,
        creditBalanceMinor: { increment: next.balanceMinor - user.creditBalanceMinor },
      },
    });
    if (!updated.count) return;
    const saved = await tx.user.findUniqueOrThrow({ where: { id: userId }, select: { creditBalanceMinor: true } });

    await tx.creditTransaction.create({
      data: {
        userId,
        deltaMinor: SIGNUP_GRANT_MINOR,
        reason: "grant",
        refType: "signup",
        balanceAfterMinor: saved.creditBalanceMinor,
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

    const updated = await tx.user.updateMany({
      where: { id: userId, creditBalanceMinor: { gte: costMinor } },
      data: { creditBalanceMinor: { decrement: costMinor } },
    });
    const saved = await tx.user.findUnique({ where: { id: userId }, select: { creditBalanceMinor: true } });
    const balanceMinor = saved?.creditBalanceMinor ?? 0;
    if (!updated.count) return { ok: false, balanceMinor };

    await tx.creditTransaction.create({
      data: {
        userId,
        deltaMinor: -costMinor,
        reason: "spend",
        refType,
        refId,
        balanceAfterMinor: balanceMinor,
      },
    });

    return { ok: true, balanceMinor };
  });
}
