// Timestamp: 2026-11-15 08:08
import type { ImportKind } from "@prisma/client";
import { normalizeLanguage } from "@/lib/languages";
import { prisma } from "@/lib/prisma";

const importedDocumentSelect = {
  id: true,
  language: true,
  title: true,
  kind: true,
  ossKey: true,
  sizeBytes: true,
  unitCount: true,
  lastPosition: true,
  status: true,
  failReason: true,
  createdAt: true,
  updatedAt: true,
} as const;

const importedDocumentFileSelect = {
  ...importedDocumentSelect,
  inlineContent: true,
} as const;

export async function createImportedDocument(input: {
  userId: string;
  language?: string;
  title: string;
  kind: ImportKind;
  ossKey: string;
  sizeBytes: number;
  inlineContent?: Buffer;
  unitCount?: number;
}) {
  return prisma.importedDocument.create({
    data: {
      userId: input.userId,
      language: normalizeLanguage(input.language),
      title: input.title,
      kind: input.kind,
      ossKey: input.ossKey,
      sizeBytes: input.sizeBytes,
      inlineContent: input.inlineContent,
      unitCount: input.unitCount ?? 0,
      status: "ready",
    },
    select: importedDocumentSelect,
  });
}

export async function getImportedDocumentFileByIdForUser(userId: string, documentId: string) {
  return prisma.importedDocument.findFirst({
    where: { id: documentId, userId },
    select: importedDocumentFileSelect,
  });
}

export async function listImportedDocumentsForUser(userId: string, language?: string) {
  return prisma.importedDocument.findMany({
    where: {
      userId,
      ...(language ? { language: normalizeLanguage(language) } : {})
    },
    orderBy: { createdAt: "desc" },
    select: importedDocumentSelect,
  });
}

export async function listImportedArticlesForUser(userId: string, language?: string) {
  return prisma.importedDocument.findMany({
    where: {
      userId,
      ...(language ? { language: normalizeLanguage(language) } : {}),
      status: "ready",
      kind: { in: ["pdf", "epub"] },
    },
    orderBy: { createdAt: "desc" },
    select: importedDocumentSelect,
  });
}

export async function getImportedDocumentByIdForUser(userId: string, documentId: string) {
  return prisma.importedDocument.findFirst({
    where: { id: documentId, userId },
    select: importedDocumentSelect,
  });
}

export async function deleteImportedDocumentForUser(userId: string, documentId: string) {
  const document = await prisma.importedDocument.findFirst({
    where: { id: documentId, userId },
    select: importedDocumentSelect,
  });

  if (!document) {
    return null;
  }

  await prisma.importedDocument.delete({
    where: { id: document.id },
  });

  return document;
}

export async function updateImportedDocumentProgress(input: {
  userId: string;
  documentId: string;
  lastPosition: string;
  unitCount?: number;
}) {
  const document = await prisma.importedDocument.findFirst({
    where: { id: input.documentId, userId: input.userId },
    select: { id: true },
  });

  if (!document) {
    return null;
  }

  return prisma.importedDocument.update({
    where: { id: document.id },
    data: {
      lastPosition: input.lastPosition,
      unitCount: input.unitCount,
    },
    select: importedDocumentSelect,
  });
}
