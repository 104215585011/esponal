// Timestamp: 2026-11-18 10:47
import { getAuthedUserId } from "@/lib/api-auth";
import { prisma } from "@/lib/prisma";

const OWNER_EMAIL = "easternwang123@gmail.com";

export async function getAdminUser(request: Request) {
  const userId = await getAuthedUserId(request);
  if (!userId) return null;

  const user = await prisma.user.findUnique({
    where: { id: userId },
    select: { id: true, email: true }
  });

  return user?.email?.trim().toLowerCase() === OWNER_EMAIL ? user : null;
}
