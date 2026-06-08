// Timestamp: 2026-06-08 17:11
import { ACTION_COST_MINOR } from "@/lib/credits/config";
import { requireCredits } from "@/lib/credits/runtime";
import { spendCredits } from "@/lib/credits/service";
import { OcrPageLimitError, OcrProviderError, OCR_PAGE_LIMIT } from "./ocr.ts";
import { NeedsOcrError, parseImportedDocument, parseImportedDocumentWithOcr } from "./parse";
import { markImportedDocumentFailed, markImportedDocumentReady } from "./service";

export async function processImportedDocumentUpload(input: {
  documentId: string;
  userId: string;
  file: File;
}) {
  try {
    const parsed = await parseImportedDocument(input.file);

    return markImportedDocumentReady({
      documentId: input.documentId,
      title: parsed.title,
      kind: parsed.kind,
      sections: parsed.pages,
    });
  } catch (error) {
    if (error instanceof NeedsOcrError) {
      if (error.pageCount > OCR_PAGE_LIMIT) {
        return markImportedDocumentFailed({
          documentId: input.documentId,
          kind: "pdf_ocr",
          failReason: "ocr_page_limit",
          pageCount: error.pageCount,
        });
      }

      const ocrCostMinor = error.pageCount * ACTION_COST_MINOR.ocr_per_page;
      const creditGuard = await requireCredits(input.userId, ocrCostMinor);
      if (!creditGuard.ok) {
        return markImportedDocumentFailed({
          documentId: input.documentId,
          kind: "pdf_ocr",
          failReason: "insufficient_credits",
          pageCount: error.pageCount,
        });
      }

      try {
        const parsed = await parseImportedDocumentWithOcr(input.file);
        const spendResult = await spendCredits(
          input.userId,
          ocrCostMinor,
          "ocr",
          input.documentId,
        );

        if (!spendResult.ok) {
          return markImportedDocumentFailed({
            documentId: input.documentId,
            kind: "pdf_ocr",
            failReason: "insufficient_credits",
            pageCount: error.pageCount,
          });
        }

        return markImportedDocumentReady({
          documentId: input.documentId,
          title: parsed.title,
          kind: parsed.kind,
          sections: parsed.pages,
        });
      } catch (ocrError) {
        if (ocrError instanceof OcrPageLimitError) {
          return markImportedDocumentFailed({
            documentId: input.documentId,
            kind: "pdf_ocr",
            failReason: "ocr_page_limit",
            pageCount: error.pageCount,
          });
        }

        if (ocrError instanceof OcrProviderError) {
          return markImportedDocumentFailed({
            documentId: input.documentId,
            kind: "pdf_ocr",
            failReason: "ocr_failed",
            pageCount: error.pageCount,
          });
        }

        return markImportedDocumentFailed({
          documentId: input.documentId,
          kind: "pdf_ocr",
          failReason: "ocr_failed",
          pageCount: error.pageCount,
        });
      }
    }

    if (error instanceof OcrPageLimitError) {
      return markImportedDocumentFailed({
        documentId: input.documentId,
        kind: "pdf_ocr",
        failReason: "ocr_page_limit",
      });
    }

    return markImportedDocumentFailed({
      documentId: input.documentId,
      failReason: "import_failed",
    });
  }
}
