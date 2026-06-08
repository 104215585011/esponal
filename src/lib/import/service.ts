// Timestamp: 2026-06-08 17:11
import type { ImportKind, ImportStatus } from "@prisma/client";
import { prisma } from "@/lib/prisma";

export async function createImportedDocument(input: {
  userId: string;
  title: string;
  kind: ImportKind;
  status?: ImportStatus;
  failReason?: string | null;
  pageCount?: number;
  sections?: string[];
}) {
  const status = input.status ?? "processing";
  const pageCount = input.pageCount ?? input.sections?.length ?? 0;

  return prisma.importedDocument.create({
    data: {
      userId: input.userId,
      title: input.title,
      kind: input.kind,
      status,
      failReason: input.failReason ?? null,
      pageCount,
      sections: input.sections?.length
        ? {
            create: input.sections.map((content, pageIndex) => ({
              pageIndex,
              content,
            })),
          }
        : undefined,
    },
    include: {
      sections: {
        orderBy: { pageIndex: "asc" },
      },
    },
  });
}

export async function markImportedDocumentReady(input: {
  documentId: string;
  title: string;
  kind: ImportKind;
  sections: string[];
}) {
  return prisma.importedDocument.update({
    where: { id: input.documentId },
    data: {
      title: input.title,
      kind: input.kind,
      status: "ready",
      failReason: null,
      pageCount: input.sections.length,
      sections: {
        deleteMany: {
          documentId: input.documentId,
        },
        create: input.sections.map((content, pageIndex) => ({
          pageIndex,
          content,
        })),
      },
    },
    include: {
      sections: {
        orderBy: { pageIndex: "asc" },
      },
    },
  });
}

export async function markImportedDocumentFailed(input: {
  documentId: string;
  kind?: ImportKind;
  failReason: string;
  pageCount?: number;
}) {
  return prisma.importedDocument.update({
    where: { id: input.documentId },
    data: {
      kind: input.kind,
      status: "failed",
      failReason: input.failReason,
      pageCount: input.pageCount ?? 0,
      sections: {
        deleteMany: {
          documentId: input.documentId,
        },
      },
    },
    include: {
      sections: {
        orderBy: { pageIndex: "asc" },
      },
    },
  });
}

export async function getImportedDocumentByIdForUser(userId: string, documentId: string) {
  return prisma.importedDocument.findFirst({
    where: { id: documentId, userId },
    select: {
      id: true,
      title: true,
      kind: true,
      status: true,
      failReason: true,
      pageCount: true,
      lastPageIndex: true,
      createdAt: true,
      updatedAt: true,
    },
  });
}
