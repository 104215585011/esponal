// 对话历史读取：列表 + 解密
// 改自 talks/src/lib/chat/history-service.ts；Session/Message 改名为 ChatSession/ChatMessage

import type { ChatMessage, PrismaClient } from "@prisma/client";
import { decryptMessageContent } from "./message-crypto";

export type ListUserHistoryInput = {
  userId: string;
  characterId: string;
  page: number;
  pageSize: number;
  encryptionSecret: string;
  sessionId?: string;
  includeArchived?: boolean;
};

function toReadableContent(message: ChatMessage, encryptionSecret: string) {
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

export async function listUserHistory(prisma: PrismaClient, input: ListUserHistoryInput) {
  const skip = (input.page - 1) * input.pageSize;
  const sessionSkip = input.sessionId ? 0 : skip;
  const messageSkip = input.sessionId ? skip : 0;

  const [sessions, total] = await Promise.all([
    prisma.chatSession.findMany({
      where: {
        userId: input.userId,
        characterId: input.characterId,
        status: input.includeArchived ? undefined : "ACTIVE",
        ...(input.sessionId ? { id: input.sessionId } : {})
      },
      orderBy: { updatedAt: "desc" },
      skip: sessionSkip,
      take: input.sessionId ? 1 : input.pageSize,
      include: {
        character: { select: { id: true, name: true } },
        messages: {
          orderBy: { createdAt: "desc" },
          skip: messageSkip,
          take: input.pageSize + 1
        }
      }
    }),
    prisma.chatSession.count({
      where: {
        userId: input.userId,
        characterId: input.characterId,
        status: input.includeArchived ? undefined : "ACTIVE",
        ...(input.sessionId ? { id: input.sessionId } : {})
      }
    })
  ]);

  const items = sessions.map((session) => {
    const orderedMessages = [...session.messages].reverse();
    return {
      id: session.id,
      characterId: session.characterId,
      characterName: session.character.name,
      title: session.title,
      status: session.status,
      createdAt: session.createdAt.toISOString(),
      updatedAt: session.updatedAt.toISOString(),
      messages: orderedMessages.map((message) => ({
        id: message.id,
        role: message.role,
        content: toReadableContent(message, input.encryptionSecret),
        corrections: message.corrections,
        newWords: message.newWords,
        createdAt: message.createdAt.toISOString()
      }))
    };
  });

  return {
    page: input.page,
    pageSize: input.pageSize,
    total,
    items
  };
}
