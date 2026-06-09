// Timestamp: 2026-06-09 13:20
import type { ImportKind } from "@prisma/client";
import { prisma } from "@/lib/prisma";

const importedDocumentSelect = {
  id: true,
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

export async function createImportedDocument(input: {
  userId: string;
  title: string;
  kind: ImportKind;
  ossKey: string;
  sizeBytes: number;
  unitCount?: number;
}) {
  return prisma.importedDocument.create({
    data: {
      userId: input.userId,
      title: input.title,
      kind: input.kind,
      ossKey: input.ossKey,
      sizeBytes: input.sizeBytes,
      unitCount: input.unitCount ?? 0,
      status: "ready",
    },
    select: importedDocumentSelect,
  });
}

export async function listImportedDocumentsForUser(userId: string) {
  return prisma.importedDocument.findMany({
    where: { userId },
    orderBy: { createdAt: "desc" },
    select: importedDocumentSelect,
  });
}

export async function listImportedArticlesForUser(userId: string) {
  return prisma.importedDocument.findMany({
    where: {
      userId,
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
