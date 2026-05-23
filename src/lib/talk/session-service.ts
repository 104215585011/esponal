import type { ChatMessage, PrismaClient } from "@prisma/client";
import { decryptMessageContent } from "./message-crypto";
import { generateSessionTitle } from "./model-client";

export type TalkSessionListItem = {
  id: string;
  title: string;
  updatedAt: string;
  lastMessagePreview: string;
};

export type ListActiveTalkSessionsInput = {
  userId: string;
  characterId: string;
  encryptionSecret: string;
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
      status: "ACTIVE"
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
    lastMessagePreview: summarizePreview(session.messages[0], input.encryptionSecret)
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
    lastMessagePreview: ""
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
    lastMessagePreview: summarizePreview(updated.messages[0], input.encryptionSecret)
  };
}
