import { PrismaClient } from "@prisma/client";
import { fileURLToPath } from "node:url";

const prisma = new PrismaClient();

export async function cleanupArchivedSessions(now = new Date()) {
  const cutoff = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
  const result = await prisma.chatSession.deleteMany({
    where: {
      status: "ARCHIVED",
      archivedAt: { lt: cutoff }
    }
  });

  return result.count;
}

const isDirectRun = process.argv[1] === fileURLToPath(import.meta.url);

if (isDirectRun) {
  try {
    const count = await cleanupArchivedSessions();
    console.log(`Deleted ${count} archived sessions older than 7 days since archive`);
  } finally {
    await prisma.$disconnect();
  }
}
