import type { ChatMessage, PrismaClient } from "@prisma/client";
import { decryptMessageContent } from "./message-crypto";
import { generateSessionTitle } from "./model-client";

export type TalkSessionListItem = {
  id: string;
  title: string;
  updatedAt: string;
  lastMessagePreview: string;
  archivedAt?: string | null;
};

export type ListActiveTalkSessionsInput = {
  userId: string;
  characterId: string;
  encryptionSecret: string;
  includeArchived?: boolean;
};

export type CreateTalkSessionInput = {
  userId: string;
  characterId: string;
};

export type RetitleTalkSessionInput = {
  userId: string;
  sessionId: string;
  encryptionSecret: string;
};

export type MutateTalkSessionInput = {
  userId: string;
  sessionId: string;
  characterId: string;
  encryptionSecret: string;
};

const DRAFT_TITLE = "新会话";

function readMessageContent(message: ChatMessage, encryptionSecret: string) {
  if (!message.contentIv || !message.contentAuthTag) {
    return message.content;
  }

  return decryptMessageContent(
    {
      content: message.content,
      contentIv: message.contentIv,
      contentAuthTag: message.contentAuthTag
    },
    encryptionSecret
  );
}

function summarizePreview(message: ChatMessage | undefined, encryptionSecret: string) {
  if (!message) return "";
  return readMessageContent(message, encryptionSecret).replace(/\s+/g, " ").trim().slice(0, 48);
}

export async function listActiveTalkSessions(
  prisma: PrismaClient,
  input: ListActiveTalkSessionsInput
): Promise<TalkSessionListItem[]> {
  const sessions = await prisma.chatSession.findMany({
    where: {
      userId: input.userId,
      characterId: input.characterId,
      status: input.includeArchived ? "ARCHIVED" : "ACTIVE"
    },
    orderBy: { updatedAt: "desc" },
    take: 50,
    include: {
      messages: {
        orderBy: { createdAt: "desc" },
        take: 1
      }
    }
  });

  return sessions.map((session) => ({
    id: session.id,
    title: session.title?.trim() || DRAFT_TITLE,
    updatedAt: session.updatedAt.toISOString(),
    lastMessagePreview: summarizePreview(session.messages[0], input.encryptionSecret),
    archivedAt: session.archivedAt?.toISOString() ?? null
  }));
}

export async function createTalkSession(
  prisma: PrismaClient,
  input: CreateTalkSessionInput
): Promise<TalkSessionListItem> {
  const session = await prisma.chatSession.create({
    data: {
      userId: input.userId,
      characterId: input.characterId,
      title: DRAFT_TITLE
    }
  });

  return {
    id: session.id,
    title: session.title ?? DRAFT_TITLE,
    updatedAt: session.updatedAt.toISOString(),
    lastMessagePreview: "",
    archivedAt: session.archivedAt?.toISOString() ?? null
  };
}

export async function retitleTalkSession(
  prisma: PrismaClient,
  input: RetitleTalkSessionInput
): Promise<TalkSessionListItem | null> {
  const session = await prisma.chatSession.findFirst({
    where: {
      id: input.sessionId,
      userId: input.userId,
      status: "ACTIVE"
    },
    include: {
      messages: {
        orderBy: { createdAt: "asc" }
      },
      _count: {
        select: { messages: true }
      }
    }
  });

  if (!session || session._count.messages < 8) {
    return null;
  }

  const messages = session.messages
    .filter((message) => message.role !== "SYSTEM")
    .map((message) => ({
      role: message.role === "ASSISTANT" ? ("assistant" as const) : ("user" as const),
      content: readMessageContent(message, input.encryptionSecret)
    }));

  const title = await generateSessionTitle(messages);
  const updated = await prisma.chatSession.update({
    where: { id: session.id },
    data: { title },
    include: {
      messages: {
        orderBy: { createdAt: "desc" },
        take: 1
      }
    }
  });

  return {
    id: updated.id,
    title: updated.title?.trim() || DRAFT_TITLE,
    updatedAt: updated.updatedAt.toISOString(),
    lastMessagePreview: summarizePreview(updated.messages[0], input.encryptionSecret),
    archivedAt: updated.archivedAt?.toISOString() ?? null
  };
}

export async function archiveTalkSession(
  prisma: PrismaClient,
  input: MutateTalkSessionInput
): Promise<TalkSessionListItem | null> {
  const existing = await prisma.chatSession.findFirst({
    where: {
      id: input.sessionId,
      userId: input.userId,
      characterId: input.characterId,
      status: "ACTIVE"
    },
    include: {
      messages: {
        orderBy: { createdAt: "desc" },
        take: 1
      }
    }
  });

  if (!existing) {
    return null;
  }

  const updated = await prisma.chatSession.update({
    where: { id: existing.id },
    data: {
      status: "ARCHIVED",
      archivedAt: new Date()
    },
    include: {
      messages: {
        orderBy: { createdAt: "desc" },
        take: 1
      }
    }
  });

  return {
    id: updated.id,
    title: updated.title?.trim() || DRAFT_TITLE,
    updatedAt: updated.updatedAt.toISOString(),
    lastMessagePreview: summarizePreview(updated.messages[0], input.encryptionSecret),
    archivedAt: updated.archivedAt?.toISOString() ?? null
  };
}

export async function restoreTalkSession(
  prisma: PrismaClient,
  input: MutateTalkSessionInput
): Promise<TalkSessionListItem | null> {
  const existing = await prisma.chatSession.findFirst({
    where: {
      id: input.sessionId,
      userId: input.userId,
      characterId: input.characterId,
      status: "ARCHIVED"
    },
    include: {
      messages: {
        orderBy: { createdAt: "desc" },
        take: 1
      }
    }
  });

  if (!existing) {
    return null;
  }

  const updated = await prisma.chatSession.update({
    where: { id: existing.id },
    data: {
      status: "ACTIVE",
      archivedAt: null
    },
    include: {
      messages: {
        orderBy: { createdAt: "desc" },
        take: 1
      }
    }
  });

  return {
    id: updated.id,
    title: updated.title?.trim() || DRAFT_TITLE,
    updatedAt: updated.updatedAt.toISOString(),
    lastMessagePreview: summarizePreview(updated.messages[0], input.encryptionSecret),
    archivedAt: updated.archivedAt?.toISOString() ?? null
  };
}

export async function cleanupArchivedSessions(
  prisma: PrismaClient,
  now = new Date()
): Promise<number> {
  const cutoff = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
  const result = await prisma.chatSession.deleteMany({
    where: {
      status: "ARCHIVED",
      archivedAt: { lt: cutoff }
    }
  });

  return result.count;
}
