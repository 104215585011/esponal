// Timestamp: 2026-06-08 16:16
import { processImportedDocumentUpload } from "./process";

export async function scheduleImportedDocumentProcessing(input: {
  documentId: string;
  userId: string;
  file: File;
}) {
  try {
    await processImportedDocumentUpload(input);
  } catch (error) {
    console.error("Import document processing failed", error);
  }
}
